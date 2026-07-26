package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
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
const consumeMessageRetryWindow = 500 * time.Millisecond
const consumeMessageRetryBaseDelay = 5 * time.Millisecond
const consumeMessageRetryMaxDelay = 40 * time.Millisecond

var errStorageIDCollision = errors.New("failed to generate unique storage id")
var errConsumeMessageContention = errors.New("message consume contention")

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

// isValidStorageID reports whether id has exactly the shape generateStorageID
// produces: base64url characters (A–Z, a–z, 0–9, '-', '_') of the fixed encoded
// length. Rejecting anything else keeps malformed or oversized keys out of Redis.
func isValidStorageID(id string) bool {
	if len(id) != storageIDLen {
		return false
	}
	for i := 0; i < len(id); i++ {
		c := id[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-', c == '_':
			continue
		default:
			return false
		}
	}
	return true
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
	deadline := time.Now().Add(consumeMessageRetryWindow)
	retryDelay := consumeMessageRetryBaseDelay

	for {
		reservation = FileDownloadReservation{}
		status = "error"
		var openedFile *os.File

		err = client.Watch(func(tx *redis.Tx) error {
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
			if subtle.ConstantTimeCompare([]byte(current.HashedKey), []byte(hashedKey)) != 1 {
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
		}, storeKey)

		if err == nil {
			if status != "ok" && openedFile != nil {
				_ = openedFile.Close()
			}
			return reservation, status, nil
		}
		if openedFile != nil {
			_ = openedFile.Close()
		}
		if err != redis.TxFailedErr {
			return FileDownloadReservation{}, "error", err
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return FileDownloadReservation{}, "retry", errConsumeMessageContention
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
	deadline := time.Now().Add(consumeMessageRetryWindow)
	retryDelay := consumeMessageRetryBaseDelay

	for {
		storedMessage = StoredMessage{}
		viewsLeft = 0
		expiresInSeconds = 0
		status = "error"

		err = client.Watch(func(tx *redis.Tx) error {
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

			if subtle.ConstantTimeCompare([]byte(current.HashedKey), []byte(hashedKey)) != 1 {
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
		}, storeKey)

		if err == nil {
			return
		}
		if err != redis.TxFailedErr {
			return StoredMessage{}, 0, 0, "error", err
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return StoredMessage{}, 0, 0, "retry", errConsumeMessageContention
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
