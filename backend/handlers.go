package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

const FILE_STORAGE_DIR_VAR = "FILE_STORAGE_DIR"

type StoredMessage struct {
	Encrypted bool   `json:"encrypted"`
	Message   string `json:"message"`
	HashedKey string `json:"hashedKey"`
	// Views is the number of reads remaining. 0 (legacy records) or 1 means
	// single view, N > 1 means N reads left.
	Views int `json:"views,omitempty"`
}

// maxViews caps the per-secret view count accepted by the API. It also bounds
// how many times a single stored ciphertext can be retrieved, so there is no
// unbounded-download ("unlimited views") amplification vector.
const maxViews = 100

// clampViews normalizes a client-requested view count to 1..maxViews.
// Anything malformed (including negative sentinels) collapses to the
// single-view default.
func clampViews(views int) int {
	switch {
	case views <= 1:
		return 1
	case views > maxViews:
		return maxViews
	}
	return views
}

type StoredFile struct {
	Encrypted bool   `json:"encrypted"`
	FileUri   string `json:"fileUri"`
	HashedKey string `json:"hashedKey"`
}

const maxFileSize = 25 * 1024 * 1024       // 25MB
const maxMultipartMemory = 4 * 1024 * 1024 // 4MB

// maxStatusIDs bounds how many ids /api/secretStatus will check per request.
// Matches the client-side secrets cap so the my-secrets page fits in a single request.
const maxStatusIDs = 128

// maxStatusBodyBytes caps the /api/secretStatus request body. 128 ids of 22
// base64url chars is ~3.2KB of JSON; 8KB leaves slack for whitespace while
// bounding the payload far below nginx's generic client_max_body_size.
const maxStatusBodyBytes = 8 * 1024

// maxSaveSecretBodyBytes caps the /api/saveSecret request body. A ~64KB
// plaintext secret becomes ~85KB after AES-GCM + base64url encoding, so 96KB
// leaves room for the ciphertext plus hashedKey/duration/views JSON. Bounding
// the stored ciphertext also bounds the amplification a multi-view link can
// create: a small upload cap keeps the total downloadable bytes (size × views)
// in check.
const maxSaveSecretBodyBytes = 96 * 1024

// maxLookupBodyBytes caps the small JSON bodies of the lookup endpoints
// (/api/get, /api/getFile, /api/stat). Their largest legitimate payload is a
// 22-char id plus a 64-char hashedKey (~120 bytes of JSON), so 1KB is generous
// while keeping them far below nginx's global client_max_body_size.
const maxLookupBodyBytes = 1024

var fileStorageDir = os.Getenv("FILE_STORAGE_DIR")

var (
	saveToStorageFunc                 = saveToStorage
	consumeMessageFromStorageFunc     = consumeMessageFromStorage
	consumeFileMessageFromStorageFunc = consumeFileMessageFromStorage
	setFileRecordFunc                 = func(storeKey string, value interface{}, ttl time.Duration) (bool, error) {
		return getRedisClient().SetNX(getFileStoreKey(storeKey), value, ttl).Result()
	}
	incrementStoredFileCountersFunc = incrementStoredFileCounters
	secretsExistFunc                = secretsExist
)

