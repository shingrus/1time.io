package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func restoreHandlerHooks(t *testing.T) {
	t.Helper()

	originalSaveToStorage := saveToStorageFunc
	originalConsumeMessage := consumeMessageFromStorageFunc
	originalConsumeFileMessage := consumeFileMessageFromStorageFunc
	originalSetFileRecord := setFileRecordFunc
	originalIncrementStoredFileCounters := incrementStoredFileCountersFunc

	t.Cleanup(func() {
		saveToStorageFunc = originalSaveToStorage
		consumeMessageFromStorageFunc = originalConsumeMessage
		consumeFileMessageFromStorageFunc = originalConsumeFileMessage
		setFileRecordFunc = originalSetFileRecord
		incrementStoredFileCountersFunc = originalIncrementStoredFileCounters
	})
}

func TestAPIHandlerRequiresPOST(t *testing.T) {
	tests := []string{
		"/api/saveSecret",
		"/api/get",
		"/api/unknown",
	}

	for _, path := range tests {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()

		apiHandler(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s: got status %d, want %d", path, rec.Code, http.StatusMethodNotAllowed)
		}
		if got := rec.Header().Get("Allow"); got != http.MethodPost {
			t.Fatalf("%s: got Allow header %q, want %q", path, got, http.MethodPost)
		}
	}
}

func TestAPIHandlerUnknownPostReturnsNotImplemented(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/unknown", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	apiHandler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got status %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if !strings.Contains(rec.Body.String(), "Not implemented yet") {
		t.Fatalf("body = %s, want not implemented response", rec.Body.String())
	}
}

func TestAPISaveSecretStoresEncryptedPayload(t *testing.T) {
	restoreHandlerHooks(t)

	var stored StoredMessage
	var ttl time.Duration
	saveToStorageFunc = func(value interface{}, duration time.Duration) (string, error) {
		ttl = duration
		raw, ok := value.([]byte)
		if !ok {
			t.Fatalf("stored value type = %T, want []byte", value)
		}
		if err := json.Unmarshal(raw, &stored); err != nil {
			t.Fatalf("stored payload is not StoredMessage JSON: %v", err)
		}
		return "msg123", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(`{"secretMessage":"ciphertext","hashedKey":"hash","duration":60}`))
	responseCode, response := apiSaveSecret(req)

	if responseCode != http.StatusOK {
		t.Fatalf("apiSaveSecret() code = %d, want %d", responseCode, http.StatusOK)
	}
	if !strings.Contains(string(response), `"status":"ok"`) || !strings.Contains(string(response), `"newId":"msg123"`) {
		t.Fatalf("response = %s, want ok with new id", response)
	}
	if !stored.Encrypted || stored.Message != "ciphertext" || stored.HashedKey != "hash" {
		t.Fatalf("stored payload = %#v, want encrypted ciphertext with hash", stored)
	}
	if ttl != 60*time.Second {
		t.Fatalf("ttl = %s, want 60s", ttl)
	}
}

func TestAPISaveSecretRejectsMissingFields(t *testing.T) {
	restoreHandlerHooks(t)

	called := false
	saveToStorageFunc = func(value interface{}, duration time.Duration) (string, error) {
		called = true
		return "unexpected", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(`{"secretMessage":"","hashedKey":"hash","duration":60}`))
	_, response := apiSaveSecret(req)

	if called {
		t.Fatal("saveToStorageFunc should not be called for missing secretMessage")
	}
	if !strings.Contains(string(response), `"status":"error"`) {
		t.Fatalf("response = %s, want error", response)
	}
}

