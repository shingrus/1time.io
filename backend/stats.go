package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis"
)

const (
	storedTextTotalKey      = "stats:stored:text:total"
	storedTextDayKeyPrefix  = "stats:stored:text:day:"
	storedFileTotalKey      = "stats:stored:file:total"
	storedFileDayKeyPrefix  = "stats:stored:file:day:"
	viewsTotalKeyPrefix     = "stats:views:total:"
	viewsDayKeyPrefix       = "stats:views:day:"
	fileViewsTotalKeyPrefix = "stats:views:file:total:"
	fileViewsDayKeyPrefix   = "stats:views:file:day:"
	statsHistoryTTL         = time.Hour * 24 * 60
	statsFlushInterval      = time.Second * 10
)

type storedCounterKind int

const (
	storedCounterText storedCounterKind = iota
	storedCounterFile
)

// hashCounter is one family of buffered event counts, stored in Redis as one
// hash of field -> count per UTC day under dayKeyPrefix. A new family is one
// more value below.
type hashCounter struct {
	dayKeyPrefix string
	// fields is an allowlist. Share taps arrive from an unauthenticated beacon,
	// so anything unlisted is dropped rather than growing a hash without bound.
	fields []string
}

var (
	// Presses of the share icon on the link-ready screen, which open the
	// system share sheet. Whether a link was then sent is not tracked.
	shareCounter = &hashCounter{
		dayKeyPrefix: "stats:share:day:",
		fields:       []string{"tap"},
	}
)

func (c *hashCounter) accepts(field string) bool {
	for _, known := range c.fields {
		if known == field {
			return true
		}
	}

	return false
}

func (c *hashCounter) dayKey(now time.Time) string {
	return c.dayKeyPrefix + getStatsDay(now)
}

type counterField struct {
	counter *hashCounter
	field   string
}

// Buffered in memory, written to Redis by flushLoop.
type pendingCounters map[counterField]int64

type StatsSnapshot struct {
	APIVersion           int   `json:"apiVersion"`
	SaveSchemes          []int `json:"saveSchemes"`
	OverallStoredSecrets int64 `json:"overallStoredSecrets"`
	OverallStoredFiles   int64 `json:"overallStoredFiles"`
	FlushIntervalSeconds int64 `json:"flushIntervalSeconds"`
}

type StatsManager struct {
	mu                   sync.Mutex
	pending              pendingCounters
	overallStoredSecrets atomic.Int64
	overallStoredFiles   atomic.Int64
}

var appStats = NewStatsManager()

var (
	flushCountersFunc                    = flushCounters
	getOverallStoredCounterFromRedisFunc = getOverallStoredCounterFromRedis
	incrementStoredSecretCountersFunc    = incrementStoredSecretCounters
)

func NewStatsManager() *StatsManager {
	return &StatsManager{pending: pendingCounters{}}
}

func (s *StatsManager) Start() {
	if err := s.loadOverallStoredCounters(); err != nil {
		log.Println(err)
	}

	go s.flushLoop()
}

// Record counts one event in each named field. Fields recorded in one call move
// under a single lock acquisition, so they always land in the same flush and
// therefore the same day key. Fields the counter does not list are ignored.
func (s *StatsManager) Record(counter *hashCounter, fields ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, field := range fields {
		if counter.accepts(field) {
			s.pending[counterField{counter, field}]++
		}
	}
}

func (s *StatsManager) AddStoredSecrets(delta int64) {
	s.overallStoredSecrets.Add(delta)
}

func (s *StatsManager) AddStoredFiles(delta int64) {
	s.overallStoredFiles.Add(delta)
}

func (s *StatsManager) GetOverallStoredSecrets() int64 {
	return s.overallStoredSecrets.Load()
}

func (s *StatsManager) GetOverallStoredFiles() int64 {
	return s.overallStoredFiles.Load()
}

func (s *StatsManager) GetSnapshot() StatsSnapshot {
	return StatsSnapshot{
		APIVersion:           apiVersion,
		SaveSchemes:          supportedSaveSchemes(),
		OverallStoredSecrets: s.GetOverallStoredSecrets(),
		OverallStoredFiles:   s.GetOverallStoredFiles(),
		FlushIntervalSeconds: int64(statsFlushInterval / time.Second),
	}
}

func (s *StatsManager) loadOverallStoredCounters() error {
	textTotal, err := getOverallStoredCounterFromRedisFunc(storedCounterText)
	if err != nil {
		return err
	}

	fileTotal, err := getOverallStoredCounterFromRedisFunc(storedCounterFile)
	if err != nil {
		return err
	}

	s.overallStoredSecrets.Store(textTotal)
	s.overallStoredFiles.Store(fileTotal)

	return nil
}

func (s *StatsManager) flushLoop() {
	ticker := time.NewTicker(statsFlushInterval)
	defer ticker.Stop()

	for range ticker.C {
		if err := s.FlushCounters(); err != nil {
			log.Println(err)
		}
	}
}

func (s *StatsManager) FlushCounters() error {
	pending, hasPending := s.snapshotPending()
	if !hasPending {
		return nil
	}

	if err := flushCountersFunc(pending, time.Now().UTC()); err != nil {
		s.mergePending(pending)
		return err
	}

	return nil
}

