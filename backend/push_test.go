package main

import (
	"bytes"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/go-redis/redis"
)

// testP256dh is a well-formed uncompressed P-256 point: the 0x04 tag plus 64
// bytes of coordinate. Only its shape matters here — nothing in phase 1 does
// elliptic-curve work with it.
func testP256dh() string {
	raw := make([]byte, p256dhByteLen)
	raw[0] = 0x04
	for i := 1; i < len(raw); i++ {
		raw[i] = byte(i)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func testAuth() string {
	raw := make([]byte, authByteLen)
	for i := range raw {
		raw[i] = byte(i + 1)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func enablePushForTest(t *testing.T) {
	t.Helper()

	setVapidForTest(t, "test-public-key", "test-private-key", "mailto:info@1time.io")
}

// setVapidForTest swaps the whole VAPID configuration and restores it after, so
// a test can express "push is off" as precisely as "push is on".
func setVapidForTest(t *testing.T, public string, private string, subject string) {
	t.Helper()

	previousPublic, previousPrivate, previousSubject := vapidPublicKey, vapidPrivateKey, vapidSubject
	vapidPublicKey, vapidPrivateKey, vapidSubject = public, private, subject
	t.Cleanup(func() {
		vapidPublicKey, vapidPrivateKey, vapidSubject = previousPublic, previousPrivate, previousSubject
	})
}

func subscribeRequest(t *testing.T, body string) *http.Request {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/api/subscribeToUpdates", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func validSubscribeBody(id string, manageToken string) string {
	payload := map[string]string{
		"id":          id,
		"manageToken": manageToken,
		"endpoint":    "https://fcm.googleapis.com/fcm/send/abc123",
		"p256dh":      testP256dh(),
		"auth":        testAuth(),
	}
	encoded, _ := json.Marshal(payload)
	return string(encoded)
}

func newTestStorageID(t *testing.T) string {
	t.Helper()

	id, err := generateStorageID()
	if err != nil {
		t.Fatalf("generateStorageID() error: %v", err)
	}
	return id
}

func testManageToken(t *testing.T) string {
	t.Helper()

	token, err := generateManageToken()
	if err != nil {
		t.Fatalf("generateManageToken() error: %v", err)
	}
	return token
}

func TestValidatePushEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		endpoint string
		want     bool
	}{
		{name: "fcm", endpoint: "https://fcm.googleapis.com/fcm/send/abc", want: true},
		{name: "mozilla", endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc", want: true},
		{name: "apple", endpoint: "https://web.push.apple.com/abc", want: true},
		{name: "wns regional suffix", endpoint: "https://db5p.notify.windows.com/w/?token=abc", want: true},
		{name: "uppercase host", endpoint: "https://FCM.googleapis.com/fcm/send/abc", want: true},

		// The SSRF cases. Redis listens on localhost and parses newline-delimited
		// inline commands, so an unvalidated endpoint is a live attack path.
		{name: "localhost redis", endpoint: "http://127.0.0.1:6379/", want: false},
		{name: "cloud metadata", endpoint: "http://169.254.169.254/latest/meta-data/", want: false},
		{name: "https localhost", endpoint: "https://localhost/", want: false},
		{name: "plain http fcm", endpoint: "http://fcm.googleapis.com/fcm/send/abc", want: false},
		{name: "allowlisted name on odd port", endpoint: "https://fcm.googleapis.com:6379/fcm/send/abc", want: false},
		{name: "credentials in url", endpoint: "https://user:pass@fcm.googleapis.com/fcm/send/abc", want: false},
		{name: "suffix must be a label boundary", endpoint: "https://evilnotify.windows.com/w/", want: false},
		{name: "lookalike host", endpoint: "https://fcm.googleapis.com.evil.test/fcm/send/abc", want: false},
		{name: "empty", endpoint: "", want: false},
		{name: "oversized", endpoint: "https://fcm.googleapis.com/fcm/send/" + strings.Repeat("a", maxPushEndpointLen), want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validatePushEndpoint(tt.endpoint); got != tt.want {
				t.Fatalf("validatePushEndpoint(%q) = %v, want %v", tt.endpoint, got, tt.want)
			}
		})
	}
}

func TestValidateSubscriptionKeys(t *testing.T) {
	shortKey := base64.RawURLEncoding.EncodeToString(make([]byte, p256dhByteLen-1))
	compressed := make([]byte, p256dhByteLen)
	compressed[0] = 0x02

	tests := []struct {
		name   string
		p256dh string
		auth   string
		want   bool
	}{
		{name: "valid", p256dh: testP256dh(), auth: testAuth(), want: true},
		{name: "padded base64url is accepted", p256dh: base64.URLEncoding.EncodeToString(func() []byte {
			raw := make([]byte, p256dhByteLen)
			raw[0] = 0x04
			return raw
		}()), auth: base64.URLEncoding.EncodeToString(make([]byte, authByteLen)), want: true},
		{name: "short p256dh", p256dh: shortKey, auth: testAuth(), want: false},
		{name: "compressed point", p256dh: base64.RawURLEncoding.EncodeToString(compressed), auth: testAuth(), want: false},
		{name: "short auth", p256dh: testP256dh(), auth: base64.RawURLEncoding.EncodeToString(make([]byte, authByteLen-1)), want: false},
		{name: "not base64", p256dh: "!!!!", auth: testAuth(), want: false},
		{name: "empty", p256dh: "", auth: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validateSubscriptionKeys(tt.p256dh, tt.auth); got != tt.want {
				t.Fatalf("validateSubscriptionKeys() = %v, want %v", got, tt.want)
			}
		})
	}
}

// A half-configured sender is worse than no sender: it would subscribe a seller who
// then never hears anything. Every incomplete combination must refuse.
func TestSubscribeToUpdatesUnavailableWithoutFullVapidConfig(t *testing.T) {
	tests := []struct {
		name    string
		public  string
		private string
		subject string
	}{
		{name: "nothing configured"},
		{name: "no private key", public: "pub", subject: "mailto:info@1time.io"},
		{name: "no public key", private: "priv", subject: "mailto:info@1time.io"},
		{name: "no subject", public: "pub", private: "priv"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setVapidForTest(t, tt.public, tt.private, tt.subject)

			called := false
			previousAttach := attachPushSubscriptionFunc
			attachPushSubscriptionFunc = func(string, string, PushSubscription) (string, error) {
				called = true
				return attachOK, nil
			}
			t.Cleanup(func() { attachPushSubscriptionFunc = previousAttach })

			code, _ := apiSubscribeToUpdates(subscribeRequest(t, validSubscribeBody(newTestStorageID(t), testManageToken(t))))

			if code != http.StatusServiceUnavailable {
				t.Fatalf("status = %d, want %d", code, http.StatusServiceUnavailable)
			}
			if called {
				t.Fatal("storage must not be touched when push is not configured")
			}
		})
	}
}

