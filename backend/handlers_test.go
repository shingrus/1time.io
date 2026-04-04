package main

import (
	"net/http"
	"net/http/httptest"
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