func apiSaveSecret(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200

	jResponse := struct {
		Status string `json:"status"`
		NewId  string `json:"newId"`
	}{
		Status: "error",
		NewId:  "0",
	}

	r.Body = http.MaxBytesReader(nil, r.Body, maxSaveSecretBodyBytes)

	var payload struct {
		SecretMessage string `json:"secretMessage"`
		HashedKey     string `json:"hashedKey"`
		Duration      int    `json:"duration"`
		Views         int    `json:"views"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		err := dec.Decode(&payload)
		if err == nil {
			if len(payload.SecretMessage) > 0 && len(payload.HashedKey) > 0 {

				newMessage := StoredMessage{
					Encrypted: true,
					Message:   payload.SecretMessage,
					HashedKey: payload.HashedKey,
				}
				views := clampViews(payload.Views)
				// Single view stays 0 so default records match the legacy shape.
				if views != 1 {
					newMessage.Views = views
				}

				if payload.Duration <= 0 || payload.Duration > maxDuration {
					payload.Duration = defaultDuration
				}

				if DEBUG {
					log.Printf("payload -> storage: %v, HashedKey: %v, Duration: %v\n", payload.SecretMessage, payload.HashedKey, payload.Duration)
				}
				valueToStore, _ := json.Marshal(newMessage)
				storeKey, err := saveToStorageFunc(valueToStore, time.Duration(payload.Duration)*time.Second, views)
				if err == nil {
					jResponse.NewId = storeKey
					jResponse.Status = "ok"
				} else {
					log.Println(err)
				}

			}
		} else {
			log.Println(err)
		}
		// log.Printf("Got payload: %v\n", payload)
	}
	response, _ = json.Marshal(jResponse)
	return
}

/*
*
Good to have this api for everyone

func apiGetRandomPass(r *http.Request) (responseCode int, response []byte) {

}
*/
func apiGetMessage(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200

	jResponse := struct {
		Status         string `json:"status"`
		CryptedMessage string `json:"cryptedMessage"`
		ViewsLeft      int    `json:"viewsLeft"`
		ExpiresIn      int    `json:"expiresIn"`
	}{
		Status: "error",
		// NewId:strconv.FormatInt(32, 16)
		CryptedMessage: "0",
	}

	r.Body = http.MaxBytesReader(nil, r.Body, maxLookupBodyBytes)

	var payload struct {
		Id        string `json:"id"`
		HashedKey string `json:"hashedKey"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		err := dec.Decode(&payload)
		if err == nil {
			// Reject ids/keys that cannot be ours before building a Redis key.
			// A malformed id cannot name an existing secret ("no message"); a
			// malformed key can never match ("wrong key"). Both mirror what the
			// storage layer would answer, so no new response shape is introduced.
			if !isValidStorageID(payload.Id) {
				jResponse.Status = "no message"
			} else if !isValidHashedKey(payload.HashedKey) {
				jResponse.Status = "wrong key"
			} else {
				if DEBUG {
					log.Printf("payload <- storage: %v, %v\n", payload.Id, payload.HashedKey)
				}
				storedMessage, viewsLeft, expiresIn, status, err := consumeMessageFromStorageFunc(payload.Id, payload.HashedKey)
				if err == nil {
					switch status {
					case "ok":
						jResponse.Status = "ok"
						jResponse.CryptedMessage = storedMessage.Message
						jResponse.ViewsLeft = viewsLeft
						jResponse.ExpiresIn = expiresIn
					case "wrong key":
						jResponse.Status = "wrong key"
						log.Println("Hashes aren't equal")
					case "no message":
						jResponse.Status = "no message"
					}
				} else if errors.Is(err, errConsumeMessageContention) {
					responseCode = http.StatusServiceUnavailable
					jResponse.Status = "retry"
				} else {
					log.Println(err)
				}

			}
		}
	}
	response, _ = json.Marshal(jResponse)
	return
}

