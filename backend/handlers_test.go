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

// Lookup fixtures in the shapes the handlers now enforce: ids are 22-char
// base64url (see generateStorageID) and hashed keys are 64-char lowercase hex.
const (
	testStorageID = "msg123AAAAAAAAAAAAAAAA"
	testHashedKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	testFileID    = "file123BBBBBBBBBBBBBBB"
	testFileHash  = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
)

func restoreHandlerHooks(t *testing.T) {
	t.Helper()

	originalSaveToStorage := saveToStorageFunc
	originalConsumeMessage := consumeMessageFromStorageFunc
	originalReserveFileDownload := reserveFileDownloadFunc
	originalSetFileRecord := setFileRecordFunc
	originalIncrementStoredFileCounters := incrementStoredFileCountersFunc
	originalSecretsExist := secretsExistFunc
	originalIncrementStoredSecretCounters := incrementStoredSecretCountersFunc

	// Stats are a side effect of saving; stub them out so tests do not need Redis.
	incrementStoredSecretCountersFunc = func(views int, now time.Time) error { return nil }

	t.Cleanup(func() {
		saveToStorageFunc = originalSaveToStorage
		consumeMessageFromStorageFunc = originalConsumeMessage
		reserveFileDownloadFunc = originalReserveFileDownload
		setFileRecordFunc = originalSetFileRecord
		incrementStoredFileCountersFunc = originalIncrementStoredFileCounters
		secretsExistFunc = originalSecretsExist
		incrementStoredSecretCountersFunc = originalIncrementStoredSecretCounters
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
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
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

	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(`{"secretMessage":"ciphertext","hashedKey":"`+testHashedKey+`","duration":60}`))
	responseCode, response := apiSaveSecret(req)

	if responseCode != http.StatusOK {
		t.Fatalf("apiSaveSecret() code = %d, want %d", responseCode, http.StatusOK)
	}
	if !strings.Contains(string(response), `"status":"ok"`) || !strings.Contains(string(response), `"newId":"msg123"`) {
		t.Fatalf("response = %s, want ok with new id", response)
	}
	if !stored.Encrypted || stored.Message != "ciphertext" || stored.HashedKey != testHashedKey {
		t.Fatalf("stored payload = %#v, want encrypted ciphertext with hash", stored)
	}
	if ttl != 60*time.Second {
		t.Fatalf("ttl = %s, want 60s", ttl)
	}
}

func TestAPISaveSecretStoresClampedViews(t *testing.T) {
	tests := []struct {
		name      string
		payload   string
		wantViews int
	}{
		{name: "absent views stays legacy shape", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60}`, wantViews: 0},
		{name: "explicit single view stays legacy shape", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":1}`, wantViews: 0},
		{name: "multi view stored as-is", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":5}`, wantViews: 5},
		{name: "maximum views stored as-is", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":10}`, wantViews: maxViews},
		{name: "former unlimited sentinel collapses to single view", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":-1}`, wantViews: 0},
		{name: "oversized clamped to max", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":5000}`, wantViews: maxViews},
		{name: "garbage negative collapses to single view", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":-7}`, wantViews: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)

			var stored StoredMessage
			saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
				if err := json.Unmarshal(value.([]byte), &stored); err != nil {
					t.Fatalf("stored payload is not StoredMessage JSON: %v", err)
				}
				return "msg123", nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(tt.payload))
			if _, response := apiSaveSecret(req); !strings.Contains(string(response), `"status":"ok"`) {
				t.Fatalf("response = %s, want ok", response)
			}
			if stored.Views != tt.wantViews {
				t.Fatalf("stored.Views = %d, want %d", stored.Views, tt.wantViews)
			}
		})
	}
}

// The handler's stats responsibility is to hand the clamped view count to the
// storage layer, which records it together with the stored-secret counters.
func TestAPISaveSecretPassesClampedViewsToStorage(t *testing.T) {
	tests := []struct {
		name      string
		payload   string
		wantViews int
	}{
		{name: "absent views passes single view", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60}`, wantViews: 1},
		{name: "multi view passed as-is", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":5}`, wantViews: 5},
		{name: "maximum views passed as-is", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":10}`, wantViews: maxViews},
		{name: "previous maximum clamped", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":100}`, wantViews: maxViews},
		{name: "passed after clamping", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":5000}`, wantViews: maxViews},
		{name: "negative collapses to single view", payload: `{"secretMessage":"c","hashedKey":"` + testHashedKey + `","duration":60,"views":-1}`, wantViews: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)

			gotViews := 0
			calls := 0
			saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
				calls++
				gotViews = views
				return "msg123", nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(tt.payload))
			if _, response := apiSaveSecret(req); !strings.Contains(string(response), `"status":"ok"`) {
				t.Fatalf("response = %s, want ok", response)
			}
			if calls != 1 {
				t.Fatalf("saveToStorage calls = %d, want 1", calls)
			}
			if gotViews != tt.wantViews {
				t.Fatalf("views passed to storage = %d, want %d", gotViews, tt.wantViews)
			}
		})
	}
}

func TestAPISaveSecretRejectsMissingFields(t *testing.T) {
	restoreHandlerHooks(t)

	called := false
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
		called = true
		return "unexpected", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(`{"secretMessage":"","hashedKey":"`+testHashedKey+`","duration":60}`))
	_, response := apiSaveSecret(req)

	if called {
		t.Fatal("saveToStorageFunc should not be called for missing secretMessage")
	}
	if !strings.Contains(string(response), `"status":"error"`) {
		t.Fatalf("response = %s, want error", response)
	}
}

