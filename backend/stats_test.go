package main

import (
	"errors"
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

func TestStatsKeyHelpers(t *testing.T) {
	now := time.Date(2026, time.May, 5, 12, 0, 0, 0, time.UTC)

	if got := getStoredCounterDayKey(storedCounterText, now); got != "stats:stored:text:day:20260505" {
		t.Fatalf("text day key = %q", got)
	}
	if got := getStoredCounterDayKey(storedCounterFile, now); got != "stats:stored:file:day:20260505" {
		t.Fatalf("file day key = %q", got)
	}
	if got := getStoredCounterDayKey(storedCounterKind(99), now); got != "stats:stored:text:day:20260505" {
		t.Fatalf("default day key = %q", got)
	}
	if got := getStoredCounterTotalKey(storedCounterText); got != storedTextTotalKey {
		t.Fatalf("text total key = %q", got)
	}
	if got := getStoredCounterTotalKey(storedCounterFile); got != storedFileTotalKey {
		t.Fatalf("file total key = %q", got)
	}
	if got := getStoredCounterTotalKey(storedCounterKind(99)); got != storedTextTotalKey {
		t.Fatalf("default total key = %q", got)
	}
	if got := getPageHitDayKey(now); got != "stats:page:hits:day:20260505" {
		t.Fatalf("page hit day key = %q", got)
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

func TestStatsManagerFlushPageHits(t *testing.T) {
	originalFlush := flushPageHitCountersFunc
	t.Cleanup(func() {
		flushPageHitCountersFunc = originalFlush
	})

	stats := NewStatsManager()
	called := false
	flushPageHitCountersFunc = func(pageHits pageHitSnapshot, now time.Time) error {
		called = true
		if pageHits[statPageHome] != 1 || pageHits[statPageBlog] != 2 {
			t.Fatalf("flushed hits = %#v, want 1 home and 2 blog", pageHits)
		}
		return nil
	}

	stats.RecordPageHit(statPageHome)
	stats.RecordPageHit(statPageBlog)
	stats.RecordPageHit(statPageBlog)

	if err := stats.FlushPageHits(); err != nil {
		t.Fatalf("FlushPageHits() error = %v", err)
	}
	if !called {
		t.Fatal("flushPageHitCountersFunc was not called")
	}
	if _, ok := stats.snapshotPageHits(); ok {
		t.Fatal("successful flush should clear pending hits")
	}
}

func TestStatsManagerFlushPageHitsMergesBackOnError(t *testing.T) {
	originalFlush := flushPageHitCountersFunc
	t.Cleanup(func() {
		flushPageHitCountersFunc = originalFlush
	})

	stats := NewStatsManager()
	wantErr := errors.New("redis unavailable")
	flushPageHitCountersFunc = func(pageHits pageHitSnapshot, now time.Time) error {
		return wantErr
	}

	stats.RecordPageHit(statPagePassword)

	if err := stats.FlushPageHits(); !errors.Is(err, wantErr) {
		t.Fatalf("FlushPageHits() error = %v, want %v", err, wantErr)
	}
	snapshot, ok := stats.snapshotPageHits()
	if !ok || snapshot[statPagePassword] != 1 {
		t.Fatalf("failed flush should restore pending hit, got %#v ok=%v", snapshot, ok)
	}
}

func TestStatsManagerLoadOverallStoredCounters(t *testing.T) {
	originalGetOverall := getOverallStoredCounterFromRedisFunc
	t.Cleanup(func() {
		getOverallStoredCounterFromRedisFunc = originalGetOverall
	})

	getOverallStoredCounterFromRedisFunc = func(kind storedCounterKind) (int64, error) {
		switch kind {
		case storedCounterText:
			return 11, nil
		case storedCounterFile:
			return 4, nil
		default:
			t.Fatalf("unexpected counter kind %v", kind)
			return 0, nil
		}
	}

	stats := NewStatsManager()
	if err := stats.loadOverallStoredCounters(); err != nil {
		t.Fatalf("loadOverallStoredCounters() error = %v", err)
	}
	if stats.GetOverallStoredSecrets() != 11 {
		t.Fatalf("overall secrets = %d, want 11", stats.GetOverallStoredSecrets())
	}
	if stats.GetOverallStoredFiles() != 4 {
		t.Fatalf("overall files = %d, want 4", stats.GetOverallStoredFiles())
	}
}

func TestStatsManagerLoadOverallStoredCountersReturnsError(t *testing.T) {
	originalGetOverall := getOverallStoredCounterFromRedisFunc
	t.Cleanup(func() {
		getOverallStoredCounterFromRedisFunc = originalGetOverall
	})

	wantErr := errors.New("redis unavailable")
	getOverallStoredCounterFromRedisFunc = func(kind storedCounterKind) (int64, error) {
		return 0, wantErr
	}

	if err := NewStatsManager().loadOverallStoredCounters(); !errors.Is(err, wantErr) {
		t.Fatalf("loadOverallStoredCounters() error = %v, want %v", err, wantErr)
	}
}

func TestIncrementStoredCounterWrappers(t *testing.T) {
	originalIncrement := incrementStoredCounterFunc
	t.Cleanup(func() {
		incrementStoredCounterFunc = originalIncrement
	})

	var kinds []storedCounterKind
	incrementStoredCounterFunc = func(kind storedCounterKind, now time.Time) error {
		kinds = append(kinds, kind)
		return nil
	}

	now := time.Now().UTC()
	if err := incrementStoredSecretCounters(now); err != nil {
		t.Fatalf("incrementStoredSecretCounters() error = %v", err)
	}
	if err := incrementStoredFileCounters(now); err != nil {
		t.Fatalf("incrementStoredFileCounters() error = %v", err)
	}
	if len(kinds) != 2 || kinds[0] != storedCounterText || kinds[1] != storedCounterFile {
		t.Fatalf("increment kinds = %#v, want text then file", kinds)
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
	appStats.AddStoredFiles(3)
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
	if !strings.Contains(body, `"overallStoredFiles":3`) {
		t.Fatalf("snapshot body = %s, missing overallStoredFiles", body)
	}
	if !strings.Contains(body, `"home":1`) {
		t.Fatalf("snapshot body = %s, missing home count", body)
	}
	if !strings.Contains(body, `"password":2`) {
		t.Fatalf("snapshot body = %s, missing password count", body)
	}
}