func TestAPIGetMessageStatuses(t *testing.T) {
	tests := []struct {
		name       string
		status     string
		message    string
		wantStatus string
		wantBody   string
	}{
		{name: "ok", status: "ok", message: "ciphertext", wantStatus: `"status":"ok"`, wantBody: `"cryptedMessage":"ciphertext"`},
		{name: "wrong key", status: "wrong key", wantStatus: `"status":"wrong key"`},
		{name: "no message", status: "no message", wantStatus: `"status":"no message"`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)
			consumeMessageFromStorageFunc = func(key string, hashedKey string) (StoredMessage, string, error) {
				if key != "msg123" || hashedKey != "hash" {
					t.Fatalf("consume args = %q, %q; want msg123, hash", key, hashedKey)
				}
				return StoredMessage{Message: tt.message, HashedKey: "hash", Encrypted: true}, tt.status, nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/get", strings.NewReader(`{"id":"msg123","hashedKey":"hash"}`))
			responseCode, response := apiGetMessage(req)

			if responseCode != http.StatusOK {
				t.Fatalf("apiGetMessage() code = %d, want %d", responseCode, http.StatusOK)
			}
			if !strings.Contains(string(response), tt.wantStatus) {
				t.Fatalf("response = %s, missing %s", response, tt.wantStatus)
			}
			if tt.wantBody != "" && !strings.Contains(string(response), tt.wantBody) {
				t.Fatalf("response = %s, missing %s", response, tt.wantBody)
			}
		})
	}
}

