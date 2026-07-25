package main

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/go-redis/redis"
)

func TestGenerateStorageIDFormat(t *testing.T) {
	id, err := generateStorageID()
	if err != nil {
		t.Fatalf("generateStorageID returned error: %v", err)
	}

	const expectedLen = 22
	if len(id) != expectedLen {
		t.Fatalf("generateStorageID length = %d, want %d", len(id), expectedLen)
	}

	if matched := regexp.MustCompile(`^[A-Za-z0-9_-]+$`).MatchString(id); !matched {
		t.Fatalf("generateStorageID produced non-url-safe id %q", id)
	}
}

func TestGenerateStorageIDUniqueness(t *testing.T) {
	seen := make(map[string]struct{}, 128)

	for i := 0; i < 128; i++ {
		id, err := generateStorageID()
		if err != nil {
			t.Fatalf("generateStorageID returned error: %v", err)
		}
		if _, ok := seen[id]; ok {
			t.Fatalf("generateStorageID returned duplicate id %q", id)
		}
		seen[id] = struct{}{}
	}
}

func TestStorageKeyHelpers(t *testing.T) {
	if got := getStoreKey("abc123"); got != "messageKeyabc123" {
		t.Fatalf("getStoreKey() = %q, want messageKeyabc123", got)
	}
	if got := getFileStoreKey("abc123"); got != "fileKeyabc123" {
		t.Fatalf("getFileStoreKey() = %q, want fileKeyabc123", got)
	}
}

func TestCleanupExpiredFilesMissingDirectoryIsNoop(t *testing.T) {
	originalDir := fileStorageDir
	fileStorageDir = filepath.Join(t.TempDir(), "missing")
	defer func() {
		fileStorageDir = originalDir
	}()

	if err := cleanupExpiredFiles(time.Now().UTC()); err != nil {
		t.Fatalf("cleanupExpiredFiles() error = %v, want nil for missing directory", err)
	}
}

func TestCleanupExpiredFilesRemovesOnlyExpiredEncFiles(t *testing.T) {
	tempDir := t.TempDir()
	originalDir := fileStorageDir
	fileStorageDir = tempDir
	defer func() {
		fileStorageDir = originalDir
	}()

	expiredPath := filepath.Join(tempDir, "expired.enc")
	futurePath := filepath.Join(tempDir, "future.enc")
	otherPath := filepath.Join(tempDir, "note.txt")

	for _, path := range []string{expiredPath, futurePath, otherPath} {
		if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
			t.Fatalf("WriteFile(%s) error: %v", path, err)
		}
	}

	now := time.Now().UTC()
	if err := os.Chtimes(expiredPath, now, now.Add(-time.Minute)); err != nil {
		t.Fatalf("Chtimes expiredPath error: %v", err)
	}
	if err := os.Chtimes(futurePath, now, now.Add(time.Minute)); err != nil {
		t.Fatalf("Chtimes futurePath error: %v", err)
	}
	if err := os.Chtimes(otherPath, now, now.Add(-time.Minute)); err != nil {
		t.Fatalf("Chtimes otherPath error: %v", err)
	}

	if err := cleanupExpiredFiles(now); err != nil {
		t.Fatalf("cleanupExpiredFiles() error: %v", err)
	}

	if _, err := os.Stat(expiredPath); !os.IsNotExist(err) {
		t.Fatalf("expired .enc file should be removed, got err=%v", err)
	}
	if _, err := os.Stat(futurePath); err != nil {
		t.Fatalf("future .enc file should remain, got err=%v", err)
	}
	if _, err := os.Stat(otherPath); err != nil {
		t.Fatalf("non-.enc file should remain, got err=%v", err)
	}
}

func startTestRedis(t *testing.T) *redis.Client {
	t.Helper()

	redisServer, err := exec.LookPath("redis-server")
	if err != nil {
		t.Skip("redis-server is required for atomic consume-message integration tests")
	}

	tempDir, err := os.MkdirTemp("/tmp", "1time-redis-")
	if err != nil {
		t.Fatalf("create redis temp directory: %v", err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(tempDir)
	})
	socketPath := filepath.Join(tempDir, "redis.sock")
	cmd := exec.Command(
		redisServer,
		"--port", "0",
		"--unixsocket", socketPath,
		"--unixsocketperm", "700",
		"--save", "",
		"--appendonly", "no",
		"--loglevel", "warning",
	)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		t.Fatalf("start redis-server: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Network: "unix",
		Addr:    socketPath,
	})
	t.Cleanup(func() {
		_ = client.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	})

	deadline := time.Now().Add(5 * time.Second)
	for {
		if err := client.Ping().Err(); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("redis-server did not become ready")
		}
		time.Sleep(10 * time.Millisecond)
	}

	return client
}