func TestSubscribeToUpdatesRejectsBadInputBeforeStorage(t *testing.T) {
	enablePushForTest(t)

	id := newTestStorageID(t)
	token := testManageToken(t)

	tests := []struct {
		name string
		body string
	}{
		{name: "empty body", body: ""},
		{name: "malformed json", body: "{"},
		{name: "bad id", body: strings.Replace(validSubscribeBody(id, token), id, "short", 1)},
		{name: "bad manage token", body: strings.Replace(validSubscribeBody(id, token), token, "short", 1)},
		{
			name: "endpoint pointed at redis",
			body: strings.Replace(
				validSubscribeBody(id, token),
				"https://fcm.googleapis.com/fcm/send/abc123",
				"http://127.0.0.1:6379/", 1),
		},
		{
			name: "malformed subscription key",
			body: strings.Replace(validSubscribeBody(id, token), testP256dh(), "not-a-key", 1),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			called := false
			previousAttach := attachPushSubscriptionFunc
			attachPushSubscriptionFunc = func(string, string, PushSubscription) (string, error) {
				called = true
				return attachOK, nil
			}
			t.Cleanup(func() { attachPushSubscriptionFunc = previousAttach })

			code, _ := apiSubscribeToUpdates(subscribeRequest(t, tt.body))

			if code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", code, http.StatusBadRequest)
			}
			if called {
				t.Fatal("invalid input must be rejected before it can reach Redis")
			}
		})
	}
}