// apiSecretStatus reports, for a batch of ids, whether each secret still exists
// in storage. It is NON-CONSUMING: it never reads or deletes a secret, requires
// no hashedKey, and returns only existence. A secret that was consumed or
// expired is already gone from Redis, so it reports false.
func apiSecretStatus(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200

	jResponse := struct {
		Status  string          `json:"status"`
		Secrets map[string]bool `json:"secrets"`
	}{
		Status:  "error",
		Secrets: map[string]bool{},
	}

	r.Body = http.MaxBytesReader(nil, r.Body, maxStatusBodyBytes)

	var payload struct {
		Ids []string `json:"ids"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		if err := dec.Decode(&payload); err == nil {
			// Keep only well-formed storage ids, capped at maxStatusIDs.
			ids := make([]string, 0, len(payload.Ids))
			for _, id := range payload.Ids {
				if !isValidStorageID(id) {
					continue
				}
				ids = append(ids, id)
				if len(ids) >= maxStatusIDs {
					break
				}
			}
			statuses, err := secretsExistFunc(ids)
			if err == nil {
				jResponse.Status = "ok"
				jResponse.Secrets = statuses
			} else {
				log.Println(err)
			}
		} else {
			log.Println(err)
		}
	}

	response, _ = json.Marshal(jResponse)
	return
}

func apiSaveSecretFile(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200
	jResponse := struct {
		Status string `json:"status"`
		NewId  string `json:"newId"`
	}{Status: "error", NewId: "0"}

	r.Body = http.MaxBytesReader(nil, r.Body, maxFileSize+1024) // file + form fields

	if err := r.ParseMultipartForm(maxMultipartMemory); err != nil {
		if r.MultipartForm != nil {
			if removeErr := r.MultipartForm.RemoveAll(); removeErr != nil {
				log.Printf("RemoveAll error: %v", removeErr)
			}
		}
		log.Printf("ParseMultipartForm error: %v", err)
		response, _ = json.Marshal(jResponse)
		return
	}
	defer func() {
		if r.MultipartForm == nil {
			return
		}
		if err := r.MultipartForm.RemoveAll(); err != nil {
			log.Printf("RemoveAll error: %v", err)
		}
	}()

	hashedKey := r.FormValue("hashedKey")
	durationStr := r.FormValue("duration")

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		log.Printf("FormFile error: %v", err)
		response, _ = json.Marshal(jResponse)
		return
	}
	defer file.Close()

	if hashedKey == "" {
		response, _ = json.Marshal(jResponse)
		return
	}

	// Parse duration
	duration := defaultDuration
	if durationStr != "" {
		if d, err := strconv.Atoi(durationStr); err == nil && d > 0 && d <= maxDuration {
			duration = d
		}
	}

	if DEBUG {
		log.Printf("payload -> file storage: %v bytes, HashedKey: %v, Duration: %v\n", fileHeader.Size, hashedKey, duration)
	}

	// Ensure storage dir exists
	if err := os.MkdirAll(fileStorageDir, 0750); err != nil {
		log.Printf("MkdirAll error: %v", err)
		response, _ = json.Marshal(jResponse)
		return
	}
	ttl := time.Duration(duration) * time.Second

	for attempt := 0; attempt < maxStorageIDAttempts; attempt++ {
		now := time.Now().UTC()
		storeKey, err := generateStorageID()
		if err != nil {
			log.Printf("generateStorageID error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}

		filePath := filepath.Join(fileStorageDir, storeKey+".enc")
		if _, err := file.Seek(0, io.SeekStart); err != nil {
			log.Printf("Seek error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}

		storedFile, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			if os.IsExist(err) {
				continue
			}

			log.Printf("OpenFile error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}

		if _, err := io.Copy(storedFile, file); err != nil {
			_ = storedFile.Close()
			_ = os.Remove(filePath)
			log.Printf("io.Copy error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}

		if err := storedFile.Close(); err != nil {
			_ = os.Remove(filePath)
			log.Printf("Close error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}

		expiresAt := now.Add(ttl)
		if err := os.Chtimes(filePath, now, expiresAt); err != nil {
			_ = os.Remove(filePath)
			log.Printf("Chtimes error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}

		record := StoredFile{
			Encrypted: true,
			FileUri:   filePath,
			HashedKey: hashedKey,
		}
		valueToStore, _ := json.Marshal(record)
		ok, err := setFileRecordFunc(storeKey, valueToStore, ttl)
		if err != nil {
			_ = os.Remove(filePath)
			log.Printf("SetNX error: %v", err)
			response, _ = json.Marshal(jResponse)
			return
		}
		if !ok {
			_ = os.Remove(filePath)
			continue
		}

		if err := incrementStoredFileCountersFunc(now); err != nil {
			log.Printf("incrementStoredFileCounters error: %v", err)
		}

		jResponse.Status = "ok"
		jResponse.NewId = storeKey
		response, _ = json.Marshal(jResponse)
		return
	}

	log.Printf("apiSaveSecretFile: failed to allocate unique storage id after %d attempts", maxStorageIDAttempts)
	response, _ = json.Marshal(jResponse)
	return
}

// apiGetFile writes directly to ResponseWriter (binary stream)
func apiGetFile(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Id        string `json:"id"`
		HashedKey string `json:"hashedKey"`
	}

	r.Body = http.MaxBytesReader(nil, r.Body, maxLookupBodyBytes)

	dec := json.NewDecoder(r.Body)
	if !dec.More() {
		http.Error(w, `{"status":"error"}`, http.StatusBadRequest)
		return
	}
	// Validate the fixed id/hashedKey shapes before they reach Redis key building.
	if err := dec.Decode(&payload); err != nil || !isValidStorageID(payload.Id) || !isValidHashedKey(payload.HashedKey) {
		http.Error(w, `{"status":"error"}`, http.StatusBadRequest)
		return
	}

	if DEBUG {
		log.Printf("payload <- file storage: %v, %v\n", payload.Id, payload.HashedKey)
	}

	storedFile, status, err := consumeFileMessageFromStorageFunc(payload.Id, payload.HashedKey)
	if err != nil {
		log.Printf("consumeFileMessageFromStorage error: %v", err)
		http.Error(w, `{"status":"error"}`, http.StatusInternalServerError)
		return
	}

	switch status {
	case "wrong key":
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"wrong key"}`))
		return
	case "no message":
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"no message"}`))
		return
	}

	// Stream file to client
	f, err := os.Open(storedFile.FileUri)
	if err != nil {
		log.Printf("Open file error: %v", err)
		http.Error(w, `{"status":"no message"}`, http.StatusInternalServerError)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	if info, statErr := f.Stat(); statErr == nil {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	} else {
		log.Printf("Stat file error: %v", statErr)
	}
	w.WriteHeader(http.StatusOK)
	_, err = io.Copy(w, f)
	if err != nil {
		log.Printf("Couldn't stream the whole file: %v", err)
	}

	// Delete file from disk after streaming
	if err := os.Remove(storedFile.FileUri); err != nil {
		log.Printf("Remove file error: %v", err)
	}
}

func apiHandler(w http.ResponseWriter, r *http.Request) {
	responseCode := 400
	var response []byte
	w.Header().Set("Content-Type", "application/json")

	if DEBUG {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "	content-type, accept")
	}

	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		responseCode = http.StatusMethodNotAllowed
		jResponse := struct {
			Code        int    `json:"code"`
			Description string `json:"description"`
		}{responseCode, "Only POST is allowed for API endpoints"}
		response, _ = json.Marshal(jResponse)
		w.WriteHeader(responseCode)
		_, err := w.Write(response)
		if err != nil {
			log.Println(err)
		}
		return
	}

	apiCall := r.URL.Path[len("/api/"):]
	switch apiCall {
	case "saveSecret":
		responseCode, response = apiSaveSecret(r)
	case "get":
		responseCode, response = apiGetMessage(r)
	case "secretStatus":
		responseCode, response = apiSecretStatus(r)
	case "saveFile":
		responseCode, response = apiSaveSecretFile(r)
	case "getFile":
		apiGetFile(w, r)
		return
	case "stat":
		responseCode, response = apiStat(r)
	case "ss":
		responseCode, response = apiStatSnapshot()
	default:
		jResponse := struct {
			Code        int    `json:"code"`
			Description string `json:"description"`
		}{responseCode, "Not implemented yet"}
		response, _ = json.Marshal(jResponse)
	}
	w.WriteHeader(responseCode)
	if responseCode == http.StatusNoContent || len(response) == 0 {
		return
	}
	_, err := w.Write(response)
	if err != nil {
		log.Println(err)
	}

}
