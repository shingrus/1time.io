package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"os"
	"sync"
	"time"

	"github.com/go-redis/redis"
)

var redisPassword = os.Getenv("REDISPASS")
var redisHost = os.Getenv("REDISHOST")

const storageIDByteLen = 16
const maxStorageIDAttempts = 5
const redisTimeout = time.Second * 10
const fileJanitorInterval = 2 * time.Hour

const hashedKeyHexLen = 64

// secretSchemeV3 records store SHA-256(readToken) rather than the token, so the
// server holds nothing that can read a secret. Version 0 means v2 (the token
// itself), which is what pre-existing records unmarshal to.
const secretSchemeV3 = 3

// tokenMatchesStored reports whether the token a reader presented matches what
// the record holds. v2 records store the token itself; v3 records store its
// SHA-256.
//
// The hash is taken over the token's HEX STRING as transmitted, not the 32 raw
// bytes it encodes. protocol.mjs must hash the same representation: this is the
// one place client and server can disagree silently, and every v3 secret would
// become unreadable. Both stored forms are 64 hex characters, so
// isValidHashedKey validates either.
func tokenMatchesStored(stored string, version int, presented string) bool {
	var candidate string
	switch version {
	case 0:
		candidate = presented
	case secretSchemeV3:
		sum := sha256.Sum256([]byte(presented))
		candidate = hex.EncodeToString(sum[:])
	default:
		// Written by a newer binary — a rolling deploy, or a rollback. No safe
		// guess exists, so refuse.
		return false
	}

	return subtle.ConstantTimeCompare([]byte(stored), []byte(candidate)) == 1
}

const consumeMessageRetryWindow = 500 * time.Millisecond
const consumeMessageRetryBaseDelay = 5 * time.Millisecond
const consumeMessageRetryMaxDelay = 40 * time.Millisecond

var errStorageIDCollision = errors.New("failed to generate unique storage id")

// errConsumeMessageContention is what watchWithRetry returns when its retry
// window runs out. One sentinel for every caller: the read paths turn it into
// the "retry" status that tells a client no view was consumed, and the push
// attach path treats it like any other failure.
var errConsumeMessageContention = errors.New("message consume contention")

// watchWithRetry runs fn inside a WATCH on key, retrying with bounded
// exponential backoff whenever the transaction loses a race.
//
// It returns nil once the transaction commits, the underlying error if fn or
// Redis failed for any other reason, and errConsumeMessageContention if the
// retry window ran out. fn may be called more than once, so anything it assigns
// must be reset at the top of each attempt rather than accumulated.
func watchWithRetry(client *redis.Client, key string, fn func(tx *redis.Tx) error) error {
	deadline := time.Now().Add(consumeMessageRetryWindow)
	retryDelay := consumeMessageRetryBaseDelay

	for {
		err := client.Watch(fn, key)
		if err == nil {
			return nil
		}
		if err != redis.TxFailedErr {
			return err
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return errConsumeMessageContention
		}
		if retryDelay > remaining {
			retryDelay = remaining
		}
		time.Sleep(retryDelay)
		if retryDelay < consumeMessageRetryMaxDelay {
			retryDelay *= 2
			if retryDelay > consumeMessageRetryMaxDelay {
				retryDelay = consumeMessageRetryMaxDelay
			}
		}
	}
}

var redisClient *redis.Client
var redisOnce sync.Once

func getRedisClient() *redis.Client {
	redisOnce.Do(func() {
		redisClient = redis.NewClient(&redis.Options{
			Addr:         redisHost,
			Password:     redisPassword,
			DB:           0,
			ReadTimeout:  redisTimeout,
			WriteTimeout: redisTimeout,
		})
	})

	return redisClient
}

