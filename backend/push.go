package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// Web Push needs an application-server (VAPID) key pair. The PRIVATE key signs
// the JWT that proves to a push service we are entitled to push to a
// subscription; the PUBLIC key is handed to the browser at subscribe time and is
// public by design.
//
// The public key is returned on every save response rather than baked into the
// frontend bundle, so self-hosting is a matter of setting an env var instead of
// rebuilding the static site. Its absence is also the feature flag: no keys
// configured means no push offered, with no separate config endpoint to probe.
var vapidPublicKey = os.Getenv("VAPID_PUBLIC_KEY")
var vapidPrivateKey = os.Getenv("VAPID_PRIVATE_KEY")

// vapidSubject is the abuse contact carried in the "sub" claim of every push
// JWT, as a mailto: or https: URI. Push services use it to reach the operator of
// a misbehaving application server; Mozilla rejects a push without it.
//
// It has no default in code on purpose. A self-hosted deployment that inherited
// one would send someone else's contact address to Google, Mozilla and Apple on
// every push, and abuse reports about that server would arrive in the wrong
// inbox. The value lives in the deployment config instead.
var vapidSubject = os.Getenv("VAPID_SUBJECT")

// vapidPrivateByteLen is the raw P-256 scalar behind a VAPID private key.
const vapidPrivateByteLen = 32

// describeVapidKeyProblem reports what is wrong with the configured key pair and
// subject, or "" if they are well formed. pushEnabled deliberately does not
// apply these checks — it only asks whether values are present, so a local run
// with placeholders can still exercise subscribing.
func describeVapidKeyProblem() string {
	decoded, ok := decodeSubscriptionKey(vapidPublicKey)
	if !ok || len(decoded) != p256dhByteLen || decoded[0] != 0x04 {
		return "VAPID_PUBLIC_KEY is not a base64url-encoded uncompressed P-256 point"
	}

	decoded, ok = decodeSubscriptionKey(vapidPrivateKey)
	if !ok || len(decoded) != vapidPrivateByteLen {
		return "VAPID_PRIVATE_KEY is not a base64url-encoded 32-byte P-256 scalar"
	}

	// RFC 8292: the "sub" claim must be a mailto: or https: contact URI.
	if !strings.HasPrefix(vapidSubject, "mailto:") && !strings.HasPrefix(vapidSubject, "https://") {
		return "VAPID_SUBJECT must be a mailto: or https:// URI"
	}

	return ""
}

// logPushConfiguration says once, at startup, whether notifications are on.
// A half-configured deployment otherwise omits the push fields from every save
// response with nothing in a request to explain why.
func logPushConfiguration() {
	missing := []string{}
	for name, value := range map[string]string{
		"VAPID_PUBLIC_KEY":  vapidPublicKey,
		"VAPID_PRIVATE_KEY": vapidPrivateKey,
		"VAPID_SUBJECT":     vapidSubject,
	} {
		if value == "" {
			missing = append(missing, name)
		}
	}

	if len(missing) > 0 {
		sort.Strings(missing)
		log.Printf("Push notifications disabled, missing: %s", strings.Join(missing, ", "))
		return
	}
	if problem := describeVapidKeyProblem(); problem != "" {
		log.Printf("Push notifications MISCONFIGURED: %s — every notification will fail to send", problem)
		return
	}

	log.Printf("Push notifications enabled (subject %s)", vapidSubject)
}

// mintManageToken returns a fresh manage token and the hash to store beside the
// secret.
//
// It lives in this file rather than beside the token primitives in storage.go
// because the rule it encodes is a push decision, not a storage one: subscribing is
// the token's only consumer, so a deployment without VAPID keys gets no token
// and no hash on the record rather than a field nothing will ever read. Keeping
// it here also leaves storage.go with no dependency on push at all.
//
// Empty strings rather than an error, so callers need no branch — a secret that
// could not be given a token is still worth storing unsubscribed.
func mintManageToken() (token string, hash string) {
	if !pushEnabled() {
		return "", ""
	}

	minted, err := generateManageToken()
	if err != nil {
		log.Println(err)
		return "", ""
	}

	return minted, hashManageToken(minted)
}

