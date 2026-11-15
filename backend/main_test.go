package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	original := version
	version = "abc123"
	t.Cleanup(func() { version = original })

	rec := httptest.NewRecorder()
	healthHandler(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK || rec.Body.String() != "ok abc123" {
		t.Fatalf("healthz: %d %q", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Fatalf("content type %q", ct)
	}
}

func TestParseOptions(t *testing.T) {
	cases := []struct {
		name string
		args []string
		env  string
		want options
	}{
		{"default", nil, "", options{listenAddr: "127.0.0.1:8080"}},
		{"env", nil, "127.0.0.1:9000", options{listenAddr: "127.0.0.1:9000"}},
		{"flag beats env", []string{"-listen", "127.0.0.1:8081"}, "127.0.0.1:8080", options{listenAddr: "127.0.0.1:8081"}},
		{"version", []string{"-version"}, "", options{showVersion: true, listenAddr: "127.0.0.1:8080"}},
	}
	for _, tc := range cases {
		got, err := parseOptions(tc.args, tc.env)
		if err != nil || got != tc.want {
			t.Errorf("%s: got %+v, %v; want %+v", tc.name, got, err, tc.want)
		}
	}

	if _, err := parseOptions([]string{"-nope"}, ""); err == nil {
		t.Error("unknown flag must fail")
	}
}
