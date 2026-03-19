package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGetStatPageIndex(t *testing.T) {
	tests := []struct {
		page   string
		want   statPageIndex
		wantOK bool
	}{
		{page: "home", want: statPageHome, wantOK: true},
		{page: "blog", want: statPageBlog, wantOK: true},
		{page: "password", want: statPagePassword, wantOK: true},
		{page: "wrong", wantOK: false},
	}

	for _, tt := range tests {
		got, ok := getStatPageIndex(tt.page)
		if ok != tt.wantOK {
			t.Fatalf("getStatPageIndex(%q) ok = %v, want %v", tt.page, ok, tt.wantOK)
		}
		if ok && got != tt.want {
			t.Fatalf("getStatPageIndex(%q) = %v, want %v", tt.page, got, tt.want)
		}
	}
}

func TestGetStatsDayUsesUTC(t *testing.T) {
	tm := time.Date(2026, time.March, 19, 0, 30, 0, 0, time.FixedZone("UTC+2", 2*60*60))
	if got := getStatsDay(tm); got != "20260318" {
		t.Fatalf("getStatsDay() = %q, want %q", got, "20260318")
	}
}

func TestStatsManagerSnapshotAndMerge(t *testing.T) {
	stats := NewStatsManager()
	stats.RecordPageHit(statPageBlog)
	stats.RecordPageHit(statPageBlog)
	stats.RecordPageHit(statPagePassword)

	snapshot, ok := stats.snapshotPageHits()
	if !ok {
		t.Fatal("snapshotPageHits() reported no hits")
	}
	if snapshot[statPageBlog] != 2 {
		t.Fatalf("blog hits = %d, want 2", snapshot[statPageBlog])
	}
	if snapshot[statPagePassword] != 1 {
		t.Fatalf("password hits = %d, want 1", snapshot[statPagePassword])
	}

	if _, ok := stats.snapshotPageHits(); ok {
		t.Fatal("snapshotPageHits() should clear pending hits")
	}

	stats.mergePageHits(snapshot)

	merged, ok := stats.snapshotPageHits()
	if !ok {
		t.Fatal("snapshotPageHits() should see merged hits")
	}
	if merged != snapshot {
		t.Fatalf("merged snapshot = %#v, want %#v", merged, snapshot)
	}
}

func TestAPIStatReturnsNoContentAndRecordsOnlyAllowedPages(t *testing.T) {
	originalStats := appStats
	appStats = NewStatsManager()
	defer func() {
		appStats = originalStats
	}()

	req := httptest.NewRequest(http.MethodPost, "/api/stat", strings.NewReader(`{"page":"blog"}`))
	responseCode, response := apiStat(req)
	if responseCode != http.StatusNoContent {
		t.Fatalf("apiStat() code = %d, want %d", responseCode, http.StatusNoContent)
	}
	if len(response) != 0 {
		t.Fatalf("apiStat() body length = %d, want 0", len(response))
	}

	snapshot, ok := appStats.snapshotPageHits()
	if !ok || snapshot[statPageBlog] != 1 {
		t.Fatalf("blog hits after valid request = %#v, want 1 blog hit", snapshot)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/stat", strings.NewReader(`{"page":"ignored"}`))
	responseCode, response = apiStat(req)
	if responseCode != http.StatusNoContent {
		t.Fatalf("apiStat() code for ignored page = %d, want %d", responseCode, http.StatusNoContent)
	}
	if len(response) != 0 {
		t.Fatalf("apiStat() body length for ignored page = %d, want 0", len(response))
	}

	if _, ok := appStats.snapshotPageHits(); ok {
		t.Fatal("ignored page should not be recorded")
	}
}

func TestAPIStatSnapshotReturnsBufferedStats(t *testing.T) {
	originalStats := appStats
	appStats = NewStatsManager()
	defer func() {
		appStats = originalStats
	}()

	appStats.AddStoredSecrets(7)
	appStats.RecordPageHit(statPageHome)
	appStats.RecordPageHit(statPagePassword)
	appStats.RecordPageHit(statPagePassword)

	responseCode, response := apiStatSnapshot()
	if responseCode != http.StatusOK {
		t.Fatalf("apiStatSnapshot() code = %d, want %d", responseCode, http.StatusOK)
	}

	body := string(response)
	if !strings.Contains(body, `"overallStoredSecrets":7`) {
		t.Fatalf("snapshot body = %s, missing overallStoredSecrets", body)
	}
	if !strings.Contains(body, `"home":1`) {
		t.Fatalf("snapshot body = %s, missing home count", body)
	}
	if !strings.Contains(body, `"password":2`) {
		t.Fatalf("snapshot body = %s, missing password count", body)
	}
}
