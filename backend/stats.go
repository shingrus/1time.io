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
	pageHitTotalKey         = "stats:page:hits:total"
	pageHitDayKeyPrefix     = "stats:page:hits:day:"
	storedTextTotalKey      = "stats:stored:text:total"
	storedTextDayKeyPrefix  = "stats:stored:text:day:"
	storedFileTotalKey      = "stats:stored:file:total"
	storedFileDayKeyPrefix  = "stats:stored:file:day:"
	viewsTotalKeyPrefix     = "stats:views:total:"
	viewsDayKeyPrefix       = "stats:views:day:"
	fileViewsTotalKeyPrefix = "stats:views:file:total:"
	fileViewsDayKeyPrefix   = "stats:views:file:day:"
	// stats:push:day:YYYYMMDD -> hash: outcome -> daily count. Day keys only.
	pushOutcomeDayKeyPrefix = "stats:push:day:"
	statsHistoryTTL         = time.Hour * 24 * 60
	statsFlushInterval      = time.Second * 10
	statPageCount           = 3
	pushOutcomeCount        = 2
)

type statPageIndex int
type storedCounterKind int
type pushOutcomeIndex int

const (
	statPageHome statPageIndex = iota
	statPageBlog
	statPagePassword
)

const (
	storedCounterText storedCounterKind = iota
	storedCounterFile
)

const (
	// Overlapping, not disjoint: succeeded is a subset of all, so the failure
	// count is all-succeeded.
	pushOutcomeAll pushOutcomeIndex = iota
	pushOutcomeSucceeded
)

var statPageNames = [statPageCount]string{
	"home",
	"blog",
	"password",
}

var pushOutcomeNames = [pushOutcomeCount]string{
	"all",
	"succeeded",
}

type pageHitSnapshot [statPageCount]int64

type pushOutcomeSnapshot [pushOutcomeCount]int64

// Buffered in memory, written to Redis by flushLoop.
type pendingCounters struct {
	pageHits     pageHitSnapshot
	pushOutcomes pushOutcomeSnapshot
}

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
	s.pending.pageHits[page]++
	s.mu.Unlock()
}

// RecordPushSend counts one finished send attempt. Both counters move under a
// single lock acquisition so they always land in the same flush, and therefore
// the same day key — recorded separately, a send straddling midnight UTC could
// put its attempt and its success on different days and report succeeded > all.
func (s *StatsManager) RecordPushSend(succeeded bool) {
	s.mu.Lock()
	s.pending.pushOutcomes[pushOutcomeAll]++
	if succeeded {
		s.pending.pushOutcomes[pushOutcomeSucceeded]++
	}
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
	pendingPageHits := s.pending.pageHits
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

	if s.pending.isEmpty() {
		return pendingCounters{}, false
	}

	pending := s.pending
	s.pending = pendingCounters{}
	return pending, true
}

func (s *StatsManager) mergePending(pending pendingCounters) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for page, delta := range pending.pageHits {
		s.pending.pageHits[page] += delta
	}
	for outcome, delta := range pending.pushOutcomes {
		s.pending.pushOutcomes[outcome] += delta
	}
}

func (p pendingCounters) isEmpty() bool {
	return p.pageHits.isEmpty() && p.pushOutcomes.isEmpty()
}

func (p pageHitSnapshot) isEmpty() bool {
	return hasNoDeltas(p[:])
}

func (p pushOutcomeSnapshot) isEmpty() bool {
	return hasNoDeltas(p[:])
}

func hasNoDeltas(deltas []int64) bool {
	for _, delta := range deltas {
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

func getPushOutcomeDayKey(now time.Time) string {
	return pushOutcomeDayKeyPrefix + getStatsDay(now)
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
	client := getRedisClient()
	pageHitDayKey := getPageHitDayKey(now)
	pushOutcomeDayKey := getPushOutcomeDayKey(now)

	_, err := client.TxPipelined(func(pipe redis.Pipeliner) error {
		// Each family guards its own Expire so a push-only flush leaves the
		// page-hit day key alone, and vice versa.
		if !pending.pageHits.isEmpty() {
			for page, delta := range pending.pageHits {
				if delta == 0 {
					continue
				}

				pageName := statPageNames[page]
				pipe.HIncrBy(pageHitTotalKey, pageName, delta)
				pipe.HIncrBy(pageHitDayKey, pageName, delta)
			}
			pipe.Expire(pageHitDayKey, statsHistoryTTL)
		}

		if !pending.pushOutcomes.isEmpty() {
			for outcome, delta := range pending.pushOutcomes {
				if delta == 0 {
					continue
				}

				pipe.HIncrBy(pushOutcomeDayKey, pushOutcomeNames[outcome], delta)
			}
			pipe.Expire(pushOutcomeDayKey, statsHistoryTTL)
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
