package main

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"
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
