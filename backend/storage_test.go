package main

import (
	"crypto/sha256"
	"encoding/hex"
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

func storeTestFile(t *testing.T, client *redis.Client, id string, file StoredFile, ttl time.Duration) {
	t.Helper()

	value, err := json.Marshal(file)
	if err != nil {
		t.Fatalf("marshal StoredFile: %v", err)
	}
	if err := client.Set(getFileStoreKey(id), value, ttl).Err(); err != nil {
		t.Fatalf("store test file: %v", err)
	}
}

func TestReserveFileDownloadLegacyRecordIsSingleUse(t *testing.T) {
	client := startTestRedis(t)
	filePath := filepath.Join(t.TempDir(), "legacy.enc")
	if err := os.WriteFile(filePath, []byte("ciphertext"), 0o600); err != nil {
		t.Fatalf("write test file: %v", err)
	}
	hashedKey := strings.Repeat("e", hashedKeyHexLen)
	storeTestFile(t, client, "legacy-file", StoredFile{
		Encrypted: true,
		FileUri:   filePath,
		HashedKey: hashedKey,
	}, time.Minute)

	reservation, status, err := reserveFileDownloadWithClient(client, "legacy-file", hashedKey)
	if err != nil {
		t.Fatalf("reserveFileDownloadWithClient() error = %v", err)
	}
	if status != "ok" || reservation.File == nil || reservation.ViewsLeft != 0 {
		t.Fatalf("reservation = (%+v, %q), want final authorized download", reservation, status)
	}
	defer reservation.File.Close()
	if err := client.Get(getFileStoreKey("legacy-file")).Err(); err != redis.Nil {
		t.Fatalf("legacy record still exists: %v", err)
	}
}

func TestReserveFileDownloadWrongKeyDoesNotDecrement(t *testing.T) {
	client := startTestRedis(t)
	filePath := filepath.Join(t.TempDir(), "wrong-key.enc")
	if err := os.WriteFile(filePath, []byte("ciphertext"), 0o600); err != nil {
		t.Fatalf("write test file: %v", err)
	}
	hashedKey := strings.Repeat("a", hashedKeyHexLen)
	storeTestFile(t, client, "wrong-file-key", StoredFile{
		Encrypted: true,
		FileUri:   filePath,
		HashedKey: hashedKey,
		Views:     3,
	}, time.Minute)

	reservation, status, err := reserveFileDownloadWithClient(client, "wrong-file-key", strings.Repeat("b", hashedKeyHexLen))
	if err != nil {
		t.Fatalf("reserveFileDownloadWithClient() error = %v", err)
	}
	if status != "wrong key" || reservation.File != nil {
		t.Fatalf("reservation = (%+v, %q), want wrong key", reservation, status)
	}

	raw, err := client.Get(getFileStoreKey("wrong-file-key")).Bytes()
	if err != nil {
		t.Fatalf("get record after wrong key: %v", err)
	}
	var remaining StoredFile
	if err := json.Unmarshal(raw, &remaining); err != nil {
		t.Fatalf("unmarshal record: %v", err)
	}
	if remaining.Views != 3 {
		t.Fatalf("views after wrong key = %d, want 3", remaining.Views)
	}
}

func TestReserveFileDownloadPreservesTTL(t *testing.T) {
	client := startTestRedis(t)
	filePath := filepath.Join(t.TempDir(), "ttl.enc")
	if err := os.WriteFile(filePath, []byte("ciphertext"), 0o600); err != nil {
		t.Fatalf("write test file: %v", err)
	}
	hashedKey := strings.Repeat("c", hashedKeyHexLen)
	storeTestFile(t, client, "file-ttl", StoredFile{
		Encrypted: true,
		FileUri:   filePath,
		HashedKey: hashedKey,
		Views:     3,
	}, 2*time.Minute)
	before, err := client.PTTL(getFileStoreKey("file-ttl")).Result()
	if err != nil {
		t.Fatalf("PTTL before reserve: %v", err)
	}

	reservation, status, err := reserveFileDownloadWithClient(client, "file-ttl", hashedKey)
	if err != nil {
		t.Fatalf("reserveFileDownloadWithClient() error = %v", err)
	}
	if status != "ok" || reservation.ViewsLeft != 2 || reservation.ExpiresInSeconds <= 0 {
		t.Fatalf("reservation = (%+v, %q), want two downloads left", reservation, status)
	}
	defer reservation.File.Close()
	after, err := client.PTTL(getFileStoreKey("file-ttl")).Result()
	if err != nil {
		t.Fatalf("PTTL after reserve: %v", err)
	}
	if after <= 0 || after > before+100*time.Millisecond || after < before-time.Second {
		t.Fatalf("TTL changed unexpectedly: before=%v after=%v", before, after)
	}
}

func TestReserveFileDownloadConcurrentReadersKeepReadableDescriptors(t *testing.T) {
	client := startTestRedis(t)
	filePath := filepath.Join(t.TempDir(), "concurrent.enc")
	const ciphertext = "shared encrypted file bytes"
	if err := os.WriteFile(filePath, []byte(ciphertext), 0o600); err != nil {
		t.Fatalf("write test file: %v", err)
	}
	hashedKey := strings.Repeat("d", hashedKeyHexLen)
	const views = 5
	const readers = 12
	storeTestFile(t, client, "concurrent-file", StoredFile{
		Encrypted: true,
		FileUri:   filePath,
		HashedKey: hashedKey,
		Views:     views,
	}, time.Minute)

	type result struct {
		reservation FileDownloadReservation
		status      string
		err         error
	}
	results := make(chan result, readers)
	for i := 0; i < readers; i++ {
		go func() {
			reservation, status, err := reserveFileDownloadWithClient(client, "concurrent-file", hashedKey)
			results <- result{reservation: reservation, status: status, err: err}
		}()
	}

	var successful []FileDownloadReservation
	missing := 0
	seenViewsLeft := make(map[int]int)
	for i := 0; i < readers; i++ {
		got := <-results
		if got.err != nil {
			t.Fatalf("concurrent reservation error: %v", got.err)
		}
		switch got.status {
		case "ok":
			successful = append(successful, got.reservation)
			seenViewsLeft[got.reservation.ViewsLeft]++
		case "no message":
			missing++
		default:
			t.Fatalf("unexpected status %q", got.status)
		}
	}
	if len(successful) != views || missing != readers-views {
		t.Fatalf("successful=%d missing=%d, want %d and %d", len(successful), missing, views, readers-views)
	}
	for left := 0; left < views; left++ {
		if seenViewsLeft[left] != 1 {
			t.Fatalf("viewsLeft=%d returned %d times, want once", left, seenViewsLeft[left])
		}
	}
	if err := client.Get(getFileStoreKey("concurrent-file")).Err(); err != redis.Nil {
		t.Fatalf("record still exists after final reservation: %v", err)
	}

	// Simulate the final handler unlinking the pathname. Every successful
	// reservation must still be able to finish from its already-open descriptor.
	if err := os.Remove(filePath); err != nil {
		t.Fatalf("remove final blob: %v", err)
	}
	for _, reservation := range successful {
		data, err := io.ReadAll(reservation.File)
		_ = reservation.File.Close()
		if err != nil {
			t.Fatalf("read reserved descriptor: %v", err)
		}
		if string(data) != ciphertext {
			t.Fatalf("reserved data = %q, want %q", data, ciphertext)
		}
	}
}

func TestReserveFileDownloadMissingBlobRemovesStaleRecord(t *testing.T) {
	client := startTestRedis(t)
	hashedKey := strings.Repeat("f", hashedKeyHexLen)
	storeTestFile(t, client, "missing-blob", StoredFile{
		Encrypted: true,
		FileUri:   filepath.Join(t.TempDir(), "missing.enc"),
		HashedKey: hashedKey,
		Views:     3,
	}, time.Minute)

	reservation, status, err := reserveFileDownloadWithClient(client, "missing-blob", hashedKey)
	if err != nil {
		t.Fatalf("reserveFileDownloadWithClient() error = %v", err)
	}
	if status != "no message" || reservation.File != nil {
		t.Fatalf("reservation = (%+v, %q), want no message", reservation, status)
	}
	if err := client.Get(getFileStoreKey("missing-blob")).Err(); err != redis.Nil {
		t.Fatalf("stale record still exists: %v", err)
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

// --- v3 scheme: SHA-256(readToken) at rest -----------------------------------
//
// The migration rests on one claim: a client that knows nothing about v3 can
// still read a v3 record, because the read request is byte-identical in both
// schemes. These tests exist to keep that claim true.

func v3StoredHash(readToken string) string {
	sum := sha256.Sum256([]byte(readToken))
	return hex.EncodeToString(sum[:])
}

func TestConsumeMessageV3RecordAcceptsUnchangedReadToken(t *testing.T) {
	client := startTestRedis(t)
	const id = "v3-old-client"
	readToken := strings.Repeat("a", hashedKeyHexLen)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: v3StoredHash(readToken),
		Version:   secretSchemeV3,
	}, time.Minute)

	// Exactly what a pre-v3 client sends: the token itself, no version.
	stored, _, _, status, err := consumeMessageFromStorageWithClient(client, id, readToken)
	if err != nil {
		t.Fatalf("consumeMessageFromStorageWithClient() error = %v", err)
	}
	if status != "ok" || stored.Message != "ciphertext" {
		t.Fatalf("v3 record rejected an unmodified client: status = %q, message = %q", status, stored.Message)
	}
}

func TestConsumeMessageV3RecordRejectsTheStoredHash(t *testing.T) {
	client := startTestRedis(t)
	const id = "v3-hash-replay"
	readToken := strings.Repeat("a", hashedKeyHexLen)
	storedHash := v3StoredHash(readToken)
	storeTestMessage(t, client, id, StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: storedHash,
		Version:   secretSchemeV3,
	}, time.Minute)

	// Anyone holding the database (or an intercepted save request) has the hash
	// but not its preimage. Presenting the hash must not read the secret — this
	// is the entire point of the scheme.
	_, _, _, status, err := consumeMessageFromStorageWithClient(client, id, storedHash)
	if err != nil {
		t.Fatalf("consumeMessageFromStorageWithClient() error = %v", err)
	}
	if status != "wrong key" {
		t.Fatalf("stored hash was accepted as a read token: status = %q, want \"wrong key\"", status)
	}
	if err := client.Get(getStoreKey(id)).Err(); err == redis.Nil {
		t.Fatal("failed read consumed the record")
	}
}