func TestSubscribeToUpdatesResponseShape(t *testing.T) {
	enablePushForTest(t)

	tests := []struct {
		name       string
		status     string
		err        error
		wantCode   int
		wantStatus string
	}{
		{name: "subscribed", status: attachOK, wantCode: http.StatusOK, wantStatus: "ok"},
		{name: "already read", status: attachGone, wantCode: http.StatusOK, wantStatus: "gone"},
		{name: "wrong manage token", status: attachForbidden, wantCode: http.StatusForbidden, wantStatus: "error"},
		{name: "storage failure", err: errors.New("boom"), wantCode: http.StatusInternalServerError, wantStatus: "error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			previousAttach := attachPushSubscriptionFunc
			attachPushSubscriptionFunc = func(string, string, PushSubscription) (string, error) {
				return tt.status, tt.err
			}
			t.Cleanup(func() { attachPushSubscriptionFunc = previousAttach })

			code, body := apiSubscribeToUpdates(subscribeRequest(t, validSubscribeBody(newTestStorageID(t), testManageToken(t))))

			if code != tt.wantCode {
				t.Fatalf("status = %d, want %d", code, tt.wantCode)
			}

			var decoded struct {
				Status string `json:"status"`
			}
			if err := json.Unmarshal(body, &decoded); err != nil {
				t.Fatalf("unmarshal response: %v", err)
			}
			if decoded.Status != tt.wantStatus {
				t.Fatalf("body status = %q, want %q", decoded.Status, tt.wantStatus)
			}

			// The client must never be able to read "subscribed" out of a failure.
			if tt.wantCode != http.StatusOK && decoded.Status == "ok" {
				t.Fatal("a non-200 response must not report success")
			}
		})
	}
}

func TestAttachPushSubscriptionStoresWithSecretTTL(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	token := testManageToken(t)
	ttl := 90 * time.Minute
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted:  true,
		Message:    "ciphertext",
		HashedKey:  testHashedKey,
		Version:    secretSchemeV3,
		ManageHash: hashManageToken(token),
	}, ttl)

	subscription := PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	}

	status, err := attachPushSubscriptionWithClient(client, id, token, subscription)
	if err != nil {
		t.Fatalf("attachPushSubscriptionWithClient() error: %v", err)
	}
	if status != attachOK {
		t.Fatalf("status = %q, want %q", status, attachOK)
	}
	stored, err := client.Get(getPushStoreKey(id)).Result()
	if err != nil {
		t.Fatalf("read stored subscription: %v", err)
	}
	var decoded PushSubscription
	if err := json.Unmarshal([]byte(stored), &decoded); err != nil {
		t.Fatalf("unmarshal stored subscription: %v", err)
	}
	if decoded != subscription {
		t.Fatalf("stored subscription = %+v, want %+v", decoded, subscription)
	}

	// The subscription must expire with the secret it describes, so nothing has
	// to clean it up explicitly.
	pushTTL, err := client.PTTL(getPushStoreKey(id)).Result()
	if err != nil {
		t.Fatalf("PTTL error: %v", err)
	}
	secretTTL, err := client.PTTL(getStoreKey(id)).Result()
	if err != nil {
		t.Fatalf("PTTL error: %v", err)
	}
	drift := pushTTL - secretTTL
	if drift < -time.Second || drift > time.Second {
		t.Fatalf("push TTL %v drifts from secret TTL %v by %v", pushTTL, secretTTL, drift)
	}
}