/*
store value with uniq key
return key string(hexademical number)
error in case of failure
*/
// saveToStorage stores a text secret and records its counters. views is the
// already-clamped view count, recorded alongside the stored-secret totals in one
// round-trip. Counting happens only after the record is safely written, so a
// stats failure can neither discard the secret nor inflate the totals with saves
// that never landed.
func saveToStorage(value interface{}, duration time.Duration, views int) (newKey string, err error) {
	client := getRedisClient()

	for attempt := 0; attempt < maxStorageIDAttempts; attempt++ {
		newKey, err = generateStorageID()
		if err != nil {
			return "", err
		}

		ok, setErr := client.SetNX(getStoreKey(newKey), value, duration).Result()
		if setErr != nil {
			return "", setErr
		}
		if ok {
			if DEBUG {
				log.Printf("Got new key storage: %v", newKey)
			}
			// Stats are best-effort: never fail a secret we already stored.
			if statsErr := incrementStoredSecretCountersFunc(views, time.Now().UTC()); statsErr != nil {
				log.Printf("incrementStoredSecretCounters error: %v", statsErr)
			}
			return newKey, nil
		}
	}

	return "", errStorageIDCollision
}

// Generates uniq id storageIDByteLen length
func generateStorageID() (string, error) {
	randomBytes := make([]byte, storageIDByteLen)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

// storageIDLen is the encoded length of an id produced by generateStorageID.
var storageIDLen = base64.RawURLEncoding.EncodedLen(storageIDByteLen)

// isBase64URLOfLen reports whether value is exactly length base64url characters
// (A–Z, a–z, 0–9, '-', '_'). Both the storage id and the manage token are raw
// base64url of a fixed byte count, so one check serves both and keeps malformed
// or oversized values out of Redis.
func isBase64URLOfLen(value string, length int) bool {
	if len(value) != length {
		return false
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-', c == '_':
			continue
		default:
			return false
		}
	}
	return true
}

// isValidStorageID reports whether id has exactly the shape generateStorageID
// produces.
func isValidStorageID(id string) bool {
	return isBase64URLOfLen(id, storageIDLen)
}

/*
This function constructs key for messages using format like 'messageKey<id>'
*/
func getStoreKey(key string) string {
	return "messageKey" + key
}

func getFileStoreKey(key string) string {
	return "fileKey" + key
}

// secretsExist reports which of the given ids still have a stored secret, in a
// single pipelined round-trip. A secret may live in either the message store or
// the file store, so each id is checked against both keys with one EXISTS; the
// id is present if either key exists. Duplicate and empty ids are ignored. This
// is read-only — it never mutates or consumes a secret.
//
// EXISTS rather than GET on purpose. Verifying a manage token would mean
// fetching each record, which drags the whole ciphertext out of Redis to read a
// 64-character hash — and this runs on a timer for up to maxStatusIDs secrets at
// once. The only thing gating would buy is hiding read timing from someone who
// has an id but not the fragment key; anyone holding the actual link can simply
// read the secret, which tells them strictly more.
func secretsExist(ids []string) (map[string]bool, error) {
	result := make(map[string]bool, len(ids))
	if len(ids) == 0 {
		return result, nil
	}

	client := getRedisClient()
	pipe := client.Pipeline()
	cmds := make(map[string]*redis.IntCmd, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, seen := cmds[id]; seen {
			continue
		}
		// EXISTS returns the count of the listed keys that exist (0, 1, or 2).
		cmds[id] = pipe.Exists(getStoreKey(id), getFileStoreKey(id))
	}

	if len(cmds) == 0 {
		return result, nil
	}

	if _, err := pipe.Exec(); err != nil {
		return nil, err
	}

	for id, cmd := range cmds {
		result[id] = cmd.Val() > 0
	}
	return result, nil
}

type FileDownloadReservation struct {
	StoredFile       StoredFile
	File             *os.File
	ViewsLeft        int
	ExpiresInSeconds int
}