func TestResolveSaveSchemeRejectsMismatchedVersionAndField(t *testing.T) {
	token := strings.Repeat("a", hashedKeyHexLen)
	hash := v3StoredHash(token)

	cases := []struct {
		name       string
		legacy     string
		hash       string
		version    int
		wantStored string
		wantScheme int
		wantOK     bool
	}{
		{"legacy client", token, "", 0, token, 0, true},
		{"v3 client", "", hash, secretSchemeV3, hash, secretSchemeV3, true},
		{"v3 claimed without hash", token, "", secretSchemeV3, "", 0, false},
		{"hash sent without version", "", hash, 0, "", 0, false},
		{"nothing at all", "", "", 0, "", 0, false},
		// Unknown schemes are refused, never reinterpreted as the newest known.
		{"future version with hash", "", hash, 4, "", 0, false},
		{"future version with token", token, "", 4, "", 0, false},
		{"unknown version between", token, hash, 2, "", 0, false},
		// A v3 upload must not carry the read token at all.
		{"v3 with the token alongside the hash", token, hash, secretSchemeV3, "", 0, false},
		// A malformed hash can never match at read time.
		{"v3 hash too short", "", "abc", secretSchemeV3, "", 0, false},
		{"v3 hash not hex", "", strings.Repeat("z", hashedKeyHexLen), secretSchemeV3, "", 0, false},
		{"v3 hash uppercase hex", "", strings.ToUpper(hash), secretSchemeV3, "", 0, false},
		{"v3 hash one char long", "", hash + "a", secretSchemeV3, "", 0, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stored, scheme, ok := resolveSaveScheme(tc.legacy, tc.hash, tc.version)
			if stored != tc.wantStored || scheme != tc.wantScheme || ok != tc.wantOK {
				t.Fatalf("resolveSaveScheme() = (%q, %d, %v), want (%q, %d, %v)",
					stored, scheme, ok, tc.wantStored, tc.wantScheme, tc.wantOK)
			}
		})
	}
}

