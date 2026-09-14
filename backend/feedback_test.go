package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"
)

func stubSaveFeedback(t *testing.T, fn func(entry feedbackEntry, now time.Time) error) {
	t.Helper()

	original := saveFeedbackFunc
	saveFeedbackFunc = fn
	t.Cleanup(func() {
		saveFeedbackFunc = original
	})
}

func postFeedback(form url.Values, acceptJSON bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/feedback", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if acceptJSON {
		req.Header.Set("Accept", "application/json")
	}
	rec := httptest.NewRecorder()
	apiHandler(rec, req)
	return rec
}

func TestParseFeedbackAcceptsFeatureTogglesAlone(t *testing.T) {
	entry, spam, ok := parseFeedback(url.Values{
		"src":     {"ready"},
		"v":       {"2"},
		"feature": {"custom-domain", "api-keys", "custom-domain"},
	})
	if !ok || spam {
		t.Fatalf("parseFeedback() ok=%v spam=%v, want ok and not spam", ok, spam)
	}

	want := feedbackEntry{Src: "ready", V: "2", Features: []string{"custom-domain", "api-keys"}}
	if !reflect.DeepEqual(entry, want) {
		t.Fatalf("entry = %#v, want %#v", entry, want)
	}
}

func TestParseFeedbackDirectVisitAndOptionalFields(t *testing.T) {
	entry, _, ok := parseFeedback(url.Values{
		"teamSize": {"11-50"},
		"email":    {"  ops@example.com "},
		"text":     {" Rotating vendor credentials\r\nevery quarter "},
	})
	if !ok {
		t.Fatal("parseFeedback() rejected a valid direct submission")
	}

	want := feedbackEntry{
		Src:      "direct",
		Features: []string{},
		TeamSize: "11-50",
		Email:    "ops@example.com",
		Text:     "Rotating vendor credentials\nevery quarter",
	}
	if !reflect.DeepEqual(entry, want) {
		t.Fatalf("entry = %#v, want %#v", entry, want)
	}
}

func TestParseFeedbackTextLimitCountsRunesAfterCRLF(t *testing.T) {
	// 2,000 characters as the textarea counts them, with CRLF line breaks as
	// the browser submits them.
	atLimit := strings.Repeat("é\r\n", 999) + "éa"
	if _, _, ok := parseFeedback(url.Values{"text": {atLimit}}); !ok {
		t.Fatal("text at the limit was rejected")
	}

	overLimit := strings.Repeat("é", maxFeedbackTextRunes+1)
	if _, _, ok := parseFeedback(url.Values{"text": {overLimit}}); ok {
		t.Fatal("text over the limit was accepted")
	}
}

func TestParseFeedbackRejectsInvalidInput(t *testing.T) {
	valid := func(overrides url.Values) url.Values {
		form := url.Values{"src": {"read"}, "v": {"1"}, "feature": {"larger-files"}}
		for key, values := range overrides {
			form[key] = values
		}
		return form
	}

	cases := map[string]url.Values{
		"empty submission":      {"src": {"read"}, "v": {"1"}},
		"unknown feature":       valid(url.Values{"feature": {"larger-files", "sso"}}),
		"unknown source":        valid(url.Values{"src": {"home"}}),
		"unknown variant":       valid(url.Values{"v": {"4"}}),
		"source without v":      valid(url.Values{"v": nil}),
		"variant without src":   valid(url.Values{"src": nil}),
		"unknown team size":     valid(url.Values{"teamSize": {"1000"}}),
		"email without at":      valid(url.Values{"email": {"ops.example.com"}}),
		"email without dot":     valid(url.Values{"email": {"ops@localhost"}}),
		"email display name":    valid(url.Values{"email": {"Ops <ops@example.com>"}}),
		"email too long":        valid(url.Values{"email": {strings.Repeat("a", 250) + "@example.com"}}),
		"repeated single field": valid(url.Values{"email": {"a@example.com", "b@example.com"}}),
		"invalid utf8 text":     valid(url.Values{"text": {"\xff"}}),
	}

	for name, form := range cases {
		t.Run(name, func(t *testing.T) {
			if _, _, ok := parseFeedback(form); ok {
				t.Fatalf("parseFeedback(%v) accepted invalid input", form)
			}
		})
	}
}

func TestParseFeedbackHoneypotIsSpamEvenWhenOtherwiseInvalid(t *testing.T) {
	_, spam, ok := parseFeedback(url.Values{"website": {"http://spam.example"}, "feature": {"bogus"}})
	if !ok || !spam {
		t.Fatalf("parseFeedback() ok=%v spam=%v, want a silent spam success", ok, spam)
	}
}

func TestAPIFeedbackStoresValidSubmission(t *testing.T) {
	var stored []feedbackEntry
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		stored = append(stored, entry)
		return nil
	})

	rec := postFeedback(url.Values{"src": {"read"}, "v": {"3"}, "feature": {"audit-log"}}, true)

	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"status":"ok"}` {
		t.Fatalf("response = %d %q", rec.Code, rec.Body.String())
	}
	if len(stored) != 1 || stored[0].Src != "read" || stored[0].V != "3" {
		t.Fatalf("stored = %#v", stored)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}
}

func TestAPIFeedbackHoneypotStoresNothing(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		t.Fatal("honeypot submission reached storage")
		return nil
	})

	rec := postFeedback(url.Values{"feature": {"api-keys"}, "website": {"x"}}, true)
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"status":"ok"}` {
		t.Fatalf("response = %d %q, want a success indistinguishable from a real one", rec.Code, rec.Body.String())
	}
}