func TestAPISaveSecretRejectsOversizedBody(t *testing.T) {
	restoreHandlerHooks(t)

	called := false
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
		called = true
		return "unexpected", nil
	}

	// A secretMessage larger than the body cap should be rejected before storage.
	oversized := strings.Repeat("A", maxSaveSecretBodyBytes+1)
	body := `{"secretMessage":"` + oversized + `","hashedKey":"` + testHashedKey + `","duration":60}`
	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(body))
	_, response := apiSaveSecret(req)

	if called {
		t.Fatal("saveToStorageFunc should not be called for an oversized body")
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
		viewsLeft  int
		expiresIn  int
		wantStatus string
		wantBody   string
	}{
		{name: "ok", status: "ok", message: "ciphertext", wantStatus: `"status":"ok"`, wantBody: `"cryptedMessage":"ciphertext"`},
		{name: "ok multi-view", status: "ok", message: "ciphertext", viewsLeft: 4, expiresIn: 259200, wantStatus: `"status":"ok"`, wantBody: `"expiresIn":259200`},
		{name: "wrong key", status: "wrong key", wantStatus: `"status":"wrong key"`},
		{name: "no message", status: "no message", wantStatus: `"status":"no message"`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)
			consumeMessageFromStorageFunc = func(key string, hashedKey string) (StoredMessage, int, int, string, error) {
				if key != testStorageID || hashedKey != testHashedKey {
					t.Fatalf("consume args = %q, %q; want %q, %q", key, hashedKey, testStorageID, testHashedKey)
				}
				return StoredMessage{Message: tt.message, HashedKey: testHashedKey, Encrypted: true}, tt.viewsLeft, tt.expiresIn, tt.status, nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/get", strings.NewReader(`{"id":"`+testStorageID+`","hashedKey":"`+testHashedKey+`"}`))
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

func TestAPIGetMessageRejectsMalformedLookups(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus string
	}{
		{name: "empty id", body: `{"id":"","hashedKey":"` + testHashedKey + `"}`, wantStatus: `"status":"no message"`},
		{name: "short id", body: `{"id":"abc","hashedKey":"` + testHashedKey + `"}`, wantStatus: `"status":"no message"`},
		{name: "id with redis wildcard", body: `{"id":"msg123AAAAAAAAAAAAAA*","hashedKey":"` + testHashedKey + `"}`, wantStatus: `"status":"no message"`},
		{name: "empty hashed key", body: `{"id":"` + testStorageID + `","hashedKey":""}`, wantStatus: `"status":"wrong key"`},
		{name: "non hex hashed key", body: `{"id":"` + testStorageID + `","hashedKey":"` + strings.Repeat("z", 64) + `"}`, wantStatus: `"status":"wrong key"`},
		{name: "oversized body", body: `{"id":"` + strings.Repeat("A", maxLookupBodyBytes+1) + `","hashedKey":"h"}`, wantStatus: `"status":"error"`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)
			called := false
			consumeMessageFromStorageFunc = func(key string, hashedKey string) (StoredMessage, int, int, string, error) {
				called = true
				return StoredMessage{}, 0, 0, "ok", nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/get", strings.NewReader(tt.body))
			responseCode, response := apiGetMessage(req)

			if called {
				t.Fatal("malformed lookup reached storage")
			}
			if responseCode != http.StatusOK {
				t.Fatalf("code = %d, want %d", responseCode, http.StatusOK)
			}
			if !strings.Contains(string(response), tt.wantStatus) {
				t.Fatalf("response = %s, want %s", response, tt.wantStatus)
			}
		})
	}
}