func TestAttachPushSubscriptionRejectsForeignManageToken(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	ownerToken := testManageToken(t)
	// What a reader who has the share link — and therefore the id — could try.
	readerToken := testManageToken(t)

	storeTestMessage(t, client, id, StoredMessage{
		Encrypted:  true,
		Message:    "ciphertext",
		HashedKey:  testHashedKey,
		Version:    secretSchemeV3,
		ManageHash: hashManageToken(ownerToken),
	}, time.Hour)

	status, err := attachPushSubscriptionWithClient(client, id, readerToken, PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/attacker",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	})
	if err != nil {
		t.Fatalf("attachPushSubscriptionWithClient() error: %v", err)
	}
	if status != attachForbidden {
		t.Fatalf("status = %q, want %q", status, attachForbidden)
	}

	// The sender's notification must not be silenceable by the counterparty.
	if err := client.Get(getPushStoreKey(id)).Err(); err != redis.Nil {
		t.Fatalf("nothing should have been stored, got err=%v", err)
	}
}

func TestAttachPushSubscriptionLegacyRecordCannotBeSubscribed(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: testHashedKey,
		Version:   secretSchemeV3,
	}, time.Hour)

	status, err := attachPushSubscriptionWithClient(client, id, testManageToken(t), PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	})
	if err != nil {
		t.Fatalf("attachPushSubscriptionWithClient() error: %v", err)
	}
	if status != attachForbidden {
		t.Fatalf("status = %q, want %q", status, attachForbidden)
	}
}

func TestAttachPushSubscriptionGoneWhenSecretAlreadyRead(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	token := testManageToken(t)

	// Nothing stored: the buyer opened the link between creation and subscribing.
	status, err := attachPushSubscriptionWithClient(client, id, token, PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	})
	if err != nil {
		t.Fatalf("attachPushSubscriptionWithClient() error: %v", err)
	}
	if status != attachGone {
		t.Fatalf("status = %q, want %q", status, attachGone)
	}
	if err := client.Get(getPushStoreKey(id)).Err(); err != redis.Nil {
		t.Fatalf("nothing should have been stored, got err=%v", err)
	}
}

func TestAttachPushSubscriptionArmsMultiViewSecretWithReadsLeft(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	token := testManageToken(t)
	// A 3-view secret that has already been opened once still has reads coming,
	// so it must still accept a subscription.
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted:  true,
		Message:    "ciphertext",
		HashedKey:  testHashedKey,
		Version:    secretSchemeV3,
		Views:      2,
		ManageHash: hashManageToken(token),
	}, time.Hour)

	status, err := attachPushSubscriptionWithClient(client, id, token, PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	})
	if err != nil {
		t.Fatalf("attachPushSubscriptionWithClient() error: %v", err)
	}
	if status != attachOK {
		t.Fatalf("status = %q, want %q", status, attachOK)
	}
}

func TestAttachPushSubscriptionFindsFileSecrets(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	token := testManageToken(t)
	storeTestFile(t, client, id, StoredFile{
		Encrypted:  true,
		FileUri:    "/tmp/nonexistent.enc",
		HashedKey:  testHashedKey,
		Version:    secretSchemeV3,
		ManageHash: hashManageToken(token),
	}, time.Hour)

	status, err := attachPushSubscriptionWithClient(client, id, token, PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	})
	if err != nil {
		t.Fatalf("attachPushSubscriptionWithClient() error: %v", err)
	}
	if status != attachOK {
		t.Fatalf("status = %q, want %q", status, attachOK)
	}
	// One prefix serves both stores, so a file secret's subscription lands under
	// the same key a message secret's would.
	if err := client.Get(getPushStoreKey(id)).Err(); err != nil {
		t.Fatalf("subscription should live under pushKey<id>: %v", err)
	}
}