func TestAPIFeedbackRejectsInvalidSubmission(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		t.Fatal("invalid submission reached storage")
		return nil
	})

	rec := postFeedback(url.Values{"feature": {"not-a-feature"}}, true)
	if rec.Code != http.StatusBadRequest || strings.TrimSpace(rec.Body.String()) != `{"status":"invalid"}` {
		t.Fatalf("response = %d %q", rec.Code, rec.Body.String())
	}
}

func TestAPIFeedbackIgnoresQueryStringFields(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		t.Fatal("query-string fields reached storage")
		return nil
	})

	req := httptest.NewRequest(http.MethodPost, "/api/feedback?feature=api-keys", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	rec := httptest.NewRecorder()
	apiHandler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAPIFeedbackRejectsOversizedBody(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		t.Fatal("oversized submission reached storage")
		return nil
	})

	rec := postFeedback(url.Values{"text": {strings.Repeat("a", maxFeedbackBodyBytes)}}, true)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAPIFeedbackStorageErrorIsReported(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		return errors.New("redis down")
	})

	rec := postFeedback(url.Values{"feature": {"api-keys"}}, true)
	if rec.Code != http.StatusInternalServerError || strings.TrimSpace(rec.Body.String()) != `{"status":"error"}` {
		t.Fatalf("response = %d %q", rec.Code, rec.Body.String())
	}
}

func TestAPIFeedbackRedirectsPlainFormPosts(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error { return nil })

	cases := []struct {
		name string
		form url.Values
		want string
	}{
		{"success", url.Values{"feature": {"api-keys"}}, feedbackThanksURL},
		{"honeypot", url.Values{"website": {"x"}}, feedbackThanksURL},
		{"invalid", url.Values{}, feedbackFailedURL},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := postFeedback(tc.form, false)
			if rec.Code != http.StatusSeeOther {
				t.Fatalf("status = %d, want 303", rec.Code)
			}
			if got := rec.Header().Get("Location"); got != tc.want {
				t.Fatalf("Location = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSaveFeedbackWritesEntryAndDayCounters(t *testing.T) {
	client := startTestRedis(t)
	now := time.Date(2026, time.September, 14, 23, 59, 30, 500, time.UTC)

	entries := []feedbackEntry{
		{Src: "ready", V: "1", Features: []string{"custom-domain", "api-keys"}, TeamSize: "2-10", Email: "a@example.com", Text: "hi"},
		{Src: "ready", V: "1", Features: []string{"api-keys"}},
		{Src: "direct", Features: []string{}, Text: "no toggles"},
	}
	for _, entry := range entries {
		if err := saveFeedbackWithClient(client, entry, now); err != nil {
			t.Fatalf("saveFeedbackWithClient() error = %v", err)
		}
	}

	stored, err := client.LRange(feedbackEntriesKey, 0, -1).Result()
	if err != nil {
		t.Fatalf("LRANGE error = %v", err)
	}
	if len(stored) != len(entries) {
		t.Fatalf("stored %d entries, want %d", len(stored), len(entries))
	}

	// The stored shape is the privacy promise: exactly these fields, and in
	// particular no IP address or User-Agent.
	var first map[string]any
	if err := json.Unmarshal([]byte(stored[0]), &first); err != nil {
		t.Fatalf("unmarshal stored entry: %v", err)
	}
	keys := make([]string, 0, len(first))
	for key := range first {
		keys = append(keys, key)
	}
	wantKeys := []string{"at", "email", "features", "src", "teamSize", "text", "v"}
	if !sameStrings(keys, wantKeys) {
		t.Fatalf("stored fields = %v, want %v", keys, wantKeys)
	}
	if first["at"] != "2026-09-14T23:59:30Z" {
		t.Fatalf("at = %v", first["at"])
	}

	if ttl := client.TTL(feedbackEntriesKey).Val(); ttl != -1*time.Second {
		t.Fatalf("entries TTL = %v, want none", ttl)
	}

	dayKey := "stats:feedback:day:20260914"
	counts, err := client.HGetAll(dayKey).Result()
	if err != nil {
		t.Fatalf("HGETALL error = %v", err)
	}
	wantCounts := map[string]string{
		"from:ready:1":          "2",
		"from:direct":           "1",
		"feature:custom-domain": "1",
		"feature:api-keys":      "2",
	}
	if !reflect.DeepEqual(counts, wantCounts) {
		t.Fatalf("day counters = %v, want %v", counts, wantCounts)
	}
	if ttl := client.TTL(dayKey).Val(); ttl <= 0 || ttl > statsHistoryTTL {
		t.Fatalf("day key TTL = %v, want within statsHistoryTTL", ttl)
	}
}

func sameStrings(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	seen := map[string]int{}
	for _, value := range got {
		seen[value]++
	}
	for _, value := range want {
		if seen[value] == 0 {
			return false
		}
		seen[value]--
	}
	return true
}
