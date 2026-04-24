package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

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

func TestAPIFrontConfigReturnsVAPIDPublicKey(t *testing.T) {
	t.Setenv(vapidPublicKeyEnv, "public-test-key")
	t.Setenv(vapidPrivateKeyEnv, "private-test-key")
	t.Setenv(vapidSubjectEnv, "admin@example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/frontConfig", nil)
	rec := httptest.NewRecorder()

	apiHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", rec.Code, http.StatusOK)
	}

	var response struct {
		VAPIDPublicKey string `json:"vapidPublicKey"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if response.VAPIDPublicKey != "public-test-key" {
		t.Fatalf("vapidPublicKey = %q, want %q", response.VAPIDPublicKey, "public-test-key")
	}
}

func TestAPIFrontConfigHidesPartialVAPIDConfig(t *testing.T) {
	tests := []struct {
		name       string
		publicKey  string
		privateKey string
		subject    string
	}{
		{name: "public only", publicKey: "public-test-key"},
		{name: "private only", privateKey: "private-test-key"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv(vapidPublicKeyEnv, test.publicKey)
			t.Setenv(vapidPrivateKeyEnv, test.privateKey)
			t.Setenv(vapidSubjectEnv, test.subject)

			req := httptest.NewRequest(http.MethodPost, "/api/frontConfig", nil)
			rec := httptest.NewRecorder()

			apiHandler(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("got status %d, want %d", rec.Code, http.StatusOK)
			}

			var response struct {
				VAPIDPublicKey string `json:"vapidPublicKey"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatalf("Unmarshal error: %v", err)
			}
			if response.VAPIDPublicKey != "" {
				t.Fatalf("vapidPublicKey = %q, want empty", response.VAPIDPublicKey)
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
