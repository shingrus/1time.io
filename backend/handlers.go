package main

import (
	"encoding/json"
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
}

type StoredFile struct {
	Encrypted bool   `json:"encrypted"`
	FileUri   string `json:"fileUri"`
	HashedKey string `json:"hashedKey"`
}

const maxFileSize = 10 * 1024 * 1024 // 10MB

var fileStorageDir = os.Getenv("FILE_STORAGE_DIR")

func apiSaveSecret(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200

	jResponse := struct {
		Status string `json:"status"`
		NewId  string `json:"newId"`
	}{
		Status: "error",
		NewId:  "0",
	}

	var payload struct {
		SecretMessage string `json:"secretMessage"`
		HashedKey     string `json:"hashedKey"`
		Duration      int    `json:"duration"`
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

				if payload.Duration <= 0 || payload.Duration > maxDuration {
					payload.Duration = defaultDuration
				}

				if DEBUG {
					log.Printf("payload -> storage: %v, HashedKey: %v, Duration: %v\n", payload.SecretMessage, payload.HashedKey, payload.Duration)
				}
				valueToStore, _ := json.Marshal(newMessage)
				storeKey, err := saveToStorage(valueToStore, time.Duration(payload.Duration)*time.Second)
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
	}{
		Status: "error",
		// NewId:strconv.FormatInt(32, 16)
		CryptedMessage: "0",
	}

	var payload struct {
		Id        string `json:"id"`
		HashedKey string `json:"hashedKey"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		err := dec.Decode(&payload)
		if err == nil {
			if len(payload.Id) > 0 && len(payload.HashedKey) > 0 {
				if DEBUG {
					log.Printf("payload <- storage: %v, %v\n", payload.Id, payload.HashedKey)
				}
				storedMessage, status, err := consumeMessageFromStorage(payload.Id, payload.HashedKey)
				if err == nil {
					switch status {
					case "ok":
						jResponse.Status = "ok"
						jResponse.CryptedMessage = storedMessage.Message
					case "wrong key":
						jResponse.Status = "wrong key"
						log.Println("Hashes aren't equal")
					case "no message":
						jResponse.Status = "no message"
					}
				} else {
					log.Println(err)
				}

			}
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

	if err := r.ParseMultipartForm(maxFileSize); err != nil {
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
		ok, err := getRedisClient().SetNX(getFileStoreKey(storeKey), valueToStore, ttl).Result()
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

		if err := incrementStoredFileCounters(now); err != nil {
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

	dec := json.NewDecoder(r.Body)
	if !dec.More() {
		http.Error(w, `{"status":"error"}`, http.StatusBadRequest)
		return
	}
	if err := dec.Decode(&payload); err != nil || payload.Id == "" || payload.HashedKey == "" {
		http.Error(w, `{"status":"error"}`, http.StatusBadRequest)
		return
	}

	if DEBUG {
		log.Printf("payload <- file storage: %v, %v\n", payload.Id, payload.HashedKey)
	}

	storedFile, status, err := consumeFileMessageFromStorage(payload.Id, payload.HashedKey)
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