// pushEnabled reports whether this deployment can send notifications at all.
// All three values are required: a half-configured sender would subscribe senders who
// then never hear anything.
func pushEnabled() bool {
	return vapidPublicKey != "" && vapidPrivateKey != "" && vapidSubject != ""
}

// maxSubscribeBodyBytes caps the /api/subscribeToUpdates request body. A real
// subscription is well under 1 KB: an endpoint of a few hundred characters plus
// two short keys, an id and a manage token.
const maxSubscribeBodyBytes = 4 * 1024

// maxPushEndpointLen bounds the endpoint URL before it is parsed.
const maxPushEndpointLen = 1024

// p256dhByteLen is an uncompressed P-256 point: a 0x04 tag and two 32-byte
// coordinates. authByteLen is the shared secret from RFC 8291.
const p256dhByteLen = 65
const authByteLen = 16

// pushEndpointHosts is the allowlist of hosts this server will POST to.
//
// The endpoint arrives from the client, and the server later makes an outbound
// request to it — an unvalidated one is a server-side request forgery vector,
// and it is a sharp one here because Redis listens on localhost and parses
// newline-delimited inline commands. Validating at write time keeps a hostile
// endpoint out of storage entirely rather than relying on the send path to
// notice.
//
// The cost of an allowlist is that a browser shipping a new push service is
// rejected until its host is added here. That is the right trade.
var pushEndpointHosts = map[string]bool{
	"fcm.googleapis.com":                true, // Chrome, Edge, Chromium forks
	"updates.push.services.mozilla.com": true, // Firefox
	"web.push.apple.com":                true, // Safari
}

// pushEndpointHostSuffixes covers services that shard across per-region
// hostnames. Matched only on a full label boundary, so "evilnotify.windows.com"
// cannot pass as "notify.windows.com".
var pushEndpointHostSuffixes = []string{
	".notify.windows.com", // WNS, older Edge
}

// validatePushEndpoint reports whether endpoint is one this server is willing to
// send to. Anything but plain https to an allowlisted host is refused.
func validatePushEndpoint(endpoint string) bool {
	if endpoint == "" || len(endpoint) > maxPushEndpointLen {
		return false
	}

	parsed, err := url.Parse(endpoint)
	if err != nil {
		return false
	}
	if parsed.Scheme != "https" {
		return false
	}
	// Credentials in the URL would be sent onward by the push sender.
	if parsed.User != nil {
		return false
	}
	// A port would let an allowlisted name be aimed at an unexpected service.
	if parsed.Port() != "" {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	if pushEndpointHosts[host] {
		return true
	}
	for _, suffix := range pushEndpointHostSuffixes {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}

	return false
}

// pushEndpointHost reduces an endpoint to the provider it names. The full URL is
// a capability: anything able to POST to it can push to that browser, so it must
// never reach a log file that outlives the secret.
func pushEndpointHost(endpoint string) string {
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" {
		return "unknown"
	}

	return parsed.Host
}

// describeSendError reduces a send failure to something safe to log.
//
// net/http wraps every transport failure in *url.Error, and its Error() embeds
// the request URL in full — so logging the raw error would write the whole
// subscription endpoint, capability token included, on each timeout or reset.
// Unwrapping leaves the cause without the URL.
func describeSendError(err error) string {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		if urlErr.Timeout() {
			return "timeout"
		}
		if urlErr.Err != nil {
			return urlErr.Err.Error()
		}
		return "request failed"
	}

	return err.Error()
}

// decodeSubscriptionKey decodes one of the browser-supplied subscription keys.
//
// Browsers emit unpadded base64url and pushNotifications.js forwards it
// verbatim, so RawURLEncoding is the only form that occurs in practice. The
// padded variant is kept because it costs nothing and a third-party client could
// reasonably send it; the standard alphabet is not, since '+' and '/' never
// appear in a value the Push API produced.
func decodeSubscriptionKey(value string) ([]byte, bool) {
	for _, encoding := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding} {
		if decoded, err := encoding.DecodeString(value); err == nil {
			return decoded, true
		}
	}

	return nil, false
}