func storeTestMessage(t *testing.T, client *redis.Client, id string, message StoredMessage, ttl time.Duration) {
	t.Helper()

	value, err := json.Marshal(message)
	if err != nil {
		t.Fatalf("marshal StoredMessage: %v", err)
	}
	if err := client.Set(getStoreKey(id), value, ttl).Err(); err != nil {
		t.Fatalf("store test message: %v", err)
	}
}

func TestIsValidHashedKey(t *testing.T) {
	valid := strings.Repeat("a1", hashedKeyHexLen/2)
	if !isValidHashedKey(valid) {
		t.Fatalf("isValidHashedKey rejected a valid token")
	}

	for _, invalid := range []string{
		"",
		valid[:len(valid)-1],
		valid + "0",
		strings.Repeat("g", hashedKeyHexLen),
		strings.ToUpper(valid),
	} {
		if isValidHashedKey(invalid) {
			t.Fatalf("isValidHashedKey accepted %q", invalid)
		}
	}
}

func TestConsumeMessageWatchLegacyRecordIsSingleView(t *testing.T) {
	client := startTestRedis(t)
	const id = "legacy"
	hashedKey := strings.Repeat("a", hashedKeyHexLen)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: hashedKey,
	}, time.Minute)

	stored, viewsLeft, expiresIn, status, err := consumeMessageFromStorageWithClient(client, id, hashedKey)
	if err != nil {
		t.Fatalf("consumeMessageFromStorageWithClient() error = %v", err)
	}
	if status != "ok" || stored.Message != "ciphertext" || viewsLeft != 0 || expiresIn != 0 {
		t.Fatalf("consume result = (%+v, %d, %d, %q), want ciphertext consumed", stored, viewsLeft, expiresIn, status)
	}
	if err := client.Get(getStoreKey(id)).Err(); err != redis.Nil {
		t.Fatalf("legacy record still exists after its only view: %v", err)
	}
}

func TestConsumeMessageWatchWrongKeyDoesNotDecrement(t *testing.T) {
	client := startTestRedis(t)
	const id = "wrong-key"
	hashedKey := strings.Repeat("a", hashedKeyHexLen)
	wrongKey := strings.Repeat("b", hashedKeyHexLen)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: hashedKey,
		Views:     3,
	}, time.Minute)

	stored, viewsLeft, expiresIn, status, err := consumeMessageFromStorageWithClient(client, id, wrongKey)
	if err != nil {
		t.Fatalf("consumeMessageFromStorageWithClient() error = %v", err)
	}
	if status != "wrong key" || stored != (StoredMessage{}) || viewsLeft != 0 || expiresIn != 0 {
		t.Fatalf("wrong-key result = (%+v, %d, %d, %q)", stored, viewsLeft, expiresIn, status)
	}

	raw, err := client.Get(getStoreKey(id)).Bytes()
	if err != nil {
		t.Fatalf("get record after wrong key: %v", err)
	}
	var remaining StoredMessage
	if err := json.Unmarshal(raw, &remaining); err != nil {
		t.Fatalf("unmarshal record after wrong key: %v", err)
	}
	if remaining.Views != 3 {
		t.Fatalf("views after wrong key = %d, want 3", remaining.Views)
	}
}

func TestConsumeMessageWatchPreservesTTLWhileDecrementing(t *testing.T) {
	client := startTestRedis(t)
	const id = "ttl"
	hashedKey := strings.Repeat("c", hashedKeyHexLen)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: hashedKey,
		Views:     3,
	}, 2*time.Minute)

	before, err := client.PTTL(getStoreKey(id)).Result()
	if err != nil {
		t.Fatalf("PTTL before consume: %v", err)
	}
	stored, viewsLeft, expiresIn, status, err := consumeMessageFromStorageWithClient(client, id, hashedKey)
	if err != nil {
		t.Fatalf("consumeMessageFromStorageWithClient() error = %v", err)
	}
	after, err := client.PTTL(getStoreKey(id)).Result()
	if err != nil {
		t.Fatalf("PTTL after consume: %v", err)
	}

	if status != "ok" || stored.Message != "ciphertext" || viewsLeft != 2 {
		t.Fatalf("consume result = (%+v, %d, %d, %q), want two views left", stored, viewsLeft, expiresIn, status)
	}
	if expiresIn <= 0 {
		t.Fatalf("expiresIn = %d, want positive remaining TTL", expiresIn)
	}
	if after <= 0 || after > before+100*time.Millisecond || after < before-time.Second {
		t.Fatalf("TTL changed unexpectedly: before=%v after=%v", before, after)
	}

	raw, err := client.Get(getStoreKey(id)).Bytes()
	if err != nil {
		t.Fatalf("get decremented record: %v", err)
	}
	var remaining StoredMessage
	if err := json.Unmarshal(raw, &remaining); err != nil {
		t.Fatalf("unmarshal decremented record: %v", err)
	}
	if remaining.Views != 2 {
		t.Fatalf("stored views after consume = %d, want 2", remaining.Views)
	}
}

