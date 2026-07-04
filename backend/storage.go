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

var errStorageIDCollision = errors.New("failed to generate unique storage id")

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
func saveToStorage(value interface{}, duration time.Duration) (newKey string, err error) {
	client := getRedisClient()
	if err = incrementStoredSecretCounters(time.Now().UTC()); err != nil {
		log.Println(err)
		return "", err
	}

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

func consumeFileMessageFromStorage(key string, hashedKey string) (storedFile StoredFile, status string, err error) {
	client := getRedisClient()
	storeKey := getFileStoreKey(key)
	status = "no message"

	err = client.Watch(func(tx *redis.Tx) error {
		value, err := tx.Get(storeKey).Result()
		if err == redis.Nil {
			status = "no message"
			return nil
		}
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(value), &storedFile); err != nil {
			return err
		}

		if subtle.ConstantTimeCompare([]byte(storedFile.HashedKey), []byte(hashedKey)) != 1 {
			storedFile = StoredFile{}
			status = "wrong key"
			return nil
		}

		_, err = tx.TxPipelined(func(pipe redis.Pipeliner) error {
			pipe.Del(storeKey)
			return nil
		})
		if err == redis.TxFailedErr {
			storedFile = StoredFile{}
			status = "no message"
			return nil
		}
		if err != nil {
			return err
		}

		status = "ok"
		return nil
	}, storeKey)

	return
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

func consumeMessageFromStorage(key string, hashedKey string) (storedMessage StoredMessage, status string, err error) {
	client := getRedisClient()
	storeKey := getStoreKey(key)
	status = "no message"

	err = client.Watch(func(tx *redis.Tx) error {
		value, err := tx.Get(storeKey).Result()
		if err == redis.Nil {
			status = "no message"
			return nil
		}
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(value), &storedMessage); err != nil {
			return err
		}

		if subtle.ConstantTimeCompare([]byte(storedMessage.HashedKey), []byte(hashedKey)) != 1 {
			storedMessage = StoredMessage{}
			status = "wrong key"
			return nil
		}

		_, err = tx.TxPipelined(func(pipe redis.Pipeliner) error {
			pipe.Del(storeKey)
			return nil
		})
		if err == redis.TxFailedErr {
			storedMessage = StoredMessage{}
			status = "no message"
			return nil
		}
		if err != nil {
			return err
		}

		status = "ok"
		return nil
	}, storeKey)

	return
}