// reserveFileDownload atomically reserves one authorized download and opens
// the encrypted blob before committing the Redis mutation. Opening first is
// essential for concurrent final downloads: once every successful reservation
// holds a descriptor, the final request can safely unlink the pathname without
// preventing earlier requests from completing on POSIX hosts.
func reserveFileDownload(key string, hashedKey string) (FileDownloadReservation, string, error) {
	if !isValidHashedKey(hashedKey) {
		return FileDownloadReservation{}, "wrong key", nil
	}
	return reserveFileDownloadWithClient(getRedisClient(), key, hashedKey)
}

func reserveFileDownloadWithClient(client *redis.Client, key string, hashedKey string) (reservation FileDownloadReservation, status string, err error) {
	storeKey := getFileStoreKey(key)
	var openedFile *os.File

	err = watchWithRetry(client, storeKey, func(tx *redis.Tx) error {
		// A previous attempt may have opened the blob before losing the race.
		// Closing it here rather than after the Watch keeps the descriptor
		// bounded to one per attempt however many times fn runs.
		if openedFile != nil {
			_ = openedFile.Close()
			openedFile = nil
		}
		reservation = FileDownloadReservation{}
		status = "error"

		value, getErr := tx.Get(storeKey).Result()
		if getErr == redis.Nil {
			status = "no message"
			return nil
		}
		if getErr != nil {
			return getErr
		}

		var current StoredFile
		if unmarshalErr := json.Unmarshal([]byte(value), &current); unmarshalErr != nil {
			return unmarshalErr
		}
		if !tokenMatchesStored(current.HashedKey, current.Version, hashedKey) {
			status = "wrong key"
			return nil
		}

		var openErr error
		openedFile, openErr = os.Open(current.FileUri)
		if openErr != nil {
			if os.IsNotExist(openErr) {
				// Do not leave stale metadata reporting a missing blob as live.
				if _, txErr := tx.TxPipelined(func(pipe redis.Pipeliner) error {
					pipe.Del(storeKey)
					return nil
				}); txErr != nil {
					return txErr
				}
				status = "no message"
				return nil
			}
			return openErr
		}

		viewsLeft := 0
		expiresInSeconds := 0
		if current.Views > 1 {
			ttl, ttlErr := tx.PTTL(storeKey).Result()
			if ttlErr != nil {
				return ttlErr
			}
			if ttl > 0 {
				updated := current
				updated.Views--
				updatedValue, marshalErr := json.Marshal(updated)
				if marshalErr != nil {
					return marshalErr
				}
				if _, txErr := tx.TxPipelined(func(pipe redis.Pipeliner) error {
					pipe.Set(storeKey, updatedValue, ttl)
					return nil
				}); txErr != nil {
					return txErr
				}
				viewsLeft = updated.Views
				expiresInSeconds = int(ttl / time.Second)
				reservation = FileDownloadReservation{
					StoredFile:       current,
					File:             openedFile,
					ViewsLeft:        viewsLeft,
					ExpiresInSeconds: expiresInSeconds,
				}
				status = "ok"
				return nil
			}
		}

		if _, txErr := tx.TxPipelined(func(pipe redis.Pipeliner) error {
			pipe.Del(storeKey)
			return nil
		}); txErr != nil {
			return txErr
		}
		reservation = FileDownloadReservation{
			StoredFile: current,
			File:       openedFile,
		}
		status = "ok"
		return nil
	})

	if err != nil {
		// Nothing was reserved, so the handle from the final attempt is ours to
		// close.
		if openedFile != nil {
			_ = openedFile.Close()
		}
		if errors.Is(err, errConsumeMessageContention) {
			return FileDownloadReservation{}, "retry", err
		}
		return FileDownloadReservation{}, "error", err
	}

	// Committed, but "wrong key" and "no message" hand back no reservation, so
	// the caller will never close the descriptor.
	if status != "ok" && openedFile != nil {
		_ = openedFile.Close()
	}
	return reservation, status, nil
}

func startFileJanitor() {
	go runFileJanitorLoop()
}

