package dataminr

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/pluginapi"
)

const (
	// DeduplicationCacheTTL is how long to keep alert IDs in the deduplication cache
	DeduplicationCacheTTL = 1 * time.Hour

	// DeduplicationCleanupInterval is how often to clean up expired entries
	DeduplicationCleanupInterval = 10 * time.Minute
)

// Deduplicator tracks seen alert IDs to prevent duplicate processing
type Deduplicator struct {
	api         *pluginapi.Client
	seenAlerts  map[string]time.Time
	mu          sync.RWMutex
	stopCleanup chan struct{}
	cleanupDone chan struct{}
}

// NewDeduplicator creates a new deduplicator and starts the cleanup loop
func NewDeduplicator(api *pluginapi.Client) *Deduplicator {
	d := &Deduplicator{
		api:         api,
		seenAlerts:  make(map[string]time.Time),
		stopCleanup: make(chan struct{}),
		cleanupDone: make(chan struct{}),
	}

	go d.cleanupLoop()

	return d
}

// IsDuplicate checks if an alert has already been seen
func (d *Deduplicator) IsDuplicate(alertID string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()

	_, exists := d.seenAlerts[alertID]
	return exists
}

// MarkSeen marks an alert as seen
func (d *Deduplicator) MarkSeen(alertID string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.seenAlerts[alertID] = time.Now()
}

// cleanupLoop periodically removes expired entries from the cache
func (d *Deduplicator) cleanupLoop() {
	ticker := time.NewTicker(DeduplicationCleanupInterval)
	defer ticker.Stop()
	defer close(d.cleanupDone)

	for {
		select {
		case <-ticker.C:
			d.cleanup()
		case <-d.stopCleanup:
			return
		}
	}
}

// cleanup removes entries older than DeduplicationCacheTTL
func (d *Deduplicator) cleanup() {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	expired := 0

	for alertID, seenTime := range d.seenAlerts {
		if now.Sub(seenTime) > DeduplicationCacheTTL {
			delete(d.seenAlerts, alertID)
			expired++
		}
	}

	if expired > 0 {
		d.api.Log.Debug("Cleaned up expired deduplication cache entries",
			"expired", expired,
			"remaining", len(d.seenAlerts))
	}
}

// Stop stops the cleanup goroutine and waits for it to finish
func (d *Deduplicator) Stop() {
	close(d.stopCleanup)
	<-d.cleanupDone
}