func TestManageTokenHashingIsConstantTimeComparable(t *testing.T) {
	token := testManageToken(t)
	hash := hashManageToken(token)

	if !manageTokenMatches(hash, token) {
		t.Fatal("the minted token must match its own hash")
	}
	if manageTokenMatches(hash, testManageToken(t)) {
		t.Fatal("a different token must not match")
	}
	// Every record written before this feature has an empty hash.
	if manageTokenMatches("", token) {
		t.Fatal("an empty stored hash must never match")
	}
	if !isValidManageToken(token) {
		t.Fatalf("generateManageToken() produced a token isValidManageToken rejects: %q", token)
	}
}

// The frontend learns three things from a save response: the id, whether push is
// available at all, and the token that proves it created this secret. Getting
// that contract wrong either silently disables the feature or hands the manage
// capability to nobody.
func TestAPISaveSecretReturnsManageTokenWhenPushEnabled(t *testing.T) {
	restoreHandlerHooks(t)
	enablePushForTest(t)

	var stored StoredMessage
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
		if err := json.Unmarshal(value.([]byte), &stored); err != nil {
			t.Fatalf("stored payload is not StoredMessage JSON: %v", err)
		}
		return "msg123", nil
	}

	body := `{"secretMessage":"ciphertext","readTokenHash":"` + testHashedKey + `","v":3}`
	code, response := apiSaveSecret(httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(body)))
	if code != http.StatusOK {
		t.Fatalf("status = %d, want %d", code, http.StatusOK)
	}

	var decoded struct {
		Status         string `json:"status"`
		ManageToken    string `json:"manageToken"`
		VapidPublicKey string `json:"vapidPublicKey"`
	}
	if err := json.Unmarshal(response, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if decoded.Status != "ok" {
		t.Fatalf("status = %q, want ok", decoded.Status)
	}
	if !isValidManageToken(decoded.ManageToken) {
		t.Fatalf("manageToken = %q, want a well-formed token", decoded.ManageToken)
	}
	if decoded.VapidPublicKey != vapidPublicKey {
		t.Fatalf("vapidPublicKey = %q, want %q", decoded.VapidPublicKey, vapidPublicKey)
	}

	// Only the hash is ever stored, so a database leak cannot subscribe anything.
	if stored.ManageHash != hashManageToken(decoded.ManageToken) {
		t.Fatal("stored ManageHash must be the hash of the returned token")
	}
	if strings.Contains(string(response), stored.ManageHash) {
		t.Fatal("the stored hash must not be echoed to the client")
	}
}

func TestAPISaveSecretOmitsPushFieldsWhenNotConfigured(t *testing.T) {
	restoreHandlerHooks(t)

	setVapidForTest(t, "", "", "")

	var stored StoredMessage
	saveToStorageFunc = func(value interface{}, duration time.Duration, views int) (string, error) {
		if err := json.Unmarshal(value.([]byte), &stored); err != nil {
			t.Fatalf("stored payload is not StoredMessage JSON: %v", err)
		}
		return "msg123", nil
	}

	body := `{"secretMessage":"ciphertext","readTokenHash":"` + testHashedKey + `","v":3}`
	_, response := apiSaveSecret(httptest.NewRequest(http.MethodPost, "/api/saveSecret", strings.NewReader(body)))

	// Absence is how a self-hosted client learns push is unavailable, so neither
	// key should appear at all rather than appear empty. Subscribing is the token's
	// only consumer, so a deployment without VAPID keys stores no hash either.
	if strings.Contains(string(response), "manageToken") {
		t.Fatalf("response = %s, want no manageToken key", response)
	}
	if strings.Contains(string(response), "vapidPublicKey") {
		t.Fatalf("response = %s, want no vapidPublicKey key", response)
	}
	if stored.ManageHash != "" {
		t.Fatal("no manage hash should be stored when push is unavailable")
	}
}

