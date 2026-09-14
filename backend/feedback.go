package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"net/url"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-redis/redis"
)

const (
	// feedbackEntriesKey is a Redis list of JSON feedbackEntry values, oldest
	// first. It has no TTL: the submissions are the research itself.
	feedbackEntriesKey = "feedback:entries"
	// feedbackDayKeyPrefix holds one hash per UTC day: from:<src>:<v> per
	// submission and feature:<id> per wanted feature.
	feedbackDayKeyPrefix = "stats:feedback:day:"

	maxFeedbackBodyBytes = 32 * 1024
	maxFeedbackTextRunes = 2000
	maxFeedbackEmailLen  = 254

	// feedbackHoneypotField is invisible to people; bots filling every input
	// fill it too.
	feedbackHoneypotField = "website"

	feedbackThanksURL = "/feedback/#thanks"
	feedbackFailedURL = "/feedback/#failed"
)

var (
	feedbackFeatures = []string{
		"request-secret",
		"custom-domain",
		"audit-log",
		"api-keys",
		"chat-integration",
		"larger-files",
	}
	feedbackTeamSizes = []string{"1", "2-10", "11-50", "51-200", "201+"}
	// Where the banner was clicked and which copy it showed. Both are empty on a
	// direct visit or without JS, which the page needs to read the query string.
	feedbackSources  = []string{"ready", "read"}
	feedbackVariants = []string{"1", "2", "3"}
)

// feedbackEntry is what gets stored. It deliberately has no IP address or
// User-Agent field: nothing about the request beyond what the person typed.
type feedbackEntry struct {
	At       time.Time `json:"at"`
	Src      string    `json:"src"`
	V        string    `json:"v"`
	Features []string  `json:"features"`
	TeamSize string    `json:"teamSize"`
	Email    string    `json:"email"`
	Text     string    `json:"text"`
}

var saveFeedbackFunc = saveFeedback

// parseFeedback validates a submitted form. spam reports a filled honeypot,
// which the caller answers as a success without storing anything.
func parseFeedback(form url.Values) (entry feedbackEntry, spam bool, ok bool) {
	if form.Get(feedbackHoneypotField) != "" {
		return feedbackEntry{}, true, true
	}

	// Every field except feature is single-valued; a repeat is not something
	// the page can send.
	for name, values := range form {
		if name != "feature" && len(values) > 1 {
			return feedbackEntry{}, false, false
		}
	}

	src, v := form.Get("src"), form.Get("v")
	if src == "" && v == "" {
		src = "direct"
	} else if !slices.Contains(feedbackSources, src) || !slices.Contains(feedbackVariants, v) {
		return feedbackEntry{}, false, false
	}

	features := []string{}
	for _, feature := range form["feature"] {
		if !slices.Contains(feedbackFeatures, feature) {
			return feedbackEntry{}, false, false
		}
		if !slices.Contains(features, feature) {
			features = append(features, feature)
		}
	}

	teamSize := form.Get("teamSize")
	if teamSize != "" && !slices.Contains(feedbackTeamSizes, teamSize) {
		return feedbackEntry{}, false, false
	}

	email := strings.TrimSpace(form.Get("email"))
	if email != "" && !isValidFeedbackEmail(email) {
		return feedbackEntry{}, false, false
	}

	// Browsers submit textarea newlines as CRLF, so a text at the page's own
	// maxlength would otherwise count one rune over per line break.
	text := strings.TrimSpace(strings.ReplaceAll(form.Get("text"), "\r\n", "\n"))
	if !utf8.ValidString(text) || utf8.RuneCountInString(text) > maxFeedbackTextRunes {
		return feedbackEntry{}, false, false
	}

	if len(features) == 0 && teamSize == "" && email == "" && text == "" {
		return feedbackEntry{}, false, false
	}

	return feedbackEntry{
		Src:      src,
		V:        v,
		Features: features,
		TeamSize: teamSize,
		Email:    email,
		Text:     text,
	}, false, true
}

// isValidFeedbackEmail accepts a bare address with a dotted domain. Display
// names, comments and quoted local parts parse, but none is what a person
// types into an email field.
func isValidFeedbackEmail(email string) bool {
	if len(email) > maxFeedbackEmailLen {
		return false
	}

	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Name != "" || addr.Address != email {
		return false
	}

	domain := email[strings.LastIndex(email, "@")+1:]
	return strings.Contains(strings.Trim(domain, "."), ".")
}

func saveFeedback(entry feedbackEntry, now time.Time) error {
	return saveFeedbackWithClient(getRedisClient(), entry, now)
}

// saveFeedbackWithClient appends the entry and bumps its day counters in one
// transaction, so the counters never count a submission that was not stored.
func saveFeedbackWithClient(client *redis.Client, entry feedbackEntry, now time.Time) error {
	entry.At = now.UTC().Truncate(time.Second)
	value, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	dayKey := feedbackDayKeyPrefix + getStatsDay(now)
	from := "from:" + entry.Src
	if entry.V != "" {
		from += ":" + entry.V
	}

	_, err = client.TxPipelined(func(pipe redis.Pipeliner) error {
		pipe.RPush(feedbackEntriesKey, value)
		pipe.HIncrBy(dayKey, from, 1)
		for _, feature := range entry.Features {
			pipe.HIncrBy(dayKey, "feature:"+feature, 1)
		}
		pipe.Expire(dayKey, statsHistoryTTL)
		return nil
	})
	return err
}

// apiFeedback stores one /feedback/ form submission. It writes its own response
// because the page posts it two ways: fetch with Accept: application/json gets
// {"status": ...}, and a plain form post without JS gets a 303 back to the
// page's thank-you or failure state.
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

	// PostForm, not Form: query-string values must not stand in for fields.
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