func runFileJanitorLoop() {
	if err := cleanupExpiredFiles(time.Now().UTC()); err != nil {
		log.Printf("cleanupExpiredFiles error: %v", err)
	}

	ticker := time.NewTicker(fileJanitorInterval)
	defer ticker.Stop()

	for now := range ticker.C {
		if err := cleanupExpiredFiles(now.UTC()); err != nil {
			log.Printf("cleanupExpiredFiles error: %v", err)
		}
	}
}

func cleanupExpiredFiles(now time.Time) error {
	entries, err := os.ReadDir(fileStorageDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || len(entry.Name()) < 4 || entry.Name()[len(entry.Name())-4:] != ".enc" {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.ModTime().After(now) {
			continue
		}

		filePath := fileStorageDir + string(os.PathSeparator) + entry.Name()
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			return err
		}
	}

	return nil
}

func isValidHashedKey(hashedKey string) bool {
	if len(hashedKey) != hashedKeyHexLen {
		return false
	}
	for i := 0; i < len(hashedKey); i++ {
		c := hashedKey[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

// consumeMessageFromStorage reads a secret and applies its view accounting
// atomically in Redis. Views <= 1 (including legacy records without the field)
// deletes the record, and Views > 1 decrements it while preserving the TTL.
// viewsLeft reports the views remaining after this read (0 = consumed).
// expiresInSeconds reports the remaining TTL when the record stays alive.
func consumeMessageFromStorage(key string, hashedKey string) (storedMessage StoredMessage, viewsLeft int, expiresInSeconds int, status string, err error) {
	if !isValidHashedKey(hashedKey) {
		status = "wrong key"
		return
	}
	return consumeMessageFromStorageWithClient(getRedisClient(), key, hashedKey)
}

func consumeMessageFromStorageWithClient(client *redis.Client, key string, hashedKey string) (storedMessage StoredMessage, viewsLeft int, expiresInSeconds int, status string, err error) {
	storeKey := getStoreKey(key)

	err = watchWithRetry(client, storeKey, func(tx *redis.Tx) error {
		storedMessage = StoredMessage{}
		viewsLeft = 0
		expiresInSeconds = 0
		status = "error"

		value, getErr := tx.Get(storeKey).Result()
		if getErr == redis.Nil {
			status = "no message"
			return nil
		}
		if getErr != nil {
			return getErr
		}

		var current StoredMessage
		if unmarshalErr := json.Unmarshal([]byte(value), &current); unmarshalErr != nil {
			return unmarshalErr
		}

		if !tokenMatchesStored(current.HashedKey, current.Version, hashedKey) {
			status = "wrong key"
			return nil
		}

		if current.Views > 1 {
			// go-redis v6 has no KEEPTTL, so preserve the remaining TTL
			// explicitly as part of the watched transaction.
			ttl, ttlErr := tx.PTTL(storeKey).Result()
			if ttlErr != nil {
				return ttlErr
			}
			if ttl > 0 {
				updated := current
				updated.Views--
				updatedValue, marshalErr := json.Marshal(updated)
				if marshalErr != nil {
					return marshalErr
				}

				if _, txErr := tx.TxPipelined(func(pipe redis.Pipeliner) error {
					pipe.Set(storeKey, updatedValue, ttl)
					return nil
				}); txErr != nil {
					return txErr
				}

				storedMessage = current
				viewsLeft = updated.Views
				expiresInSeconds = int(ttl / time.Second)
				status = "ok"
				return nil
			}
			// If the TTL disappeared or expired, consume the record rather
			// than accidentally making a time-limited secret persistent.
		}

		if _, txErr := tx.TxPipelined(func(pipe redis.Pipeliner) error {
			pipe.Del(storeKey)
			return nil
		}); txErr != nil {
			return txErr
		}

		storedMessage = current
		status = "ok"
		return nil
	})

	if err != nil {
		if errors.Is(err, errConsumeMessageContention) {
			return StoredMessage{}, 0, 0, "retry", err
		}
		return StoredMessage{}, 0, 0, "error", err
	}
	return
}

/*
This function constructs the key holding a secret's push subscription, using
format like 'pushKey<id>'

One prefix covers both stores. A storage id is 16 random bytes and names at most
one secret, so there is nothing for a second prefix to disambiguate — and the
callers that read or delete a subscription then need no idea which store the
secret lives in.
*/
func getPushStoreKey(key string) string {
	return "pushKey" + key
}

// manageTokenByteLen is the entropy behind a manage token. The token is never
// part of a share link — only the creating browser ever holds it — so it is the
// one thing that distinguishes the sender from any reader who has the id.
const manageTokenByteLen = 32

// manageTokenLen is the encoded length of a token produced by generateManageToken.
var manageTokenLen = base64.RawURLEncoding.EncodedLen(manageTokenByteLen)

// generateManageToken mints the capability that authorises attaching a push
// subscription to a secret. It authorises nothing else: it can neither read nor
// delete the secret it belongs to.
func generateManageToken() (string, error) {
	randomBytes := make([]byte, manageTokenByteLen)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

// hashManageToken hashes a manage token for storage. Like tokenMatchesStored,
// the hash is taken over the token's TRANSMITTED STRING rather than the bytes it
// encodes, so client and server cannot silently disagree on the representation.
func hashManageToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// isValidManageToken reports whether a token has the shape generateManageToken
// produces, before it is used to touch Redis at all.
func isValidManageToken(token string) bool {
	return isBase64URLOfLen(token, manageTokenLen)
}

// manageTokenMatches compares a presented token against the stored hash in
// constant time. An empty stored hash — every record written before this
// feature — never matches, so legacy secrets simply cannot be subscribed.
func manageTokenMatches(storedHash string, presented string) bool {
	if storedHash == "" {
		return false
	}

	candidate := hashManageToken(presented)
	return subtle.ConstantTimeCompare([]byte(storedHash), []byte(candidate)) == 1
}

// PushSubscription is what a browser's PushManager hands back, stored verbatim
// so the sender can be notified when their secret is read. Endpoint is a
// capability URL: anything able to POST to it can push to that browser, which is
// why validatePushEndpoint gates what may ever be written here.
type PushSubscription struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

// manageHashOnly pulls just the manage hash out of a stored record. Both
// StoredMessage and StoredFile carry the field under the same name, so one
// unmarshal target serves the text store and the file store alike.
type manageHashOnly struct {
	ManageHash string `json:"manageHash"`
}

// Outcomes of attachPushSubscription, mapped to the API's ok/gone split by the
// handler. attachForbidden is deliberately NOT distinguishable from an error in
// the response body — it rides the HTTP status instead.
const (
	attachOK        = "ok"
	attachGone      = "gone"
	attachForbidden = "forbidden"
)

// attachPushSubscription stores sub against the secret id, if that secret still
// exists and the caller proves they created it.
//
// A secret lives in either the message store or the file store, so both are
// tried. Which one matched is not reported: the subscription goes under a single
// pushKey<id> either way, and the read handler that eventually fires the
// notification already knows the kind from its own endpoint.
//
// The secret is deliberately NOT locked while this runs. A reader arriving
// mid-flight must win: failing their read to protect a notification would trade
// the product for its telemetry. The watched transaction only guarantees we
// never attach a subscription to a secret that was consumed underneath us — in
// which case the caller is told "gone" rather than being left believing a
// notification is coming.
func attachPushSubscription(id string, manageToken string, sub PushSubscription) (status string, err error) {
	return attachPushSubscriptionWithClient(getRedisClient(), id, manageToken, sub)
}

func attachPushSubscriptionWithClient(client *redis.Client, id string, manageToken string, sub PushSubscription) (status string, err error) {
	pushKey := getPushStoreKey(id)

	// A secret lives in one store or the other, and only the record itself holds
	// the manage hash and the TTL to mirror — so both are probed here. Nothing
	// downstream needs to know which one answered.
	storeKeys := []string{getStoreKey(id), getFileStoreKey(id)}

	forbidden := false
	for _, storeKey := range storeKeys {
		status, err = setPushSubscription(client, storeKey, pushKey, manageToken, sub)
		if err != nil {
			return "", err
		}
		switch status {
		case attachOK:
			return attachOK, nil
		case attachForbidden:
			// The record exists but the token is wrong; keep looking only in
			// case the id also names a record in the other store.
			forbidden = true
		}
	}

	if forbidden {
		return attachForbidden, nil
	}
	return attachGone, nil
}

// setPushSubscription attaches sub under pushKey with the secret's own remaining
// TTL, so the subscription expires exactly when the secret it describes does and
// needs no separate cleanup.
func setPushSubscription(client *redis.Client, storeKey string, pushKey string, manageToken string, sub PushSubscription) (status string, err error) {
	value, marshalErr := json.Marshal(sub)
	if marshalErr != nil {
		return "", marshalErr
	}

	err = watchWithRetry(client, storeKey, func(tx *redis.Tx) error {
		status = attachGone

		stored, getErr := tx.Get(storeKey).Result()
		if getErr == redis.Nil {
			status = attachGone
			return nil
		}
		if getErr != nil {
			return getErr
		}

		var record manageHashOnly
		if unmarshalErr := json.Unmarshal([]byte(stored), &record); unmarshalErr != nil {
			return unmarshalErr
		}

		if !manageTokenMatches(record.ManageHash, manageToken) {
			status = attachForbidden
			return nil
		}

		// go-redis v6 has no KEEPTTL, so read the secret's remaining life
		// inside the watched transaction and mirror it onto the push key.
		ttl, ttlErr := tx.PTTL(storeKey).Result()
		if ttlErr != nil {
			return ttlErr
		}
		if ttl <= 0 {
			// Expiring or unexpiring underneath us — treat as gone rather
			// than storing a subscription that outlives its secret.
			status = attachGone
			return nil
		}

		if _, txErr := tx.TxPipelined(func(pipe redis.Pipeliner) error {
			pipe.Set(pushKey, value, ttl)
			return nil
		}); txErr != nil {
			return txErr
		}

		status = attachOK
		return nil
	})

	// Retry exhaustion means the secret kept changing underneath us — almost
	// always the reader consuming it. This caller maps every failure to a 500,
	// so it needs no sentinel of its own.
	if err != nil {
		return "", err
	}
	return status, nil
}

// loadPushSubscription returns the subscription subscribed for a secret, if any.
//
// It is safe to call AFTER the secret has been consumed: the subscription lives
// under its own key with its own TTL, so a read that deletes the secret leaves it
// intact. That ordering is what closes the subscribe race — a subscribe arriving
// after the read finds the secret gone and stores nothing, while one that landed
// before it is still here to be found.
func loadPushSubscription(id string) (subscription PushSubscription, found bool, err error) {
	return loadPushSubscriptionWithClient(getRedisClient(), id)
}

func loadPushSubscriptionWithClient(client *redis.Client, id string) (subscription PushSubscription, found bool, err error) {
	value, getErr := client.Get(getPushStoreKey(id)).Result()
	if getErr == redis.Nil {
		return PushSubscription{}, false, nil
	}
	if getErr != nil {
		return PushSubscription{}, false, getErr
	}

	if unmarshalErr := json.Unmarshal([]byte(value), &subscription); unmarshalErr != nil {
		return PushSubscription{}, false, unmarshalErr
	}

	return subscription, true, nil
}

// deletePushSubscription drops a subscription the push service has told us is
// dead. Everything else is left to the TTL: a subscription is a few hundred
// bytes and expires with its secret, so explicit cleanup would buy nothing but
// an extra write on the read path.
func deletePushSubscription(id string) error {
	return getRedisClient().Del(getPushStoreKey(id)).Err()
}
