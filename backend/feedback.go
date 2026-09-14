package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-redis/redis"
)

const (
	feedbackEntriesKey = "feedback:entries"
	maxFeedbackEntries = 100

	maxFeedbackBodyBytes = 32 * 1024
	maxFeedbackTextRunes = 2000

	feedbackHoneypotField = "website"

	feedbackThanksURL = "/feedback/#thanks"
	feedbackFailedURL = "/feedback/#failed"
)

var (
	feedbackFields   = []string{"src", "v", "text", feedbackHoneypotField}
	feedbackSources  = []string{"ready", "read"}
	feedbackVariants = []string{"1", "2", "3"}
)

type feedbackEntry struct {
	At   time.Time `json:"at"`
	Src  string    `json:"src"`
	V    string    `json:"v"`
	Text string    `json:"text"`
}

var saveFeedbackFunc = saveFeedback

func parseFeedback(form url.Values) (entry feedbackEntry, spam bool, ok bool) {
	if form.Get(feedbackHoneypotField) != "" {
		return feedbackEntry{}, true, true
	}

	for name, values := range form {
		if !slices.Contains(feedbackFields, name) || len(values) > 1 {
			return feedbackEntry{}, false, false
		}
	}

	src, v := form.Get("src"), form.Get("v")
	if src == "" && v == "" {
		src = "direct"
	} else if !slices.Contains(feedbackSources, src) || !slices.Contains(feedbackVariants, v) {
		return feedbackEntry{}, false, false
	}

	// Browsers send textarea newlines as CRLF.
	text := strings.TrimSpace(strings.ReplaceAll(form.Get("text"), "\r\n", "\n"))
	if text == "" || !utf8.ValidString(text) || utf8.RuneCountInString(text) > maxFeedbackTextRunes {
		return feedbackEntry{}, false, false
	}

	return feedbackEntry{Src: src, V: v, Text: text}, false, true
}

func saveFeedback(entry feedbackEntry, now time.Time) error {
	return saveFeedbackWithClient(getRedisClient(), entry, now)
}

func saveFeedbackWithClient(client *redis.Client, entry feedbackEntry, now time.Time) error {
	entry.At = now.UTC().Truncate(time.Second)
	value, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	_, err = client.TxPipelined(func(pipe redis.Pipeliner) error {
		pipe.RPush(feedbackEntriesKey, value)
		pipe.LTrim(feedbackEntriesKey, -maxFeedbackEntries, -1)
		return nil
	})
	return err
}

func apiFeedback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	wantsJSON := strings.Contains(r.Header.Get("Accept"), "application/json")

	respond := func(code int, status string) {
		if !wantsJSON {
			w.Header().Del("Content-Type")
			target := feedbackThanksURL
			if status != "ok" {
				target = feedbackFailedURL
			}
			http.Redirect(w, r, target, http.StatusSeeOther)
			return
		}

		response, _ := json.Marshal(struct {
			Status string `json:"status"`
		}{status})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_, _ = w.Write(response)
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxFeedbackBodyBytes)
	if err := r.ParseForm(); err != nil {
		respond(http.StatusBadRequest, "invalid")
		return
	}

	entry, spam, ok := parseFeedback(r.PostForm)
	if !ok {
		respond(http.StatusBadRequest, "invalid")
		return
	}
	if spam {
		respond(http.StatusOK, "ok")
		return
	}

	if err := saveFeedbackFunc(entry, time.Now()); err != nil {
		log.Printf("saveFeedback error: %v", err)
		respond(http.StatusInternalServerError, "error")
		return
	}

	respond(http.StatusOK, "ok")
}
