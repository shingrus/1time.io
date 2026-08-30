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
	// Version selects how HashedKey is compared. 0 (every record written before
	// the v3 rollout) means HashedKey is the read token itself; secretSchemeV3
	// means it is SHA-256 of that token. See tokenMatchesStored.
	Version int `json:"v,omitempty"`
}

// maxViews caps the per-secret view count accepted by the API. It also bounds
// how many times a single stored ciphertext can be retrieved, so there is no
// unbounded-download ("unlimited views") amplification vector.
const maxViews = 10

type StoredFile struct {
	Encrypted bool   `json:"encrypted"`
	FileUri   string `json:"fileUri"`
	HashedKey string `json:"hashedKey"`
	// Views is the number of downloads remaining. Missing/0 and 1 both mean
	// the legacy single-download behaviour.
	Views int `json:"views,omitempty"`
	// Version selects how HashedKey is compared; see StoredMessage.Version.
	Version int `json:"v,omitempty"`
}

// apiVersion identifies the HTTP API surface exposed under /api/.
const apiVersion = 1

// supportedSaveSchemes lists what resolveSaveScheme accepts, newest last, for
// /api/ss.
func supportedSaveSchemes() []int {
	return []int{0, secretSchemeV3}
}

// resolveSaveScheme decides what a save request wants stored and under which
// scheme, for both the JSON text path and the multipart file path.
//
func resolveSaveScheme(legacyHashedKey, readTokenHash string, version int) (stored string, scheme int, ok bool) {
	switch version {
	case secretSchemeV3:
		if legacyHashedKey != "" {
			return "", 0, false
		}

		if !isValidHashedKey(readTokenHash) {
			return "", 0, false
		}

		return readTokenHash, secretSchemeV3, true

	case 0:
		if readTokenHash != "" || legacyHashedKey == "" {
			return "", 0, false
		}

		return legacyHashedKey, 0, true

	default:
		return "", 0, false
	}
}

const (
	// maxFileSize is the advertised limit on the ORIGINAL plaintext file, matched
	// by Constants.maxFileSizeBytes on the frontend. Nothing in the backend can
	// check it directly — the server only ever sees ciphertext.
	maxFileSize = 80 * 1024 * 1024
	// fileUploadOverheadBytes covers what rides along with the ciphertext: the
	// AES-GCM 12-byte IV and 16-byte tag, multipart boundaries, and the hashedKey,
	// duration and views form fields.
	fileUploadOverheadBytes = 1024 * 1024
	// maxFileUploadBodyBytes is what MaxBytesReader actually enforces. Derived from
	// maxFileSize so the two cannot silently diverge. Keep nginx's
	// client_max_body_size equal to this (81m) so both reject at the same point.
	maxFileUploadBodyBytes = maxFileSize + fileUploadOverheadBytes
	maxMultipartMemory     = 4 * 1024 * 1024
)
const maxFileViews = 10

// maxStatusIDs bounds how many ids /api/secretStatus will check per request.
const maxStatusIDs = 128

// maxStatusBodyBytes caps the /api/secretStatus request body. 128 ids of 22
const maxStatusBodyBytes = 8 * 1024

// maxSaveSecretBodyBytes caps the /api/saveSecret request body. base64url adds ~4/3 expansion on top of AES-GCM
const maxSaveSecretBodyBytes = 25 * 1024 * 1024

// maxLookupBodyBytes caps the small JSON bodies of the lookup endpoints
const maxLookupBodyBytes = 1024

var fileStorageDir = os.Getenv("FILE_STORAGE_DIR")

var (
	saveToStorageFunc             = saveToStorage
	consumeMessageFromStorageFunc = consumeMessageFromStorage
	reserveFileDownloadFunc       = reserveFileDownload
	setFileRecordFunc             = func(storeKey string, value interface{}, ttl time.Duration) (bool, error) {
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

	// Unknown fields are ignored on purpose (encoding/json's default), so a
	// later addition such as manageTokenHash needs no version bump here.
	var payload struct {
		SecretMessage string `json:"secretMessage"`
		HashedKey     string `json:"hashedKey"`
		ReadTokenHash string `json:"readTokenHash"`
		Version       int    `json:"v"`
		Duration      int    `json:"duration"`
		Views         int    `json:"views"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		err := dec.Decode(&payload)
		if err == nil {
			readTokenHash, scheme, schemeOK := resolveSaveScheme(payload.HashedKey, payload.ReadTokenHash, payload.Version)
			if len(payload.SecretMessage) > 0 && schemeOK {

				newMessage := StoredMessage{
					Encrypted: true,
					Message:   payload.SecretMessage,
					HashedKey: readTokenHash,
					Version:   scheme,
				}
				views := min(max(payload.Views, 1), maxViews)
				// Single view stays 0 so default records match the legacy shape.
				if views != 1 {
					newMessage.Views = views
				}

				if payload.Duration <= 0 || payload.Duration > maxDuration {
					payload.Duration = defaultDuration
				}

				if DEBUG {
					log.Printf("payload -> storage: %v, stored key: %v, scheme: %v, Duration: %v\n", payload.SecretMessage, readTokenHash, scheme, payload.Duration)
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

	r.Body = http.MaxBytesReader(nil, r.Body, maxFileUploadBodyBytes)

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
	submittedHash := r.FormValue("readTokenHash")
	schemeVersion, _ := strconv.Atoi(r.FormValue("v"))
	durationStr := r.FormValue("duration")
	viewsStr := r.FormValue("views")

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		log.Printf("FormFile error: %v", err)
		response, _ = json.Marshal(jResponse)
		return
	}
	defer file.Close()

	readTokenHash, scheme, schemeOK := resolveSaveScheme(hashedKey, submittedHash, schemeVersion)
	if !schemeOK {
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
	views := 1
	if parsedViews, err := strconv.Atoi(viewsStr); err == nil {
		views = min(max(parsedViews, 1), maxFileViews)
	}

	if DEBUG {
		log.Printf("payload -> file storage: %v bytes, stored key: %v, scheme: %v, Duration: %v\n", fileHeader.Size, readTokenHash, scheme, duration)
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
			HashedKey: readTokenHash,
			Version:   scheme,
		}
		if views != 1 {
			record.Views = views
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

		if err := incrementStoredFileCountersFunc(views, now); err != nil {
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
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Access-Control-Expose-Headers", "X-1Time-Views-Left, X-1Time-Expires-In")

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

	reservation, status, err := reserveFileDownloadFunc(payload.Id, payload.HashedKey)
	if err != nil {
		if errors.Is(err, errConsumeMessageContention) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"retry"}`))
			return
		}
		log.Printf("reserveFileDownload error: %v", err)
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

	defer reservation.File.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-1Time-Views-Left", strconv.Itoa(reservation.ViewsLeft))
	if reservation.ExpiresInSeconds > 0 {
		w.Header().Set("X-1Time-Expires-In", strconv.Itoa(reservation.ExpiresInSeconds))
	}
	if info, statErr := reservation.File.Stat(); statErr == nil {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	} else {
		log.Printf("Stat file error: %v", statErr)
	}
	w.WriteHeader(http.StatusOK)
	_, err = io.Copy(w, reservation.File)
	if err != nil {
		log.Printf("Couldn't stream the whole file: %v", err)
	}
	if reservation.ViewsLeft == 0 {
		// Other successful reservations already hold open descriptors, so
		// unlinking the path after the final stream attempt does not interrupt
		// their reads on POSIX.
		if err := os.Remove(reservation.StoredFile.FileUri); err != nil && !os.IsNotExist(err) {
			log.Printf("Remove file error: %v", err)
		}
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
