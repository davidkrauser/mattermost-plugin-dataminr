package dataminr

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestDeduplicator(t *testing.T) {
	t.Run("new alert is not a duplicate", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		assert.False(t, dedup.IsDuplicate("alert-1"))
	})

	t.Run("marked alert is a duplicate", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		dedup.MarkSeen("alert-1")
		assert.True(t, dedup.IsDuplicate("alert-1"))
	})

	t.Run("multiple different alerts", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		// Mark several alerts as seen
		dedup.MarkSeen("alert-1")
		dedup.MarkSeen("alert-2")
		dedup.MarkSeen("alert-3")

		// All marked alerts should be duplicates
		assert.True(t, dedup.IsDuplicate("alert-1"))
		assert.True(t, dedup.IsDuplicate("alert-2"))
		assert.True(t, dedup.IsDuplicate("alert-3"))

		// Unseen alert should not be a duplicate
		assert.False(t, dedup.IsDuplicate("alert-4"))
	})

	t.Run("cleanup removes expired entries", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		// Mark an alert as seen
		dedup.MarkSeen("alert-1")

		// Manually set the seen time to be older than TTL
		dedup.mu.Lock()
		dedup.seenAlerts["alert-1"] = time.Now().Add(-2 * time.Hour)
		dedup.mu.Unlock()

		// Run cleanup
		dedup.cleanup()

		// Alert should no longer be a duplicate
		assert.False(t, dedup.IsDuplicate("alert-1"))
	})

	t.Run("cleanup keeps recent entries", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		// Mark an alert as seen
		dedup.MarkSeen("alert-1")

		// Run cleanup
		dedup.cleanup()

		// Recent alert should still be a duplicate
		assert.True(t, dedup.IsDuplicate("alert-1"))
	})

	t.Run("cleanup with mixed expiration", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		// Add recent alerts
		dedup.MarkSeen("alert-recent-1")
		dedup.MarkSeen("alert-recent-2")

		// Add old alerts
		dedup.mu.Lock()
		dedup.seenAlerts["alert-old-1"] = time.Now().Add(-2 * time.Hour)
		dedup.seenAlerts["alert-old-2"] = time.Now().Add(-3 * time.Hour)
		dedup.mu.Unlock()

		// Run cleanup
		dedup.cleanup()

		// Recent alerts should still be duplicates
		assert.True(t, dedup.IsDuplicate("alert-recent-1"))
		assert.True(t, dedup.IsDuplicate("alert-recent-2"))

		// Old alerts should be removed
		assert.False(t, dedup.IsDuplicate("alert-old-1"))
		assert.False(t, dedup.IsDuplicate("alert-old-2"))
	})

	t.Run("stop waits for cleanup goroutine", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)

		// Stop should not block indefinitely
		done := make(chan struct{})
		go func() {
			dedup.Stop()
			close(done)
		}()

		select {
		case <-done:
			// Success - Stop completed
		case <-time.After(1 * time.Second):
			t.Fatal("Stop() did not complete within timeout")
		}
	})

	t.Run("concurrent access is safe", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dedup := NewDeduplicator(client)
		defer dedup.Stop()

		done := make(chan struct{})

		// Writer goroutine
		go func() {
			for i := 0; i < 100; i++ {
				dedup.MarkSeen("alert-" + string(rune(i)))
			}
			done <- struct{}{}
		}()

		// Reader goroutine
		go func() {
			for i := 0; i < 100; i++ {
				dedup.IsDuplicate("alert-" + string(rune(i)))
			}
			done <- struct{}{}
		}()

		// Wait for both goroutines
		<-done
		<-done

		// If we get here without a panic, concurrent access is safe
	})
}