// realVapidKeys mints a genuine P-256 pair in the encoding webpush-go expects:
// unpadded base64url of the raw 65-byte public point and 32-byte private scalar.
// The send path does real ECDH and JWT work, so placeholder strings will not do.
func realVapidKeys(t *testing.T) (public string, private string) {
	t.Helper()

	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate VAPID key: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()),
		base64.RawURLEncoding.EncodeToString(key.Bytes())
}

// realSubscriptionKeys stands in for what a browser's PushManager produces.
func realSubscriptionKeys(t *testing.T) (p256dh string, auth string) {
	t.Helper()

	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate subscription key: %v", err)
	}
	authSecret := make([]byte, authByteLen)
	if _, err := rand.Read(authSecret); err != nil {
		t.Fatalf("generate auth secret: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()),
		base64.RawURLEncoding.EncodeToString(authSecret)
}

func TestAPIGetMessageNotifiesSenderOnSuccessfulRead(t *testing.T) {
	restoreHandlerHooks(t)

	consumeMessageFromStorageFunc = func(string, string) (StoredMessage, int, int, string, error) {
		return StoredMessage{Message: "ciphertext", HashedKey: testHashedKey, Encrypted: true}, 2, 3600, "ok", nil
	}

	var gotID, gotKind string
	gotViewsLeft := -1
	previousNotify := notifySecretReadFunc
	notifySecretReadFunc = func(id string, kind string, viewsLeft int) {
		gotID, gotKind, gotViewsLeft = id, kind, viewsLeft
	}
	t.Cleanup(func() { notifySecretReadFunc = previousNotify })

	id := newTestStorageID(t)
	body := `{"id":"` + id + `","hashedKey":"` + testHashedKey + `"}`
	code, _ := apiGetMessage(httptest.NewRequest(http.MethodPost, "/api/get", strings.NewReader(body)))
	if code != http.StatusOK {
		t.Fatalf("status = %d, want %d", code, http.StatusOK)
	}

	if gotID != id {
		t.Fatalf("notified id = %q, want %q", gotID, id)
	}
	if gotKind != pushKindMessage {
		t.Fatalf("notified kind = %q, want %q", gotKind, pushKindMessage)
	}
	// Carried through so the notification can say "2 views left".
	if gotViewsLeft != 2 {
		t.Fatalf("notified viewsLeft = %d, want 2", gotViewsLeft)
	}
}

func TestAPIGetMessageDoesNotNotifyWhenNothingWasRead(t *testing.T) {
	tests := []struct {
		name   string
		status string
	}{
		{name: "wrong key", status: "wrong key"},
		{name: "no message", status: "no message"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreHandlerHooks(t)

			consumeMessageFromStorageFunc = func(string, string) (StoredMessage, int, int, string, error) {
				return StoredMessage{}, 0, 0, tt.status, nil
			}

			notified := false
			previousNotify := notifySecretReadFunc
			notifySecretReadFunc = func(string, string, int) { notified = true }
			t.Cleanup(func() { notifySecretReadFunc = previousNotify })

			body := `{"id":"` + newTestStorageID(t) + `","hashedKey":"` + testHashedKey + `"}`
			apiGetMessage(httptest.NewRequest(http.MethodPost, "/api/get", strings.NewReader(body)))

			// A sender must never be told their secret was read when it was not.
			if notified {
				t.Fatalf("a %q outcome must not notify the sender", tt.status)
			}
		})
	}
}