// validateSubscriptionKeys reports whether the ECDH public key and auth secret
// have the exact sizes RFC 8291 requires. Checking here means the send path
// never has to defend against a malformed record.
func validateSubscriptionKeys(p256dh string, auth string) bool {
	decodedP256dh, ok := decodeSubscriptionKey(p256dh)
	if !ok || len(decodedP256dh) != p256dhByteLen {
		return false
	}
	// Uncompressed point tag; compressed points are not what the Push API emits.
	if decodedP256dh[0] != 0x04 {
		return false
	}

	decodedAuth, ok := decodeSubscriptionKey(auth)
	if !ok || len(decodedAuth) != authByteLen {
		return false
	}

	return true
}

var attachPushSubscriptionFunc = attachPushSubscription

// apiSubscribeToUpdates subscribes the sender of a secret to a read notification.
//
// The response carries only two values, because only two outcomes are the
// client's business: "ok" means a notification is coming, "gone" means the
// secret has already been read and none ever will. Everything else rides the
// HTTP status, so the client can treat any non-200 as "not subscribed" without
// parsing a body. What it must never do is claim success it does not have — a
// sender who believes they are subscribed and hears nothing concludes their secret
// was never read.
func apiSubscribeToUpdates(r *http.Request) (responseCode int, response []byte) {
	jResponse := struct {
		Status string `json:"status"`
	}{Status: "error"}

	if !pushEnabled() {
		response, _ = json.Marshal(jResponse)
		return http.StatusServiceUnavailable, response
	}

	r.Body = http.MaxBytesReader(nil, r.Body, maxSubscribeBodyBytes)

	var payload struct {
		Id          string `json:"id"`
		ManageToken string `json:"manageToken"`
		Endpoint    string `json:"endpoint"`
		P256dh      string `json:"p256dh"`
		Auth        string `json:"auth"`
	}

	dec := json.NewDecoder(r.Body)
	if !dec.More() {
		response, _ = json.Marshal(jResponse)
		return http.StatusBadRequest, response
	}
	if err := dec.Decode(&payload); err != nil {
		log.Println(err)
		response, _ = json.Marshal(jResponse)
		return http.StatusBadRequest, response
	}

	if !isValidStorageID(payload.Id) ||
		!isValidManageToken(payload.ManageToken) ||
		!validatePushEndpoint(payload.Endpoint) ||
		!validateSubscriptionKeys(payload.P256dh, payload.Auth) {
		response, _ = json.Marshal(jResponse)
		return http.StatusBadRequest, response
	}

	subscription := PushSubscription{
		Endpoint: payload.Endpoint,
		P256dh:   payload.P256dh,
		Auth:     payload.Auth,
	}

	status, err := attachPushSubscriptionFunc(payload.Id, payload.ManageToken, subscription)
	if err != nil {
		log.Println(err)
		response, _ = json.Marshal(jResponse)
		return http.StatusInternalServerError, response
	}

	switch status {
	case attachOK:
		jResponse.Status = "ok"
		response, _ = json.Marshal(jResponse)
		return http.StatusOK, response
	case attachGone:
		jResponse.Status = "gone"
		response, _ = json.Marshal(jResponse)
		return http.StatusOK, response
	default:
		// Wrong manage token, or a record predating the feature. Both mean the
		// caller cannot prove they created this secret.
		response, _ = json.Marshal(jResponse)
		return http.StatusForbidden, response
	}
}

// The notification says "viewed" for a message and "downloaded" for a file. The
// kind comes from whichever read endpoint fired — apiGetMessage or apiGetFile —
// never from anything the client sent.
const (
	pushKindMessage = "message"
	pushKindFile    = "file"
)

// pushSendTimeout bounds the outbound request to a push service. It runs on its
// own goroutine with its own context, so this never delays a reader — but an
// unbounded request would leak goroutines against a hanging endpoint.
const pushSendTimeout = 15 * time.Second

// pushMessageTTL is how long a push service should hold a notification that
// cannot be delivered yet, in seconds. Generous on purpose: push services are
// store-and-forward, so a sender whose laptop is asleep still learns their
// secret was read when they next open it. Only after this does the message get
// dropped for good.
const pushMessageTTL = 24 * 60 * 60