func TestAPISaveSecretFileCleansMultipartTempFiles(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("TMPDIR", tempDir)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fileWriter, err := writer.CreateFormFile("file", "oversized.bin")
	if err != nil {
		t.Fatalf("CreateFormFile error: %v", err)
	}

	chunk := bytes.Repeat([]byte("a"), 1024*1024)
	remaining := maxFileSize + 1
	for remaining > 0 {
		nextChunk := len(chunk)
		if remaining < nextChunk {
			nextChunk = remaining
		}
		if _, err := fileWriter.Write(chunk[:nextChunk]); err != nil {
			t.Fatalf("Write file chunk error: %v", err)
		}
		remaining -= nextChunk
	}

	if err := writer.WriteField("duration", "86400"); err != nil {
		t.Fatalf("WriteField error: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close writer error: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveFile", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())

	responseCode, _ := apiSaveSecretFile(req)
	if responseCode != http.StatusOK {
		t.Fatalf("apiSaveSecretFile() code = %d, want %d", responseCode, http.StatusOK)
	}

	entries, err := os.ReadDir(tempDir)
	if err != nil {
		t.Fatalf("ReadDir error: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("temporary multipart files were not cleaned up: %v", entries)
	}
}

func TestAPISaveSecretFileStoresBlobAndRecord(t *testing.T) {
	restoreHandlerHooks(t)

	originalDir := fileStorageDir
	fileStorageDir = t.TempDir()
	t.Cleanup(func() {
		fileStorageDir = originalDir
	})

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileWriter, err := writer.CreateFormFile("file", "secret.enc")
	if err != nil {
		t.Fatalf("CreateFormFile error: %v", err)
	}
	if _, err := fileWriter.Write([]byte("encrypted file bytes")); err != nil {
		t.Fatalf("Write error: %v", err)
	}
	if err := writer.WriteField("hashedKey", "filehash"); err != nil {
		t.Fatalf("WriteField hashedKey error: %v", err)
	}
	if err := writer.WriteField("duration", "120"); err != nil {
		t.Fatalf("WriteField duration error: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close writer error: %v", err)
	}

	var record StoredFile
	var ttl time.Duration
	setFileRecordFunc = func(storeKey string, value interface{}, duration time.Duration) (bool, error) {
		ttl = duration
		raw, ok := value.([]byte)
		if !ok {
			t.Fatalf("file record value type = %T, want []byte", value)
		}
		if err := json.Unmarshal(raw, &record); err != nil {
			t.Fatalf("file record JSON error: %v", err)
		}
		if filepath.Base(record.FileUri) != storeKey+".enc" {
			t.Fatalf("record file path = %q, want basename %s.enc", record.FileUri, storeKey)
		}
		return true, nil
	}
	incrementStoredFileCountersFunc = func(now time.Time) error {
		return nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveFile", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	responseCode, response := apiSaveSecretFile(req)

	if responseCode != http.StatusOK {
		t.Fatalf("apiSaveSecretFile() code = %d, want %d", responseCode, http.StatusOK)
	}
	if !strings.Contains(string(response), `"status":"ok"`) {
		t.Fatalf("response = %s, want ok", response)
	}
	if !record.Encrypted || record.HashedKey != "filehash" {
		t.Fatalf("record = %#v, want encrypted filehash", record)
	}
	if ttl != 120*time.Second {
		t.Fatalf("ttl = %s, want 120s", ttl)
	}
	content, err := os.ReadFile(record.FileUri)
	if err != nil {
		t.Fatalf("ReadFile stored blob error: %v", err)
	}
	if string(content) != "encrypted file bytes" {
		t.Fatalf("stored blob = %q, want encrypted file bytes", content)
	}
}

func TestAPISaveSecretFileRejectsMissingHashedKey(t *testing.T) {
	restoreHandlerHooks(t)

	originalDir := fileStorageDir
	fileStorageDir = t.TempDir()
	t.Cleanup(func() {
		fileStorageDir = originalDir
	})

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileWriter, err := writer.CreateFormFile("file", "secret.enc")
	if err != nil {
		t.Fatalf("CreateFormFile error: %v", err)
	}
	if _, err := fileWriter.Write([]byte("encrypted file bytes")); err != nil {
		t.Fatalf("Write error: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close writer error: %v", err)
	}

	called := false
	setFileRecordFunc = func(storeKey string, value interface{}, duration time.Duration) (bool, error) {
		called = true
		return true, nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveFile", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	_, response := apiSaveSecretFile(req)

	if called {
		t.Fatal("setFileRecordFunc should not be called without hashedKey")
	}
	if !strings.Contains(string(response), `"status":"error"`) {
		t.Fatalf("response = %s, want error", response)
	}
}

func TestAPIGetFileStreamsAndDeletesFile(t *testing.T) {
	restoreHandlerHooks(t)

	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "file.enc")
	if err := os.WriteFile(filePath, []byte("encrypted file bytes"), 0o600); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}
	consumeFileMessageFromStorageFunc = func(key string, hashedKey string) (StoredFile, string, error) {
		if key != "file123" || hashedKey != "filehash" {
			t.Fatalf("consume args = %q, %q; want file123, filehash", key, hashedKey)
		}
		return StoredFile{Encrypted: true, FileUri: filePath, HashedKey: "filehash"}, "ok", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"file123","hashedKey":"filehash"}`))
	rec := httptest.NewRecorder()
	apiGetFile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("apiGetFile() code = %d, want %d", rec.Code, http.StatusOK)
	}
	if rec.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("Content-Type = %q, want application/octet-stream", rec.Header().Get("Content-Type"))
	}
	if rec.Body.String() != "encrypted file bytes" {
		t.Fatalf("body = %q, want encrypted file bytes", rec.Body.String())
	}
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Fatalf("file should be deleted after stream, stat err=%v", err)
	}
}

func TestAPIGetFileReturnsJSONStatuses(t *testing.T) {
	tests := []string{"wrong key", "no message"}
	for _, status := range tests {
		t.Run(status, func(t *testing.T) {
			restoreHandlerHooks(t)
			consumeFileMessageFromStorageFunc = func(key string, hashedKey string) (StoredFile, string, error) {
				return StoredFile{}, status, nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"file123","hashedKey":"filehash"}`))
			rec := httptest.NewRecorder()
			apiGetFile(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("apiGetFile() code = %d, want %d", rec.Code, http.StatusOK)
			}
			if !strings.Contains(rec.Body.String(), `"status":"`+status+`"`) {
				t.Fatalf("body = %s, want status %q", rec.Body.String(), status)
			}
		})
	}
}

func TestAPIGetFileRejectsBadPayload(t *testing.T) {
	restoreHandlerHooks(t)

	called := false
	consumeFileMessageFromStorageFunc = func(key string, hashedKey string) (StoredFile, string, error) {
		called = true
		return StoredFile{}, "ok", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"","hashedKey":"filehash"}`))
	rec := httptest.NewRecorder()
	apiGetFile(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("apiGetFile() code = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if called {
		t.Fatal("consumeFileMessageFromStorageFunc should not be called for bad payload")
	}
}