func (s *StatsManager) snapshotPending() (pendingCounters, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.pending) == 0 {
		return nil, false
	}

	pending := s.pending
	s.pending = pendingCounters{}
	return pending, true
}

func (s *StatsManager) mergePending(pending pendingCounters) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for key, delta := range pending {
		s.pending[key] += delta
	}
}

func getStatsDay(now time.Time) string {
	return now.UTC().Format("20060102")
}

func getStoredCounterDayKey(kind storedCounterKind, now time.Time) string {
	switch kind {
	case storedCounterText:
		return storedTextDayKeyPrefix + getStatsDay(now)
	case storedCounterFile:
		return storedFileDayKeyPrefix + getStatsDay(now)
	default:
		return storedTextDayKeyPrefix + getStatsDay(now)
	}
}

func getStoredCounterTotalKey(kind storedCounterKind) string {
	switch kind {
	case storedCounterText:
		return storedTextTotalKey
	case storedCounterFile:
		return storedFileTotalKey
	default:
		return storedTextTotalKey
	}
}

func getViewsTotalKey(views int) string {
	return viewsTotalKeyPrefix + strconv.Itoa(views)
}

func getViewsDayKey(views int, now time.Time) string {
	return viewsDayKeyPrefix + getStatsDay(now) + ":" + strconv.Itoa(views)
}

func getFileViewsTotalKey(views int) string {
	return fileViewsTotalKeyPrefix + strconv.Itoa(views)
}

func getFileViewsDayKey(views int, now time.Time) string {
	return fileViewsDayKeyPrefix + getStatsDay(now) + ":" + strconv.Itoa(views)
}

func incrementStoredSecretCounters(views int, now time.Time) error {
	return incrementStoredSecretCountersWithClient(getRedisClient(), views, now)
}

// incrementStoredSecretCountersWithClient records, in a SINGLE round-trip, both
// that a text secret was stored and which view count it chose. The two facts
// describe the same event, so writing them together keeps the stored-text total
// (the distribution's denominator) exactly consistent with the per-bucket view
// counts, and halves the stats round-trips on the save path.
//
// Single-view secrets are counted too (bucket "1"), so the burn-after-reading
// share is part of the same series.
func incrementStoredSecretCountersWithClient(client *redis.Client, views int, now time.Time) error {
	if err := incrementStoredCountersWithClient(client, storedCounterText, views, now); err != nil {
		return err
	}

	appStats.AddStoredSecrets(1)
	return nil
}

func incrementStoredFileCounters(views int, now time.Time) error {
	return incrementStoredFileCountersWithClient(getRedisClient(), views, now)
}

func incrementStoredFileCountersWithClient(client *redis.Client, views int, now time.Time) error {
	if err := incrementStoredCountersWithClient(client, storedCounterFile, views, now); err != nil {
		return err
	}

	appStats.AddStoredFiles(1)
	return nil
}

func incrementStoredCountersWithClient(
	client *redis.Client,
	kind storedCounterKind,
	views int,
	now time.Time,
) error {
	viewsTotalKey := getViewsTotalKey(views)
	viewsDayKey := getViewsDayKey(views, now)
	if kind == storedCounterFile {
		viewsTotalKey = getFileViewsTotalKey(views)
		viewsDayKey = getFileViewsDayKey(views, now)
	}

	storedDayKey := getStoredCounterDayKey(kind, now)
	_, err := client.TxPipelined(func(pipe redis.Pipeliner) error {
		pipe.Incr(getStoredCounterTotalKey(kind))
		pipe.Incr(storedDayKey)
		pipe.Expire(storedDayKey, statsHistoryTTL)
		pipe.Incr(viewsTotalKey)
		pipe.Incr(viewsDayKey)
		pipe.Expire(viewsDayKey, statsHistoryTTL)
		return nil
	})
	return err
}

func flushCounters(pending pendingCounters, now time.Time) error {
	return flushCountersWithClient(getRedisClient(), pending, now)
}

func flushCountersWithClient(client *redis.Client, pending pendingCounters, now time.Time) error {
	_, err := client.TxPipelined(func(pipe redis.Pipeliner) error {
		// Each counter expires only a day key it wrote.
		written := make(map[*hashCounter]bool)
		for key, delta := range pending {
			if delta == 0 {
				continue
			}

			pipe.HIncrBy(key.counter.dayKey(now), key.field, delta)
			written[key.counter] = true
		}

		for counter := range written {
			pipe.Expire(counter.dayKey(now), statsHistoryTTL)
		}
		return nil
	})

	return err
}

func getOverallStoredCounterFromRedis(kind storedCounterKind) (int64, error) {
	client := getRedisClient()
	total, err := client.Get(getStoredCounterTotalKey(kind)).Int64()
	if err == redis.Nil {
		return 0, nil
	}

	return total, err
}

func apiStat(r *http.Request) (responseCode int, response []byte) {
	responseCode = http.StatusNoContent

	r.Body = http.MaxBytesReader(nil, r.Body, maxLookupBodyBytes)

	var payload struct {
		Share string `json:"share"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && err != io.EOF {
		log.Println(err)
	}

	appStats.Record(shareCounter, payload.Share)

	return
}

func apiStatSnapshot() (responseCode int, response []byte) {
	responseCode = http.StatusOK
	response, _ = json.Marshal(appStats.GetSnapshot())
	return
}