// pushPayload is what the service worker receives, encrypted end-to-end per RFC
// 8291 — the push service relays it without being able to read it.
//
// It carries no human-readable label. The two-word name shown in the
// notification is derived from the id by nameForId, which is a pure function, so
// the worker computes "brave-otter" locally and nothing resembling a title ever
// crosses the wire.
type pushPayload struct {
	Id   string `json:"id"`
	Kind string `json:"kind"`
	// ViewsLeft renders as "2 views left" only when positive, so the ordinary
	// one-time notification stays a single clean line.
	ViewsLeft int `json:"viewsLeft"`
	// ReadAt is a Unix timestamp, not a formatted time. The worker renders
	// Date.now() - readAt as an elapsed duration, which needs no time zone and
	// stops a notification delivered hours late from implying "just now".
	ReadAt int64 `json:"readAt"`
}

var notifySecretReadFunc = notifySecretRead

// Indirected like the other storage hooks in handlers.go so the send path can be
// exercised without a live Redis.
var loadPushSubscriptionFunc = loadPushSubscription
var deletePushSubscriptionFunc = deletePushSubscription

// notifySecretRead tells a sender their secret has just been read.
//
// Everything happens on a separate goroutine, including the Redis lookup: the
// reader has already been answered by the time this is called, and nothing about
// delivering a notification is worth a millisecond of their response. A failure
// here is invisible to both parties by design — My Secrets remains the durable
// record of whether a secret was read, and push is only the accelerant.
func notifySecretRead(id string, kind string, viewsLeft int) {
	if !pushEnabled() {
		return
	}

	// Captured here rather than inside the goroutine so the timestamp reflects
	// the read itself, not whenever the goroutine happened to be scheduled.
	readAt := time.Now().Unix()

	go func() {
		subscription, found, err := loadPushSubscriptionFunc(id)
		if err != nil {
			log.Printf("loadPushSubscription error: %v", err)
			return
		}
		if !found {
			return
		}

		sendPushNotification(id, subscription, pushPayload{
			Id:        id,
			Kind:      kind,
			ViewsLeft: viewsLeft,
			ReadAt:    readAt,
		})
	}()
}

// sendPushNotification encrypts the payload to the subscription's own keys,
// signs a VAPID JWT, and POSTs it to the endpoint the browser chose.
func sendPushNotification(id string, subscription PushSubscription, payload pushPayload) {
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("marshal push payload: %v", err)
		return
	}

	// Its own context: the request context is cancelled the moment the handler
	// returns, which is always before this runs.
	ctx, cancel := context.WithTimeout(context.Background(), pushSendTimeout)
	defer cancel()

	response, err := webpush.SendNotificationWithContext(ctx, body, &webpush.Subscription{
		Endpoint: subscription.Endpoint,
		Keys: webpush.Keys{
			P256dh: subscription.P256dh,
			Auth:   subscription.Auth,
		},
	}, &webpush.Options{
		Subscriber:      vapidSubject,
		VAPIDPublicKey:  vapidPublicKey,
		VAPIDPrivateKey: vapidPrivateKey,
		TTL:             pushMessageTTL,
		Urgency:         webpush.UrgencyHigh,
		// No Topic header. It would collapse queued notifications for one secret
		// at the push service, but the only available collapse key is the
		// storage id — and Topic travels as a PLAINTEXT header, so the push
		// provider would learn which secret each notification belongs to and
		// could tie it to the browser endpoint it delivers to. The id also
		// appears in the share link, so a provider seeing that link elsewhere
		// could link a sender's browser to a specific secret.
		//
		// The payload encryption does not help here: headers are outside it. The
		// service worker's notification tag already collapses repeats on
		// arrival, so dropping this costs only bandwidth for a multi-view secret
		// read several times while the browser was offline.
	})
	if err != nil {
		log.Printf("send push notification to %s: %s", pushEndpointHost(subscription.Endpoint), describeSendError(err))
		return
	}
	defer response.Body.Close()
	// Drain so the connection can be reused.
	_, _ = io.Copy(io.Discard, response.Body)

	switch {
	case response.StatusCode == http.StatusNotFound, response.StatusCode == http.StatusGone:
		// The browser dropped this subscription. Remove it so later reads of a
		// multi-view secret stop POSTing to an endpoint we know is dead.
		if delErr := deletePushSubscriptionFunc(id); delErr != nil {
			log.Printf("deletePushSubscription error: %v", delErr)
		}
	case response.StatusCode >= 300:
		log.Printf("push service returned %d for %s", response.StatusCode, id)
	}
}