// The ordering that closes the subscribe race: the subscription lives under its own
// key, so consuming the secret leaves it readable. Were it stored on the record
// itself, the final read would destroy the very thing needed to send.
func TestPushSubscriptionOutlivesTheSecretItDescribes(t *testing.T) {
	client := startTestRedis(t)

	id := newTestStorageID(t)
	token := testManageToken(t)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted:  true,
		Message:    "ciphertext",
		HashedKey:  testHashedKey,
		Version:    0,
		ManageHash: hashManageToken(token),
	}, time.Hour)

	subscription := PushSubscription{
		Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
		P256dh:   testP256dh(),
		Auth:     testAuth(),
	}
	if status, err := attachPushSubscriptionWithClient(client, id, token, subscription); err != nil || status != attachOK {
		t.Fatalf("attach = (%q, %v), want ok", status, err)
	}

	// Burn the secret, exactly as a reader would.
	_, _, _, status, err := consumeMessageFromStorageWithClient(client, id, testHashedKey)
	if err != nil || status != "ok" {
		t.Fatalf("consume = (%q, %v), want ok", status, err)
	}
	if err := client.Get(getStoreKey(id)).Err(); err != redis.Nil {
		t.Fatalf("secret should be gone, got err=%v", err)
	}

	loaded, found, err := loadPushSubscriptionWithClient(client, id)
	if err != nil {
		t.Fatalf("loadPushSubscriptionWithClient() error: %v", err)
	}
	if !found {
		t.Fatal("the subscription must survive the read that triggers it")
	}
	if loaded != subscription {
		t.Fatalf("loaded = %+v, want %+v", loaded, subscription)
	}
}

func TestSendPushNotificationRequestShape(t *testing.T) {
	public, private := realVapidKeys(t)
	setVapidForTest(t, public, private, "mailto:info@1time.io")

	type captured struct {
		ttl           string
		topic         string
		urgency       string
		authorization string
		contentType   string
		body          []byte
	}
	seen := make(chan captured, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen <- captured{
			ttl:           r.Header.Get("TTL"),
			topic:         r.Header.Get("Topic"),
			urgency:       r.Header.Get("Urgency"),
			authorization: r.Header.Get("Authorization"),
			contentType:   r.Header.Get("Content-Type"),
			body:          body,
		}
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(server.Close)

	p256dh, auth := realSubscriptionKeys(t)
	id := newTestStorageID(t)
	readAt := time.Now().Add(-3 * time.Hour).Unix()

	sendPushNotification(id, PushSubscription{
		Endpoint: server.URL,
		P256dh:   p256dh,
		Auth:     auth,
	}, pushPayload{Id: id, Kind: pushKindMessage, ViewsLeft: 2, ReadAt: readAt})

	var got captured
	select {
	case got = <-seen:
	case <-time.After(5 * time.Second):
		t.Fatal("push service was never called")
	}

	if got.ttl != strconv.Itoa(pushMessageTTL) {
		t.Fatalf("TTL header = %q, want %q", got.ttl, strconv.Itoa(pushMessageTTL))
	}
	// No Topic header: it is plaintext, and the only available collapse key is
	// the storage id, which would hand the push provider the secret's identity
	// alongside the endpoint it delivers to.
	if got.topic != "" {
		t.Fatalf("Topic header = %q, want it absent", got.topic)
	}
	if strings.Contains(got.topic, id) {
		t.Fatal("the secret id must not appear in any plaintext header")
	}
	if got.urgency != string(webpush.UrgencyHigh) {
		t.Fatalf("Urgency header = %q, want %q", got.urgency, webpush.UrgencyHigh)
	}
	if !strings.HasPrefix(got.authorization, "vapid ") {
		t.Fatalf("Authorization = %q, want a vapid scheme", got.authorization)
	}
	if got.contentType != "application/octet-stream" {
		t.Fatalf("Content-Type = %q, want application/octet-stream", got.contentType)
	}

	// The push service relays ciphertext it cannot read. Nothing identifying the
	// secret may be legible in what crosses the wire.
	if len(got.body) == 0 {
		t.Fatal("payload body was empty")
	}
	if bytes.Contains(got.body, []byte(id)) {
		t.Fatal("the secret id must not appear in the encrypted payload")
	}
	if bytes.Contains(got.body, []byte(pushKindMessage)) {
		t.Fatal("the payload must not be transmitted in the clear")
	}
}

func TestSendPushNotificationDropsDeadSubscription(t *testing.T) {
	public, private := realVapidKeys(t)
	setVapidForTest(t, public, private, "mailto:info@1time.io")

	tests := []struct {
		name       string
		statusCode int
		wantDelete bool
	}{
		{name: "gone", statusCode: http.StatusGone, wantDelete: true},
		{name: "not found", statusCode: http.StatusNotFound, wantDelete: true},
		{name: "accepted", statusCode: http.StatusCreated, wantDelete: false},
		{name: "server error", statusCode: http.StatusInternalServerError, wantDelete: false},
		{name: "rate limited", statusCode: http.StatusTooManyRequests, wantDelete: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
			}))
			t.Cleanup(server.Close)

			deleted := false
			previousDelete := deletePushSubscriptionFunc
			deletePushSubscriptionFunc = func(string) error {
				deleted = true
				return nil
			}
			t.Cleanup(func() { deletePushSubscriptionFunc = previousDelete })

			p256dh, auth := realSubscriptionKeys(t)
			id := newTestStorageID(t)
			sendPushNotification(id, PushSubscription{
				Endpoint: server.URL,
				P256dh:   p256dh,
				Auth:     auth,
			}, pushPayload{Id: id, Kind: pushKindMessage, ReadAt: time.Now().Unix()})

			if deleted != tt.wantDelete {
				t.Fatalf("subscription deleted = %v, want %v (push service said %d)", deleted, tt.wantDelete, tt.statusCode)
			}
		})
	}
}

