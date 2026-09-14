package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strconv"
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

func TestParseFeedbackAcceptsTextAlone(t *testing.T) {
	entry, spam, ok := parseFeedback(url.Values{
		"src":  {"ready"},
		"v":    {"2"},
		"text": {"Sharing database credentials with contractors"},
	})
	if !ok || spam {
		t.Fatalf("parseFeedback() ok=%v spam=%v, want ok and not spam", ok, spam)
	}

	want := feedbackEntry{Src: "ready", V: "2", Text: "Sharing database credentials with contractors"}
	if !reflect.DeepEqual(entry, want) {
		t.Fatalf("entry = %#v, want %#v", entry, want)
	}
}

func TestParseFeedbackDirectVisitTrimsText(t *testing.T) {
	entry, _, ok := parseFeedback(url.Values{
		"text": {" Rotating vendor credentials\r\nevery quarter "},
	})
	if !ok {
		t.Fatal("parseFeedback() rejected a valid direct submission")
	}

	want := feedbackEntry{Src: "direct", Text: "Rotating vendor credentials\nevery quarter"}
	if !reflect.DeepEqual(entry, want) {
		t.Fatalf("entry = %#v, want %#v", entry, want)
	}
}

func TestParseFeedbackTextLimitCountsRunesAfterCRLF(t *testing.T) {
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
		form := url.Values{"src": {"read"}, "v": {"1"}, "text": {"hello"}}
		for key, values := range overrides {
			form[key] = values
		}
		return form
	}

	cases := map[string]url.Values{
		"empty submission":     {"src": {"read"}, "v": {"1"}},
		"whitespace-only text": valid(url.Values{"text": {" \r\n "}}),
		"unknown field":        valid(url.Values{"feature": {"api-keys"}}),
		"unknown source":       valid(url.Values{"src": {"home"}}),
		"unknown variant":      valid(url.Values{"v": {"4"}}),
		"source without v":     valid(url.Values{"v": nil}),
		"variant without src":  valid(url.Values{"src": nil}),
		"email field":          valid(url.Values{"email": {"a@example.com"}}),
		"repeated field":       valid(url.Values{"text": {"a", "b"}}),
		"invalid utf8 text":    valid(url.Values{"text": {"\xff"}}),
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

	rec := postFeedback(url.Values{"src": {"read"}, "v": {"3"}, "text": {"audit trail"}}, true)

	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"status":"ok"}` {
		t.Fatalf("response = %d %q", rec.Code, rec.Body.String())
	}
	if len(stored) != 1 || stored[0].Src != "read" || stored[0].V != "3" || stored[0].Text != "audit trail" {
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

	rec := postFeedback(url.Values{"text": {"hi"}, "website": {"x"}}, true)
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"status":"ok"}` {
		t.Fatalf("response = %d %q, want a success indistinguishable from a real one", rec.Code, rec.Body.String())
	}
}

func TestAPIFeedbackRejectsInvalidSubmission(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		t.Fatal("invalid submission reached storage")
		return nil
	})

	rec := postFeedback(url.Values{"text": {"   "}}, true)
	if rec.Code != http.StatusBadRequest || strings.TrimSpace(rec.Body.String()) != `{"status":"invalid"}` {
		t.Fatalf("response = %d %q", rec.Code, rec.Body.String())
	}
}

func TestAPIFeedbackIgnoresQueryStringFields(t *testing.T) {
	stubSaveFeedback(t, func(entry feedbackEntry, now time.Time) error {
		t.Fatal("query-string fields reached storage")
		return nil
	})

	req := httptest.NewRequest(http.MethodPost, "/api/feedback?text=hi", strings.NewReader(""))
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

	rec := postFeedback(url.Values{"text": {"hi"}}, true)
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
		{"success", url.Values{"text": {"hi"}}, feedbackThanksURL},
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

func TestSaveFeedbackWritesEntry(t *testing.T) {
	client := startTestRedis(t)
	now := time.Date(2026, time.September, 14, 23, 59, 30, 500, time.UTC)

	entries := []feedbackEntry{
		{Src: "ready", V: "1", Text: "hi"},
		{Src: "ready", V: "1", Text: "again"},
		{Src: "direct", Text: "direct visit"},
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

	var first map[string]any
	if err := json.Unmarshal([]byte(stored[0]), &first); err != nil {
		t.Fatalf("unmarshal stored entry: %v", err)
	}
	keys := make([]string, 0, len(first))
	for key := range first {
		keys = append(keys, key)
	}
	wantKeys := []string{"at", "src", "text", "v"}
	if !sameStrings(keys, wantKeys) {
		t.Fatalf("stored fields = %v, want %v", keys, wantKeys)
	}
	if first["at"] != "2026-09-14T23:59:30Z" {
		t.Fatalf("at = %v", first["at"])
	}

	if ttl := client.TTL(feedbackEntriesKey).Val(); ttl != -1*time.Second {
		t.Fatalf("entries TTL = %v, want none", ttl)
	}
}

func TestSaveFeedbackKeepsOnlyNewestEntries(t *testing.T) {
	client := startTestRedis(t)
	now := time.Date(2026, time.September, 14, 12, 0, 0, 0, time.UTC)

	total := maxFeedbackEntries + 5
	for i := 1; i <= total; i++ {
		if err := saveFeedbackWithClient(client, feedbackEntry{Src: "direct", Text: strconv.Itoa(i)}, now); err != nil {
			t.Fatalf("saveFeedbackWithClient() error = %v", err)
		}
	}

	stored, err := client.LRange(feedbackEntriesKey, 0, -1).Result()
	if err != nil {
		t.Fatalf("LRANGE error = %v", err)
	}
	if len(stored) != maxFeedbackEntries {
		t.Fatalf("stored %d entries, want %d", len(stored), maxFeedbackEntries)
	}

	textAt := func(i int) string {
		var entry feedbackEntry
		if err := json.Unmarshal([]byte(stored[i]), &entry); err != nil {
			t.Fatalf("unmarshal stored entry: %v", err)
		}
		return entry.Text
	}
	if got, want := textAt(0), strconv.Itoa(total-maxFeedbackEntries+1); got != want {
		t.Fatalf("oldest kept entry = %q, want %q", got, want)
	}
	if got, want := textAt(len(stored)-1), strconv.Itoa(total); got != want {
		t.Fatalf("newest entry = %q, want %q", got, want)
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
