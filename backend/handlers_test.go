package main

import (
	"bytes"
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