func TestAPIGetFileRejectsMalformedLookups(t *testing.T) {
	for _, tt := range []struct {
		name string
		body string
	}{
		{name: "short id", body: `{"id":"abc","hashedKey":"` + testFileHash + `"}`},
		{name: "non hex hashed key", body: `{"id":"` + testFileID + `","hashedKey":"nope"}`},
		{name: "oversized body", body: `{"id":"` + strings.Repeat("A", maxLookupBodyBytes+1) + `","hashedKey":"h"}`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)
			called := false
			reserveFileDownloadFunc = func(key string, hashedKey string) (FileDownloadReservation, string, error) {
				called = true
				return FileDownloadReservation{}, "ok", nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			apiGetFile(rec, req)

			if called {
				t.Fatal("malformed lookup reached storage")
			}
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("code = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestAPIGetMessageReturnsRetryableContention(t *testing.T) {
	restoreHandlerHooks(t)
	consumeMessageFromStorageFunc = func(key string, hashedKey string) (StoredMessage, int, int, string, error) {
		return StoredMessage{}, 0, 0, "retry", errConsumeMessageContention
	}

	req := httptest.NewRequest(http.MethodPost, "/api/get", strings.NewReader(`{"id":"`+testStorageID+`","hashedKey":"`+testHashedKey+`"}`))
	responseCode, response := apiGetMessage(req)

	if responseCode != http.StatusServiceUnavailable {
		t.Fatalf("apiGetMessage() code = %d, want %d", responseCode, http.StatusServiceUnavailable)
	}
	if !strings.Contains(string(response), `"status":"retry"`) {
		t.Fatalf("response = %s, want retry status", response)
	}
}

func TestAPISecretStatusReturnsExistenceMap(t *testing.T) {
	restoreHandlerHooks(t)

	idA, _ := generateStorageID()
	idB, _ := generateStorageID()

	var gotIDs []string
	secretsExistFunc = func(ids []string) (map[string]bool, error) {
		gotIDs = ids
		return map[string]bool{idA: true, idB: false}, nil
	}

	body, _ := json.Marshal(struct {
		Ids []string `json:"ids"`
	}{Ids: []string{idA, idB}})

	req := httptest.NewRequest(http.MethodPost, "/api/secretStatus", bytes.NewReader(body))
	responseCode, response := apiSecretStatus(req)

	if responseCode != http.StatusOK {
		t.Fatalf("apiSecretStatus() code = %d, want %d", responseCode, http.StatusOK)
	}
	if len(gotIDs) != 2 || gotIDs[0] != idA || gotIDs[1] != idB {
		t.Fatalf("secretsExist got ids %v, want [%s %s]", gotIDs, idA, idB)
	}

	var parsed struct {
		Status  string          `json:"status"`
		Secrets map[string]bool `json:"secrets"`
	}
	if err := json.Unmarshal(response, &parsed); err != nil {
		t.Fatalf("response is not JSON: %v (%s)", err, response)
	}
	if parsed.Status != "ok" {
		t.Fatalf("status = %q, want ok", parsed.Status)
	}
	if parsed.Secrets[idA] != true || parsed.Secrets[idB] != false {
		t.Fatalf("secrets = %v, want %s:true %s:false", parsed.Secrets, idA, idB)
	}
}

func TestAPISecretStatusCapsIDs(t *testing.T) {
	restoreHandlerHooks(t)

	var gotLen int
	secretsExistFunc = func(ids []string) (map[string]bool, error) {
		gotLen = len(ids)
		return map[string]bool{}, nil
	}

	ids := make([]string, maxStatusIDs+50)
	for i := range ids {
		id, err := generateStorageID()
		if err != nil {
			t.Fatalf("generateStorageID error: %v", err)
		}
		ids[i] = id
	}
	body, _ := json.Marshal(struct {
		Ids []string `json:"ids"`
	}{Ids: ids})

	req := httptest.NewRequest(http.MethodPost, "/api/secretStatus", bytes.NewReader(body))
	if _, response := apiSecretStatus(req); !strings.Contains(string(response), `"status":"ok"`) {
		t.Fatalf("response = %s, want ok", response)
	}
	if gotLen != maxStatusIDs {
		t.Fatalf("secretsExist got %d ids, want capped at %d", gotLen, maxStatusIDs)
	}
}

func TestAPISecretStatusFiltersInvalidIDs(t *testing.T) {
	restoreHandlerHooks(t)

	var got []string
	secretsExistFunc = func(ids []string) (map[string]bool, error) {
		got = ids
		return map[string]bool{}, nil
	}

	valid, err := generateStorageID()
	if err != nil {
		t.Fatalf("generateStorageID error: %v", err)
	}
	body, _ := json.Marshal(struct {
		Ids []string `json:"ids"`
	}{Ids: []string{valid, "tooshort", "bad*chars/not+base64url", "", valid + "extra"}})

	req := httptest.NewRequest(http.MethodPost, "/api/secretStatus", bytes.NewReader(body))
	if _, response := apiSecretStatus(req); !strings.Contains(string(response), `"status":"ok"`) {
		t.Fatalf("response = %s, want ok", response)
	}
	if len(got) != 1 || got[0] != valid {
		t.Fatalf("secretsExist got %v, want only the valid id %q", got, valid)
	}
}

func TestAPISecretStatusRejectsOversizedBody(t *testing.T) {
	restoreHandlerHooks(t)

	called := false
	secretsExistFunc = func(ids []string) (map[string]bool, error) {
		called = true
		return map[string]bool{}, nil
	}

	huge := strings.Repeat("a", maxStatusBodyBytes+100)
	req := httptest.NewRequest(http.MethodPost, "/api/secretStatus", strings.NewReader(`{"ids":["`+huge+`"]}`))
	_, response := apiSecretStatus(req)

	if called {
		t.Fatal("secretsExist must not be called when the body exceeds maxStatusBodyBytes")
	}
	if !strings.Contains(string(response), `"status":"error"`) {
		t.Fatalf("response = %s, want error", response)
	}
}

func TestIsValidStorageID(t *testing.T) {
	valid, err := generateStorageID()
	if err != nil {
		t.Fatalf("generateStorageID error: %v", err)
	}
	if !isValidStorageID(valid) {
		t.Fatalf("generated id %q should be valid", valid)
	}

	for _, bad := range []string{
		"",
		"short",
		valid + "x",                // too long
		valid[:len(valid)-1],       // too short
		"has space" + valid[9:],    // right length, illegal char (space)
		valid[:len(valid)-1] + "+", // right length, illegal base64url char (+)
	} {
		if isValidStorageID(bad) {
			t.Fatalf("id %q should be invalid", bad)
		}
	}
}

func TestAPISecretStatusReportsBackendError(t *testing.T) {
	restoreHandlerHooks(t)

	secretsExistFunc = func(ids []string) (map[string]bool, error) {
		return nil, errStorageIDCollision
	}

	req := httptest.NewRequest(http.MethodPost, "/api/secretStatus", strings.NewReader(`{"ids":["a"]}`))
	responseCode, response := apiSecretStatus(req)

	if responseCode != http.StatusOK {
		t.Fatalf("code = %d, want %d", responseCode, http.StatusOK)
	}
	if !strings.Contains(string(response), `"status":"error"`) {
		t.Fatalf("response = %s, want error status", response)
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
	// Must exceed the wire limit, not the advertised plaintext limit — the body cap
	// is what MaxBytesReader actually enforces, and this test exists to prove the
	// multipart temp files are removed when that cap trips mid-parse.
	remaining := maxFileUploadBodyBytes + 1
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
	if err := writer.WriteField("hashedKey", testHashedKey); err != nil {
		t.Fatalf("WriteField hashedKey error: %v", err)
	}
	if err := writer.WriteField("duration", "120"); err != nil {
		t.Fatalf("WriteField duration error: %v", err)
	}
	if err := writer.WriteField("views", "5"); err != nil {
		t.Fatalf("WriteField views error: %v", err)
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
	countedViews := 0
	incrementStoredFileCountersFunc = func(views int, now time.Time) error {
		countedViews = views
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
	if !record.Encrypted || record.HashedKey != testHashedKey {
		t.Fatalf("record = %#v, want encrypted record with the legacy key", record)
	}
	if record.Views != 5 || countedViews != 5 {
		t.Fatalf("stored views = %d, counted views = %d, want 5", record.Views, countedViews)
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
	reserveFileDownloadFunc = func(key string, hashedKey string) (FileDownloadReservation, string, error) {
		if key != testFileID || hashedKey != testFileHash {
			t.Fatalf("consume args = %q, %q; want %q, %q", key, hashedKey, testFileID, testFileHash)
		}
		file, err := os.Open(filePath)
		if err != nil {
			t.Fatalf("Open reservation file: %v", err)
		}
		return FileDownloadReservation{
			StoredFile: StoredFile{Encrypted: true, FileUri: filePath, HashedKey: testFileHash},
			File:       file,
		}, "ok", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"`+testFileID+`","hashedKey":"`+testFileHash+`"}`))
	rec := httptest.NewRecorder()
	apiGetFile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("apiGetFile() code = %d, want %d", rec.Code, http.StatusOK)
	}
	if rec.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("Content-Type = %q, want application/octet-stream", rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("X-1Time-Views-Left") != "0" {
		t.Fatalf("views-left header = %q, want 0", rec.Header().Get("X-1Time-Views-Left"))
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", rec.Header().Get("Cache-Control"))
	}
	if rec.Body.String() != "encrypted file bytes" {
		t.Fatalf("body = %q, want encrypted file bytes", rec.Body.String())
	}
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Fatalf("file should be deleted after stream, stat err=%v", err)
	}
}

func TestAPIGetFileKeepsBlobWhileDownloadsRemain(t *testing.T) {
	restoreHandlerHooks(t)

	filePath := filepath.Join(t.TempDir(), "file.enc")
	if err := os.WriteFile(filePath, []byte("encrypted file bytes"), 0o600); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}
	reserveFileDownloadFunc = func(key string, hashedKey string) (FileDownloadReservation, string, error) {
		file, err := os.Open(filePath)
		if err != nil {
			t.Fatalf("Open reservation file: %v", err)
		}
		return FileDownloadReservation{
			StoredFile:       StoredFile{Encrypted: true, FileUri: filePath, HashedKey: testFileHash, Views: 3},
			File:             file,
			ViewsLeft:        2,
			ExpiresInSeconds: 3600,
		}, "ok", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"`+testFileID+`","hashedKey":"`+testFileHash+`"}`))
	rec := httptest.NewRecorder()
	apiGetFile(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "encrypted file bytes" {
		t.Fatalf("response = (%d, %q), want successful file", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("X-1Time-Views-Left") != "2" {
		t.Fatalf("views-left header = %q, want 2", rec.Header().Get("X-1Time-Views-Left"))
	}
	if rec.Header().Get("X-1Time-Expires-In") != "3600" {
		t.Fatalf("expires-in header = %q, want 3600", rec.Header().Get("X-1Time-Expires-In"))
	}
	if _, err := os.Stat(filePath); err != nil {
		t.Fatalf("file should remain while downloads remain: %v", err)
	}
}

func TestAPIGetFileReturnsRetryableContention(t *testing.T) {
	restoreHandlerHooks(t)
	reserveFileDownloadFunc = func(key string, hashedKey string) (FileDownloadReservation, string, error) {
		return FileDownloadReservation{}, "retry", errConsumeMessageContention
	}

	req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"`+testFileID+`","hashedKey":"`+testFileHash+`"}`))
	rec := httptest.NewRecorder()
	apiGetFile(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
	if !strings.Contains(rec.Body.String(), `"status":"retry"`) {
		t.Fatalf("body = %s, want retry status", rec.Body.String())
	}
}

func TestAPIGetFileReturnsJSONStatuses(t *testing.T) {
	tests := []string{"wrong key", "no message"}
	for _, status := range tests {
		t.Run(status, func(t *testing.T) {
			restoreHandlerHooks(t)
			reserveFileDownloadFunc = func(key string, hashedKey string) (FileDownloadReservation, string, error) {
				return FileDownloadReservation{}, status, nil
			}

			req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"`+testFileID+`","hashedKey":"`+testFileHash+`"}`))
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
	reserveFileDownloadFunc = func(key string, hashedKey string) (FileDownloadReservation, string, error) {
		called = true
		return FileDownloadReservation{}, "ok", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/getFile", strings.NewReader(`{"id":"","hashedKey":"`+testFileHash+`"}`))
	rec := httptest.NewRecorder()
	apiGetFile(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("apiGetFile() code = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if called {
		t.Fatal("reserveFileDownloadFunc should not be called for bad payload")
	}
}

// A real SHA-256, in the form a client actually uploads. A placeholder here
// would let a missing shape check pass unnoticed.
const validReadTokenHash = "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"

// --- v3 save wiring ----------------------------------------------------------
//
// resolveSaveScheme is unit-tested in isolation, which proves nothing about the
// handlers persisting the version they resolved. Dropping `Version: scheme`
// from either struct literal keeps every other test green and loses every v3
// secret. These are that guard.

func TestAPISaveSecretPersistsV3Scheme(t *testing.T) {
	restoreHandlerHooks(t)

	var stored StoredMessage
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
		raw, _ := value.([]byte)
		if err := json.Unmarshal(raw, &stored); err != nil {
			t.Fatalf("stored payload is not StoredMessage JSON: %v", err)
		}
		return "msg-v3", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret",
		strings.NewReader(`{"secretMessage":"ciphertext","readTokenHash":"ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb","v":3,"duration":60}`))
	responseCode, response := apiSaveSecret(req)

	if responseCode != http.StatusOK || !strings.Contains(string(response), `"status":"ok"`) {
		t.Fatalf("apiSaveSecret() = (%d, %s), want ok", responseCode, response)
	}
	if stored.Version != secretSchemeV3 {
		t.Fatalf("stored Version = %d, want %d — a v3 upload was recorded as v2 and is now unreadable",
			stored.Version, secretSchemeV3)
	}
	if stored.HashedKey != validReadTokenHash {
		t.Fatalf("stored HashedKey = %q, want the uploaded hash", stored.HashedKey)
	}
}

func TestAPISaveSecretLegacyUploadStaysScheme0(t *testing.T) {
	restoreHandlerHooks(t)

	var stored StoredMessage
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
		raw, _ := value.([]byte)
		_ = json.Unmarshal(raw, &stored)
		return "msg-v2", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/api/saveSecret",
		strings.NewReader(`{"secretMessage":"ciphertext","hashedKey":"`+testHashedKey+`","duration":60}`))
	if code, _ := apiSaveSecret(req); code != http.StatusOK {
		t.Fatalf("legacy save rejected: code = %d", code)
	}
	if stored.Version != 0 || stored.HashedKey != testHashedKey {
		t.Fatalf("legacy record = %#v, want the token stored under scheme 0", stored)
	}
}

func TestAPISaveSecretFilePersistsV3Scheme(t *testing.T) {
	restoreHandlerHooks(t)

	originalDir := fileStorageDir
	fileStorageDir = t.TempDir()
	t.Cleanup(func() { fileStorageDir = originalDir })

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileWriter, err := writer.CreateFormFile("file", "secret.enc")
	if err != nil {
		t.Fatalf("CreateFormFile error: %v", err)
	}
	if _, err := fileWriter.Write([]byte("encrypted file bytes")); err != nil {
		t.Fatalf("Write error: %v", err)
	}
	if err := writer.WriteField("readTokenHash", validReadTokenHash); err != nil {
		t.Fatalf("WriteField readTokenHash error: %v", err)
	}
	if err := writer.WriteField("v", "3"); err != nil {
		t.Fatalf("WriteField v error: %v", err)
	}
	if err := writer.WriteField("duration", "120"); err != nil {
		t.Fatalf("WriteField duration error: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close writer error: %v", err)
	}

	var record StoredFile
	setFileRecordFunc = func(storeKey string, value interface{}, duration time.Duration) (bool, error) {
		raw, _ := value.([]byte)
		if err := json.Unmarshal(raw, &record); err != nil {
			t.Fatalf("file record JSON error: %v", err)
		}
		return true, nil
	}
	incrementStoredFileCountersFunc = func(views int, now time.Time) error { return nil }

	req := httptest.NewRequest(http.MethodPost, "/api/saveFile", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if code, _ := apiSaveSecretFile(req); code != http.StatusOK {
		t.Fatalf("v3 file save rejected: code = %d", code)
	}
	if record.Version != secretSchemeV3 {
		t.Fatalf("stored file Version = %d, want %d — v3 upload recorded as v2, file now undownloadable",
			record.Version, secretSchemeV3)
	}
	if record.HashedKey != validReadTokenHash {
		t.Fatalf("stored file HashedKey = %q, want the uploaded hash", record.HashedKey)
	}
}

// A v2 save carrying a malformed key would store a secret the read path can
// never accept, since apiGetMessage and consumeMessageFromStorage both require
// isValidHashedKey. Refusing it at save time is the difference between an error
// and a link that is dead on arrival.
func TestResolveSaveSchemeRejectsMalformedLegacyKey(t *testing.T) {
	if _, _, ok := resolveSaveScheme(testHashedKey, "", 0); !ok {
		t.Fatal("a well-formed legacy key should be accepted")
	}

	for _, bad := range []string{
		"",
		"tooshort",
		testHashedKey + "a",                  // too long
		testHashedKey[:len(testHashedKey)-1], // too short
		strings.ToUpper(testHashedKey),       // hex, but uppercase
		testHashedKey[:len(testHashedKey)-1] + "z", // right length, not hex
	} {
		if _, _, ok := resolveSaveScheme(bad, "", 0); ok {
			t.Fatalf("legacy key %q should be rejected", bad)
		}
	}
}
