package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestHashCounterAcceptsOnlyListedFields(t *testing.T) {
	if !shareCounter.accepts("tap") {
		t.Fatal("shareCounter rejects tap")
	}
	for _, field := range []string{"wrong", "", "Tap", "home"} {
		if shareCounter.accepts(field) {
			t.Fatalf("shareCounter accepts %q", field)
		}
	}

	stats := NewStatsManager()
	stats.Record(shareCounter, "wrong", "")
	if _, ok := stats.snapshotPending(); ok {
		t.Fatal("unlisted fields should not be recorded")
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
	if got := getViewsTotalKey(1); got != "stats:views:total:1" {
		t.Fatalf("views total key = %q", got)
	}
	if got := getViewsTotalKey(10); got != "stats:views:total:10" {
		t.Fatalf("views total key = %q", got)
	}
	if got := getViewsDayKey(3, now); got != "stats:views:day:20260505:3" {
		t.Fatalf("views day key = %q", got)
	}
	if got := getFileViewsTotalKey(5); got != "stats:views:file:total:5" {
		t.Fatalf("file views total key = %q", got)
	}
	if got := getFileViewsDayKey(5, now); got != "stats:views:file:day:20260505:5" {
		t.Fatalf("file views day key = %q", got)
	}
	if got := pushCounter.dayKey(now); got != "stats:push:day:20260505" {
		t.Fatalf("push day key = %q", got)
	}
	if got := shareCounter.dayKey(now); got != "stats:share:day:20260505" {
		t.Fatalf("share day key = %q", got)
	}
}

func TestStatsManagerSnapshotAndMerge(t *testing.T) {
	stats := NewStatsManager()
	stats.Record(shareCounter, "tap")
	stats.Record(shareCounter, "tap")
	stats.RecordPushSend(false)

	snapshot, ok := stats.snapshotPending()
	if !ok {
		t.Fatal("snapshotPending() reported no counts")
	}
	if got := snapshot[counterField{shareCounter, "tap"}]; got != 2 {
		t.Fatalf("share taps = %d, want 2", got)
	}
	if got := snapshot[counterField{pushCounter, "all"}]; got != 1 {
		t.Fatalf("push sends = %d, want 1", got)
	}

	if _, ok := stats.snapshotPending(); ok {
		t.Fatal("snapshotPending() should clear pending counts")
	}

	stats.mergePending(snapshot)

	merged, ok := stats.snapshotPending()
	if !ok {
		t.Fatal("snapshotPending() should see merged counts")
	}
	if !reflect.DeepEqual(merged, snapshot) {
		t.Fatalf("merged snapshot = %#v, want %#v", merged, snapshot)
	}
}

func TestStatsManagerFlushCounters(t *testing.T) {
	originalFlush := flushCountersFunc
	t.Cleanup(func() {
		flushCountersFunc = originalFlush
	})

	stats := NewStatsManager()
	called := false
	flushCountersFunc = func(pending pendingCounters, now time.Time) error {
		called = true
		if got := pending[counterField{shareCounter, "tap"}]; got != 2 {
			t.Fatalf("flushed share taps = %d, want 2", got)
		}
		all, succeeded := pending[counterField{pushCounter, "all"}], pending[counterField{pushCounter, "succeeded"}]
		if all != 3 {
			t.Fatalf("flushed push sends = %d, want 3", all)
		}
		if succeeded != 1 {
			t.Fatalf("flushed push successes = %d, want 1", succeeded)
		}
		return nil
	}

	stats.Record(shareCounter, "tap")
	stats.Record(shareCounter, "tap")
	stats.RecordPushSend(true)
	stats.RecordPushSend(false)
	stats.RecordPushSend(false)

	if err := stats.FlushCounters(); err != nil {
		t.Fatalf("FlushCounters() error = %v", err)
	}
	if !called {
		t.Fatal("flushCountersFunc was not called")
	}
	if _, ok := stats.snapshotPending(); ok {
		t.Fatal("successful flush should clear pending counts")
	}
}

func TestStatsManagerFlushCountersMergesBackOnError(t *testing.T) {
	originalFlush := flushCountersFunc
	t.Cleanup(func() {
		flushCountersFunc = originalFlush
	})

	stats := NewStatsManager()
	wantErr := errors.New("redis unavailable")
	flushCountersFunc = func(pending pendingCounters, now time.Time) error {
		return wantErr
	}

	stats.Record(shareCounter, "tap")
	stats.RecordPushSend(true)

	if err := stats.FlushCounters(); !errors.Is(err, wantErr) {
		t.Fatalf("FlushCounters() error = %v, want %v", err, wantErr)
	}
	snapshot, ok := stats.snapshotPending()
	if !ok || snapshot[counterField{shareCounter, "tap"}] != 1 {
		t.Fatalf("failed flush should restore pending share tap, got %#v ok=%v", snapshot, ok)
	}
	if snapshot[counterField{pushCounter, "all"}] != 1 || snapshot[counterField{pushCounter, "succeeded"}] != 1 {
		t.Fatalf("failed flush should restore pending push send, got %#v", snapshot)
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

// The merged write is the whole point of doing both counter families together:
// the stored-text total is the denominator for the view distribution, so they
// must always move in lockstep.
func TestIncrementStoredSecretCountersWritesBothFamilies(t *testing.T) {
	client := startTestRedis(t)
	originalStats := appStats
	appStats = NewStatsManager()
	t.Cleanup(func() { appStats = originalStats })

	now := time.Date(2026, time.July, 25, 12, 0, 0, 0, time.UTC)
	for _, views := range []int{1, 1, 3} {
		if err := incrementStoredSecretCountersWithClient(client, views, now); err != nil {
			t.Fatalf("incrementStoredSecretCountersWithClient(%d) error = %v", views, err)
		}
	}

	for key, want := range map[string]string{
		storedTextTotalKey: "3",
		getStoredCounterDayKey(storedCounterText, now): "3",
		getViewsTotalKey(1):                            "2",
		getViewsDayKey(1, now):                         "2",
		getViewsTotalKey(3):                            "1",
		getViewsDayKey(3, now):                         "1",
	} {
		got, err := client.Get(key).Result()
		if err != nil {
			t.Fatalf("get %s: %v", key, err)
		}
		if got != want {
			t.Fatalf("%s = %s, want %s", key, got, want)
		}
	}

	// Day keys expire; lifetime totals must not.
	for _, key := range []string{getStoredCounterDayKey(storedCounterText, now), getViewsDayKey(1, now)} {
		ttl, err := client.TTL(key).Result()
		if err != nil {
			t.Fatalf("ttl %s: %v", key, err)
		}
		if ttl != statsHistoryTTL {
			t.Fatalf("%s ttl = %s, want %s", key, ttl, statsHistoryTTL)
		}
	}
	for _, key := range []string{storedTextTotalKey, getViewsTotalKey(1)} {
		if ttl, err := client.TTL(key).Result(); err != nil || ttl >= 0 {
			t.Fatalf("%s ttl = %s (err %v), want no expiry", key, ttl, err)
		}
	}

	// The in-memory overall counter tracks the same events.
	if got := appStats.GetOverallStoredSecrets(); got != 3 {
		t.Fatalf("overall stored secrets = %d, want 3", got)
	}
}

func TestIncrementStoredFileCountersWritesBothFamilies(t *testing.T) {
	client := startTestRedis(t)
	originalStats := appStats
	appStats = NewStatsManager()
	t.Cleanup(func() { appStats = originalStats })

	now := time.Date(2026, time.July, 25, 12, 0, 0, 0, time.UTC)
	for _, views := range []int{1, 5, 5} {
		if err := incrementStoredFileCountersWithClient(client, views, now); err != nil {
			t.Fatalf("incrementStoredFileCountersWithClient(%d) error = %v", views, err)
		}
	}

	for key, want := range map[string]string{
		storedFileTotalKey: "3",
		getStoredCounterDayKey(storedCounterFile, now): "3",
		getFileViewsTotalKey(1):                        "1",
		getFileViewsDayKey(1, now):                     "1",
		getFileViewsTotalKey(5):                        "2",
		getFileViewsDayKey(5, now):                     "2",
	} {
		got, err := client.Get(key).Result()
		if err != nil {
			t.Fatalf("get %s: %v", key, err)
		}
		if got != want {
			t.Fatalf("%s = %s, want %s", key, got, want)
		}
	}
	if appStats.GetOverallStoredFiles() != 3 {
		t.Fatalf("overall stored files = %d, want 3", appStats.GetOverallStoredFiles())
	}
}

// The Sheets exporter reads these exact key and field names, and days already in
// Redis must keep accumulating, so the layout is pinned here.
func TestFlushCountersWritesTheSameRedisKeys(t *testing.T) {
	client := startTestRedis(t)
	now := time.Date(2026, time.July, 25, 12, 0, 0, 0, time.UTC)

	stats := NewStatsManager()
	stats.Record(shareCounter, "tap")
	stats.Record(shareCounter, "tap")
	stats.RecordPushSend(true)
	stats.RecordPushSend(false)

	pending, ok := stats.snapshotPending()
	if !ok {
		t.Fatal("nothing pending")
	}
	if err := flushCountersWithClient(client, pending, now); err != nil {
		t.Fatalf("flushCountersWithClient() error = %v", err)
	}

	for key, want := range map[string]map[string]string{
		"stats:share:day:20260725": {"tap": "2"},
		"stats:push:day:20260725":  {"all": "2", "succeeded": "1"},
	} {
		got, err := client.HGetAll(key).Result()
		if err != nil {
			t.Fatalf("hgetall %s: %v", key, err)
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("%s = %v, want %v", key, got, want)
		}
		if ttl, err := client.TTL(key).Result(); err != nil || ttl != statsHistoryTTL {
			t.Fatalf("%s ttl = %s (err %v), want %s", key, ttl, err, statsHistoryTTL)
		}
	}

	// Day keys only: nothing else is written.
	if keys, err := client.Keys("*").Result(); err != nil || len(keys) != 2 {
		t.Fatalf("keys after flush = %v (err %v), want only the two day keys", keys, err)
	}
}

func TestAPIStatRecordsShareTapsAndIgnoresEverythingElse(t *testing.T) {
	originalStats := appStats
	appStats = NewStatsManager()
	defer func() {
		appStats = originalStats
	}()

	req := httptest.NewRequest(http.MethodPost, "/api/stat", strings.NewReader(`{"share":"tap"}`))
	responseCode, response := apiStat(req)
	if responseCode != http.StatusNoContent {
		t.Fatalf("apiStat() code = %d, want %d", responseCode, http.StatusNoContent)
	}
	if len(response) != 0 {
		t.Fatalf("apiStat() body length = %d, want 0", len(response))
	}

	snapshot, ok := appStats.snapshotPending()
	if !ok || len(snapshot) != 1 || snapshot[counterField{shareCounter, "tap"}] != 1 {
		t.Fatalf("pending after share tap = %#v, want exactly 1 tap", snapshot)
	}

	// Page hits are no longer counted; cached pages that still send them, and
	// anything else unknown, get the same empty 204.
	for _, body := range []string{`{"page":"home"}`, `{"share":"ignored"}`, `not json`} {
		req = httptest.NewRequest(http.MethodPost, "/api/stat", strings.NewReader(body))
		responseCode, response = apiStat(req)
		if responseCode != http.StatusNoContent || len(response) != 0 {
			t.Fatalf("apiStat(%s) = %d with %d bytes, want an empty 204", body, responseCode, len(response))
		}
	}

	if pending, ok := appStats.snapshotPending(); ok {
		t.Fatalf("ignored requests were recorded: %#v", pending)
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
	if strings.Contains(body, "PageHits") {
		t.Fatalf("snapshot body = %s, still carries page hits", body)
	}
}

// The scheme list on /api/ss is only useful if it cannot drift from what the
// server actually accepts — an operator reading it is deciding whether a
// rollback is safe, so a stale list is worse than none.
func TestStatSnapshotAdvertisesTheSchemesItAccepts(t *testing.T) {
	advertised := supportedSaveSchemes()
	if len(advertised) == 0 {
		t.Fatal("no save schemes advertised")
	}

	token := strings.Repeat("a", hashedKeyHexLen)
	sum := sha256.Sum256([]byte(token))
	hash := hex.EncodeToString(sum[:])

	accepts := func(scheme int) bool {
		if scheme == 0 {
			_, _, ok := resolveSaveScheme(token, "", 0)
			return ok
		}
		_, _, ok := resolveSaveScheme("", hash, scheme)
		return ok
	}

	for _, scheme := range advertised {
		if !accepts(scheme) {
			t.Fatalf("scheme %d is advertised but resolveSaveScheme rejects it", scheme)
		}
	}

	// And nothing outside the list is quietly accepted.
	for _, scheme := range []int{1, 2, 4, 99} {
		if accepts(scheme) {
			t.Fatalf("scheme %d is accepted but not advertised", scheme)
		}
	}
}

func TestStatSnapshotCarriesAPIVersion(t *testing.T) {
	snapshot := NewStatsManager().GetSnapshot()
	if snapshot.APIVersion != apiVersion {
		t.Fatalf("snapshot APIVersion = %d, want %d", snapshot.APIVersion, apiVersion)
	}
}
