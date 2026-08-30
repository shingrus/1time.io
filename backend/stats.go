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
	pageHitTotalKey        = "stats:page:hits:total"
	pageHitDayKeyPrefix    = "stats:page:hits:day:"
	storedTextTotalKey     = "stats:stored:text:total"
	storedTextDayKeyPrefix = "stats:stored:text:day:"
	storedFileTotalKey     = "stats:stored:file:total"
	storedFileDayKeyPrefix = "stats:stored:file:day:"
	// View-counter distribution. Keys are suffixed with the clamped view count
	// (1, 3, 5, 10, ...), so a changed option set just adds new suffixes:
	//   stats:views:total:<views>
	//   stats:views:day:YYYYMMDD:<views>
	viewsTotalKeyPrefix = "stats:views:total:"
	viewsDayKeyPrefix   = "stats:views:day:"
	// File download-limit distribution stays separate from text views because
	// its bandwidth cost and product behaviour are materially different.
	fileViewsTotalKeyPrefix = "stats:views:file:total:"
	fileViewsDayKeyPrefix   = "stats:views:file:day:"
	statsHistoryTTL         = time.Hour * 24 * 60
	statsFlushInterval      = time.Second * 10
	statPageCount           = 3
)

type statPageIndex int
type storedCounterKind int

const (
	statPageHome statPageIndex = iota
	statPageBlog
	statPagePassword
)

const (
	storedCounterText storedCounterKind = iota
	storedCounterFile
)

var statPageNames = [statPageCount]string{
	"home",
	"blog",
	"password",
}

type pageHitSnapshot [statPageCount]int64

type StatsSnapshot struct {
	APIVersion           int              `json:"apiVersion"`
	SaveSchemes          []int            `json:"saveSchemes"`
	OverallStoredSecrets int64            `json:"overallStoredSecrets"`
	OverallStoredFiles   int64            `json:"overallStoredFiles"`
	PendingPageHits      map[string]int64 `json:"pendingPageHits"`
	PendingPageHitsTotal int64            `json:"pendingPageHitsTotal"`
	FlushIntervalSeconds int64            `json:"flushIntervalSeconds"`
}

type StatsManager struct {
	mu                   sync.Mutex
	pendingPageHits      pageHitSnapshot
	overallStoredSecrets atomic.Int64
	overallStoredFiles   atomic.Int64
}

var appStats = NewStatsManager()

var (
	flushPageHitCountersFunc             = flushPageHitCounters
	getOverallStoredCounterFromRedisFunc = getOverallStoredCounterFromRedis
	incrementStoredSecretCountersFunc    = incrementStoredSecretCounters
)

func NewStatsManager() *StatsManager {
	return &StatsManager{}
}

func (s *StatsManager) Start() {
	if err := s.loadOverallStoredCounters(); err != nil {
		log.Println(err)
	}

	go s.flushLoop()
}

func (s *StatsManager) RecordPageHit(page statPageIndex) {
	s.mu.Lock()
	s.pendingPageHits[page]++
	s.mu.Unlock()
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
	s.mu.Lock()
	pendingPageHits := s.pendingPageHits
	s.mu.Unlock()

	snapshot := StatsSnapshot{
		APIVersion:           apiVersion,
		SaveSchemes:          supportedSaveSchemes(),
		OverallStoredSecrets: s.GetOverallStoredSecrets(),
		OverallStoredFiles:   s.GetOverallStoredFiles(),
		PendingPageHits:      make(map[string]int64, statPageCount),
		FlushIntervalSeconds: int64(statsFlushInterval / time.Second),
	}

	for page, delta := range pendingPageHits {
		pageName := statPageNames[page]
		snapshot.PendingPageHits[pageName] = delta
		snapshot.PendingPageHitsTotal += delta
	}

	return snapshot
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
		if err := s.FlushPageHits(); err != nil {
			log.Println(err)
		}
	}
}

func (s *StatsManager) FlushPageHits() error {
	pageHits, hasPageHits := s.snapshotPageHits()
	if !hasPageHits {
		return nil
	}

	if err := flushPageHitCountersFunc(pageHits, time.Now().UTC()); err != nil {
		s.mergePageHits(pageHits)
		return err
	}

	return nil
}

func (s *StatsManager) snapshotPageHits() (pageHitSnapshot, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pendingPageHits.isEmpty() {
		return pageHitSnapshot{}, false
	}

	pageHits := s.pendingPageHits
	s.pendingPageHits = pageHitSnapshot{}
	return pageHits, true
}

func (s *StatsManager) mergePageHits(pageHits pageHitSnapshot) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for page, delta := range pageHits {
		s.pendingPageHits[page] += delta
	}
}

func (p pageHitSnapshot) isEmpty() bool {
	for _, delta := range p {
		if delta != 0 {
			return false
		}
	}

	return true
}

func getStatPageIndex(page string) (statPageIndex, bool) {
	switch page {
	case "home":
		return statPageHome, true
	case "blog":
		return statPageBlog, true
	case "password":
		return statPagePassword, true
	default:
		return 0, false
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

func getPageHitDayKey(now time.Time) string {
	return pageHitDayKeyPrefix + getStatsDay(now)
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

func flushPageHitCounters(pageHits pageHitSnapshot, now time.Time) error {
	client := getRedisClient()
	dayKey := getPageHitDayKey(now)

	_, err := client.TxPipelined(func(pipe redis.Pipeliner) error {
		for page, delta := range pageHits {
			if delta == 0 {
				continue
			}

			pageName := statPageNames[page]
			pipe.HIncrBy(pageHitTotalKey, pageName, delta)
			pipe.HIncrBy(dayKey, pageName, delta)
		}
		pipe.Expire(dayKey, statsHistoryTTL)
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
		Page string `json:"page"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && err != io.EOF {
		log.Println(err)
	}

	if page, ok := getStatPageIndex(payload.Page); ok {
		appStats.RecordPageHit(page)
	}

	return
}

func apiStatSnapshot() (responseCode int, response []byte) {
	responseCode = http.StatusOK
	response, _ = json.Marshal(appStats.GetSnapshot())
	return
}