func TestConsumeMessageWatchConcurrentReaders(t *testing.T) {
	tests := []struct {
		name    string
		views   int
		readers int
	}{
		{name: "three views", views: 3, readers: 10},
		{name: "ten views", views: 10, readers: 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := startTestRedis(t)
			hashedKey := strings.Repeat("d", hashedKeyHexLen)
			storeTestMessage(t, client, tt.name, StoredMessage{
				Encrypted: true,
				Message:   "ciphertext",
				HashedKey: hashedKey,
				Views:     tt.views,
			}, time.Minute)

			type consumeResult struct {
				message   StoredMessage
				viewsLeft int
				status    string
				err       error
			}
			results := make(chan consumeResult, tt.readers)
			for i := 0; i < tt.readers; i++ {
				go func() {
					message, viewsLeft, _, status, err := consumeMessageFromStorageWithClient(client, tt.name, hashedKey)
					results <- consumeResult{message: message, viewsLeft: viewsLeft, status: status, err: err}
				}()
			}

			okCount := 0
			missingCount := 0
			seenViewsLeft := make(map[int]int, tt.views)
			for i := 0; i < tt.readers; i++ {
				result := <-results
				if result.err != nil {
					t.Fatalf("concurrent consume error: %v", result.err)
				}
				switch result.status {
				case "ok":
					okCount++
					if result.message.Message != "ciphertext" {
						t.Fatalf("successful consume returned message %q", result.message.Message)
					}
					seenViewsLeft[result.viewsLeft]++
				case "no message":
					missingCount++
				default:
					t.Fatalf("unexpected concurrent consume status %q", result.status)
				}
			}

			if okCount != tt.views || missingCount != tt.readers-tt.views {
				t.Fatalf("successes=%d missing=%d, want successes=%d missing=%d", okCount, missingCount, tt.views, tt.readers-tt.views)
			}
			for viewsLeft := 0; viewsLeft < tt.views; viewsLeft++ {
				if seenViewsLeft[viewsLeft] != 1 {
					t.Fatalf("viewsLeft=%d returned %d times, want once", viewsLeft, seenViewsLeft[viewsLeft])
				}
			}
			if err := client.Get(getStoreKey(tt.name)).Err(); err != redis.Nil {
				t.Fatalf("record still exists after all views were consumed: %v", err)
			}
		})
	}
}

// A stats failure must never discard a secret we already wrote: counting is a
// side effect, not part of the save contract.
func TestSaveToStorageSucceedsWhenStatsFail(t *testing.T) {
	original := incrementStoredSecretCountersFunc
	t.Cleanup(func() { incrementStoredSecretCountersFunc = original })
	incrementStoredSecretCountersFunc = func(views int, now time.Time) error {
		return errors.New("redis is down")
	}

	key, err := saveToStorage([]byte(`{"message":"c"}`), time.Minute, 3)
	if err != nil {
		t.Fatalf("saveToStorage() error = %v, want nil despite failing stats", err)
	}
	if !isValidStorageID(key) {
		t.Fatalf("saveToStorage() key = %q, want a valid storage id", key)
	}
}

// Counting happens only after the record is written, so the clamped view count
// reaches the counters exactly once per stored secret.
func TestSaveToStorageCountsStoredSecretOnce(t *testing.T) {
	original := incrementStoredSecretCountersFunc
	t.Cleanup(func() { incrementStoredSecretCountersFunc = original })

	var gotViews []int
	incrementStoredSecretCountersFunc = func(views int, now time.Time) error {
		gotViews = append(gotViews, views)
		return nil
	}

	if _, err := saveToStorage([]byte(`{"message":"c"}`), time.Minute, 5); err != nil {
		t.Fatalf("saveToStorage() error = %v", err)
	}
	if len(gotViews) != 1 || gotViews[0] != 5 {
		t.Fatalf("recorded views = %#v, want [5]", gotViews)
	}
}