func TestNotifySecretReadIsSilentWithoutPushConfigured(t *testing.T) {
	setVapidForTest(t, "", "", "")

	previousLoad := loadPushSubscriptionFunc
	loadPushSubscriptionFunc = func(string) (PushSubscription, bool, error) {
		t.Error("storage must not be touched when push is not configured")
		return PushSubscription{}, false, nil
	}
	t.Cleanup(func() { loadPushSubscriptionFunc = previousLoad })

	notifySecretRead(newTestStorageID(t), pushKindMessage, 0)
	// notifySecretRead returns before its goroutine would run; give a stubbed
	// lookup a chance to fire and fail the test if it does.
	time.Sleep(50 * time.Millisecond)
}

// A send failure must never write the endpoint to a log. net/http wraps
// transport errors in *url.Error, whose Error() embeds the request URL in full —
// so the naive `log.Printf("%v", err)` writes the capability token, and anything
// able to POST to that URL can push to the sender's browser.
func TestSendErrorNeverLogsTheEndpoint(t *testing.T) {
	public, private := realVapidKeys(t)
	setVapidForTest(t, public, private, "mailto:info@1time.io")

	var logged bytes.Buffer
	previousOutput := log.Writer()
	previousFlags := log.Flags()
	log.SetOutput(&logged)
	log.SetFlags(0)
	t.Cleanup(func() {
		log.SetOutput(previousOutput)
		log.SetFlags(previousFlags)
	})

	// Started then immediately closed, so the connection is refused at once and
	// net/http produces the *url.Error this test is about — without waiting out
	// pushSendTimeout.
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	server.Close()

	const token = "SUPERSECRETCAPABILITYTOKEN"
	endpoint := server.URL + "/fcm/send/" + token

	p256dh, auth := realSubscriptionKeys(t)
	sendPushNotification(newTestStorageID(t), PushSubscription{
		Endpoint: endpoint,
		P256dh:   p256dh,
		Auth:     auth,
	}, pushPayload{Id: "x", Kind: pushKindMessage, ReadAt: time.Now().Unix()})

	output := logged.String()
	if output == "" {
		t.Fatal("expected a failure to be logged")
	}
	if strings.Contains(output, token) {
		t.Fatalf("the capability token leaked into the log: %s", output)
	}
	if strings.Contains(output, endpoint) {
		t.Fatalf("the full endpoint leaked into the log: %s", output)
	}
	// The provider still has to be identifiable for the log to be useful.
	if !strings.Contains(output, pushEndpointHost(endpoint)) {
		t.Fatalf("log should name the provider host, got: %s", output)
	}
}
