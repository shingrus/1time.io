package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis"
)

const (
	pageHitTotalKey        = "stats:page:hits:total"
	pageHitDayKeyPrefix    = "stats:page:hits:day:"
	storedCounterKeyPrefix = "storedCounter_"
	statsHistoryTTL        = time.Hour * 24 * 60
	statsFlushInterval     = time.Second * 10
	statPageCount          = 3
)

type statPageIndex int

const (
	statPageHome statPageIndex = iota
	statPageBlog
	statPagePassword
)

var statPageNames = [statPageCount]string{
	"home",
	"blog",
	"password",
}

type pageHitSnapshot [statPageCount]int64

type StatsSnapshot struct {
	OverallStoredSecrets int64            `json:"overallStoredSecrets"`
	PendingPageHits      map[string]int64 `json:"pendingPageHits"`
	PendingPageHitsTotal int64            `json:"pendingPageHitsTotal"`
	FlushIntervalSeconds int64            `json:"flushIntervalSeconds"`
}

type StatsManager struct {
	mu                   sync.Mutex
	pendingPageHits      pageHitSnapshot
	overallStoredSecrets atomic.Int64
}

var appStats = NewStatsManager()

func NewStatsManager() *StatsManager {
	return &StatsManager{}
}

func (s *StatsManager) Start() {
	if err := s.loadOverallStoredSecrets(); err != nil {
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

func (s *StatsManager) GetOverallStoredSecrets() int64 {
	return s.overallStoredSecrets.Load()
}

func (s *StatsManager) GetSnapshot() StatsSnapshot {
	s.mu.Lock()
	pendingPageHits := s.pendingPageHits
	s.mu.Unlock()

	snapshot := StatsSnapshot{
		OverallStoredSecrets: s.GetOverallStoredSecrets(),
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

func (s *StatsManager) loadOverallStoredSecrets() error {
	total, err := getOverallStoredSecretsFromRedis()
	if err != nil {
		return err
	}

	s.overallStoredSecrets.Store(total)

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

	if err := flushPageHitCounters(pageHits, time.Now().UTC()); err != nil {
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

func getStoredCounterKey(now time.Time) string {
	return storedCounterKeyPrefix + getStatsDay(now)
}

func getPageHitDayKey(now time.Time) string {
	return pageHitDayKeyPrefix + getStatsDay(now)
}

func incrementStoredSecretCounters(now time.Time) error {
	client := getRedisClient()
	dayKey := getStoredCounterKey(now)

	_, err := client.TxPipelined(func(pipe redis.Pipeliner) error {
		pipe.Incr(globalIncrementalKey)
		pipe.Incr(dayKey)
		pipe.Expire(dayKey, statsHistoryTTL)
		return nil
	})
	if err != nil {
		return err
	}

	appStats.AddStoredSecrets(1)
	return nil
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

func getOverallStoredSecretsFromRedis() (int64, error) {
	client := getRedisClient()
	total, err := client.Get(globalIncrementalKey).Int64()
	if err == redis.Nil {
		return 0, nil
	}

	return total, err
}

func apiStat(r *http.Request) (responseCode int, response []byte) {
	responseCode = http.StatusNoContent

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