// TestInteropVectorFromProtocolMjs pins the one thing the two languages must
// agree on: what gets hashed. The vector below was produced by
// frontend/src/lib/protocol.mjs -> encryptSecretMessage('K7bQ2mXp9vRt4nLw8zYc').
//
// Regenerate it with:
//
//	node --input-type=module -e "import {encryptSecretMessage} from
//	  './frontend/src/lib/protocol.mjs';
//	  const {hashedKey, readTokenHash} =
//	    await encryptSecretMessage('x', 'K7bQ2mXp9vRt4nLw8zYc');
//	  console.log(hashedKey, readTokenHash)"
//
// If this fails, one side changed what it digests — the hex string or the raw
// bytes it encodes — and every v3 secret would become unreadable in production
// with no error logged anywhere.
func TestInteropVectorFromProtocolMjs(t *testing.T) {
	const readToken = "5e6c13f429c1e6eb0c69bc2e67e98e7aa18db0a4bac73f943858694ac3fbe957"
	const readTokenHash = "3bfecb0a1d1bc37a3e70eb843af6578ee1fa34c19fd059a89dfbdda4523bf396"

	if !tokenMatchesStored(readTokenHash, secretSchemeV3, readToken) {
		t.Fatal("Go rejected the hash produced by protocol.mjs: client and server disagree on what is hashed")
	}
	if tokenMatchesStored(readTokenHash, 0, readToken) {
		t.Fatal("v2 comparison accepted a v3 hash")
	}
}

// The file path carries the same scheme, and its reservation logic is the most
// delicate code here, so the compatibility claim is proved for it too.

func TestReserveFileDownloadV3RecordAcceptsUnchangedReadToken(t *testing.T) {
	client := startTestRedis(t)
	filePath := filepath.Join(t.TempDir(), "v3.enc")
	if err := os.WriteFile(filePath, []byte("ciphertext"), 0o600); err != nil {
		t.Fatalf("write test file: %v", err)
	}
	readToken := strings.Repeat("e", hashedKeyHexLen)
	storeTestFile(t, client, "v3-file", StoredFile{
		Encrypted: true,
		FileUri:   filePath,
		HashedKey: v3StoredHash(readToken),
		Version:   secretSchemeV3,
	}, time.Minute)

	// A pre-v3 client downloads a v3 file link: the token, unchanged.
	reservation, status, err := reserveFileDownloadWithClient(client, "v3-file", readToken)
	if err != nil {
		t.Fatalf("reserveFileDownloadWithClient() error = %v", err)
	}
	if status != "ok" || reservation.File == nil {
		t.Fatalf("v3 file record rejected an unmodified client: (%+v, %q)", reservation, status)
	}
	reservation.File.Close()
}

func TestReserveFileDownloadV3RecordRejectsTheStoredHash(t *testing.T) {
	client := startTestRedis(t)
	filePath := filepath.Join(t.TempDir(), "v3-replay.enc")
	if err := os.WriteFile(filePath, []byte("ciphertext"), 0o600); err != nil {
		t.Fatalf("write test file: %v", err)
	}
	readToken := strings.Repeat("e", hashedKeyHexLen)
	storedHash := v3StoredHash(readToken)
	storeTestFile(t, client, "v3-replay", StoredFile{
		Encrypted: true,
		FileUri:   filePath,
		HashedKey: storedHash,
		Version:   secretSchemeV3,
	}, time.Minute)

	// Whoever holds the database holds the hash but not its preimage.
	_, status, err := reserveFileDownloadWithClient(client, "v3-replay", storedHash)
	if err != nil {
		t.Fatalf("reserveFileDownloadWithClient() error = %v", err)
	}
	if status != "wrong key" {
		t.Fatalf("stored hash was accepted for a file download: %q, want \"wrong key\"", status)
	}
	if err := client.Get(getFileStoreKey("v3-replay")).Err(); err == redis.Nil {
		t.Fatal("failed download consumed the record")
	}
}

func TestConsumeMessageV3MultiViewDecrementsWithoutRehashConfusion(t *testing.T) {
	client := startTestRedis(t)
	readToken := strings.Repeat("d", hashedKeyHexLen)
	storeTestMessage(t, client, "v3-multi", StoredMessage{
		Encrypted: true,
		Message:   "ciphertext",
		HashedKey: v3StoredHash(readToken),
		Views:     3,
		Version:   secretSchemeV3,
	}, time.Minute)

	// Each read must re-hash the presented token, not compare it to the value
	// left over from the previous pass.
	for want := 2; want >= 0; want-- {
		_, viewsLeft, _, status, err := consumeMessageFromStorageWithClient(client, "v3-multi", readToken)
		if err != nil {
			t.Fatalf("read error: %v", err)
		}
		if status != "ok" || viewsLeft != want {
			t.Fatalf("read: status = %q, viewsLeft = %d, want ok/%d", status, viewsLeft, want)
		}
	}
	if err := client.Get(getStoreKey("v3-multi")).Err(); err != redis.Nil {
		t.Fatal("record survived its last view")
	}
}

func TestTokenMatchesStoredRefusesUnknownScheme(t *testing.T) {
	token := strings.Repeat("a", hashedKeyHexLen)

	if !tokenMatchesStored(token, 0, token) {
		t.Fatal("v2 record rejected its own token")
	}
	if !tokenMatchesStored(v3StoredHash(token), secretSchemeV3, token) {
		t.Fatal("v3 record rejected its own token")
	}
	// A record written by a newer binary. Neither comparison is known to apply,
	// so both must fail closed rather than guess.
	if tokenMatchesStored(token, 4, token) {
		t.Fatal("unknown scheme fell through to the v2 comparison")
	}
	if tokenMatchesStored(v3StoredHash(token), 4, token) {
		t.Fatal("unknown scheme fell through to the v3 comparison")
	}
}
