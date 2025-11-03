package dataminr

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
)

// AlertFetcher is an interface for fetching alerts from the Dataminr API
type AlertFetcher interface {
	FetchAlerts(cursor string) (*AlertsResponse, error)
}

// Poller manages the cluster-aware scheduled polling job for a Dataminr backend
type Poller struct {
	api             *pluginapi.Client
	backendID       string
	backendName     string
	interval        time.Duration
	client          AlertFetcher
	processor       *AlertProcessor
	stateStore      *StateStore
	scheduler       JobScheduler
	job             Job
	disableCallback backend.DisableCallback
	catchUpCancel   context.CancelFunc // Cancels catch-up goroutine if running
}

// NewPoller creates a new poller instance
func NewPoller(
	api *pluginapi.Client,
	papi plugin.API,
	backendID string,
	backendName string,
	interval time.Duration,
	client AlertFetcher,
	processor *AlertProcessor,
	stateStore *StateStore,
	disableCallback backend.DisableCallback,
) *Poller {
	return &Poller{
		api:             api,
		backendID:       backendID,
		backendName:     backendName,
		interval:        interval,
		client:          client,
		processor:       processor,
		stateStore:      stateStore,
		scheduler:       NewClusterJobScheduler(papi),
		disableCallback: disableCallback,
	}
}

// SetScheduler sets a custom job scheduler (useful for testing)
func (p *Poller) SetScheduler(scheduler JobScheduler) {
	p.scheduler = scheduler
}

// Start begins the polling job using Mattermost's cluster job system
// This ensures only one server instance polls in a multi-server cluster
// If no cursor exists, runs a catch-up routine first to skip historical alerts
func (p *Poller) Start() error {
	if p.job != nil {
		return fmt.Errorf("poller already running")
	}

	// Check if we need to catch up (no cursor = first time)
	cursor, err := p.stateStore.GetCursor()
	if err != nil {
		return fmt.Errorf("failed to check cursor state: %w", err)
	}

	if cursor == "" {
		// No cursor exists - need to catch up to avoid posting historical alerts
		p.api.Log.Info("No cursor found - starting catch-up routine to skip historical alerts",
			"backendId", p.backendID,
			"backendName", p.backendName)

		// Create cancellable context for catch-up
		ctx, cancel := context.WithCancel(context.Background())
		p.catchUpCancel = cancel

		// Run catch-up in background, then start regular job
		go p.catchUp(ctx)
		return nil
	}

	// Cursor exists - start regular polling immediately
	return p.startRegularJob()
}

// startRegularJob starts the regular polling job
func (p *Poller) startRegularJob() error {
	jobID := fmt.Sprintf("dataminr_poll_%s", p.backendID)

	// Schedule the recurring job with cluster awareness
	job, err := p.scheduler.Schedule(jobID, p.nextWaitInterval, p.run)
	if err != nil {
		return fmt.Errorf("failed to schedule cluster job: %w", err)
	}

	p.job = job
	p.api.Log.Info("Poller started", "backendId", p.backendID, "backendName", p.backendName, "interval", p.interval)
	return nil
}

// catchUp fetches historical alerts until we reach alerts within 24 hours
// This runs in a background goroutine and does NOT post any alerts
// Once caught up, it starts the regular polling job
func (p *Poller) catchUp(ctx context.Context) {
	p.api.Log.Info("Catch-up routine started",
		"backendId", p.backendID,
		"backendName", p.backendName)

	cursor := ""
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
	totalSkipped := 0

	for {
		// Update last poll time before making API call
		if err := p.stateStore.SaveLastPoll(time.Now()); err != nil {
			p.api.Log.Error("Failed to save last poll time during catch-up",
				"backendId", p.backendID,
				"error", err.Error())
		}

		// Fetch alerts with current cursor
		response, err := p.client.FetchAlerts(cursor)
		if err != nil {
			p.api.Log.Error("Catch-up failed - disabling backend",
				"backendId", p.backendID,
				"backendName", p.backendName,
				"error", err.Error())
			p.handlePollError(fmt.Errorf("catch-up failed: %w", err))
			return
		}

		// Check if any alerts are within 24 hours
		foundRecent := false
		for _, alert := range response.Alerts {
			if alert.EventTime.After(twentyFourHoursAgo) {
				foundRecent = true
				break
			}
		}

		totalSkipped += len(response.Alerts)

		// Save cursor after each successful fetch
		if response.To != "" {
			cursor = response.To
			if err := p.stateStore.SaveCursor(cursor); err != nil {
				p.api.Log.Error("Failed to save cursor during catch-up",
					"backendId", p.backendID,
					"error", err.Error())
			}
		}

		// Update last success time on successful fetch
		if err := p.stateStore.SaveLastSuccess(time.Now()); err != nil {
			p.api.Log.Error("Failed to save last success time during catch-up",
				"backendId", p.backendID,
				"error", err.Error())
		}

		// Reset failure counter on successful fetch (same as regular polling)
		if err := p.stateStore.ResetFailures(); err != nil {
			p.api.Log.Error("Failed to reset failure counter during catch-up",
				"backendId", p.backendID,
				"error", err.Error())
		}

		// Clear last error on success
		if err := p.stateStore.SaveLastError(""); err != nil {
			p.api.Log.Error("Failed to clear last error during catch-up",
				"backendId", p.backendID,
				"error", err.Error())
		}

		// If we found a recent alert, we're caught up
		if foundRecent {
			p.api.Log.Info("Catch-up complete - found recent alerts",
				"backendId", p.backendID,
				"backendName", p.backendName,
				"totalSkipped", totalSkipped)
			break
		}

		// If no more alerts, we're at the end
		if len(response.Alerts) == 0 {
			p.api.Log.Info("Catch-up complete - reached end of historical alerts",
				"backendId", p.backendID,
				"backendName", p.backendName,
				"totalSkipped", totalSkipped)
			break
		}

		// Wait 5 seconds before next request (rate limiting)
		// Use context-aware sleep to allow cancellation
		p.api.Log.Debug("Catch-up progress",
			"backendId", p.backendID,
			"alertsInBatch", len(response.Alerts),
			"totalSkipped", totalSkipped)

		select {
		case <-ctx.Done():
			p.api.Log.Info("Catch-up routine canceled",
				"backendId", p.backendID,
				"backendName", p.backendName)
			return
		case <-time.After(5 * time.Second):
			// Continue to next iteration
		}
	}

	// Start the regular polling job
	if err := p.startRegularJob(); err != nil {
		p.api.Log.Error("Failed to start regular job after catch-up",
			"backendId", p.backendID,
			"error", err.Error())
		p.handlePollError(fmt.Errorf("failed to start job after catch-up: %w", err))
	}
}

// Stop gracefully stops the polling job and cancels catch-up if running
func (p *Poller) Stop() error {
	// Cancel catch-up routine if running
	if p.catchUpCancel != nil {
		p.catchUpCancel()
		p.catchUpCancel = nil
	}

	// Stop regular job if running
	if p.job == nil {
		return nil
	}

	err := p.job.Close()
	p.job = nil

	if err != nil {
		p.api.Log.Error("Failed to close cluster job", "backendId", p.backendID, "error", err.Error())
		return fmt.Errorf("failed to close cluster job: %w", err)
	}

	p.api.Log.Info("Poller stopped", "backendId", p.backendID, "backendName", p.backendName)
	return nil
}

// nextWaitInterval is called by the cluster job scheduler to determine how long to wait
// until the next poll. The metadata.LastFinished is automatically set by the cluster scheduler.
func (p *Poller) nextWaitInterval(now time.Time, metadata cluster.JobMetadata) time.Duration {
	// For the first run, execute immediately
	if metadata.LastFinished.IsZero() {
		return 0
	}

	// Check if enough time has passed since last finished
	sinceLastFinished := now.Sub(metadata.LastFinished)
	if sinceLastFinished < p.interval {
		// Not enough time elapsed, return remaining wait time
		return p.interval - sinceLastFinished
	}

	// Enough time has passed, run immediately
	return 0
}

// run is called by the cluster job scheduler to execute a poll cycle
func (p *Poller) run() {
	p.api.Log.Debug("Starting poll cycle", "backendId", p.backendID, "backendName", p.backendName)

	// Update last poll time
	if err := p.stateStore.SaveLastPoll(time.Now()); err != nil {
		p.api.Log.Error("Failed to save last poll time", "backendId", p.backendID, "error", err.Error())
	}

	// Load cursor from state
	cursor, err := p.stateStore.GetCursor()
	if err != nil {
		p.handlePollError(fmt.Errorf("failed to load cursor: %w", err))
		return
	}

	// Fetch alerts from API
	response, err := p.client.FetchAlerts(cursor)
	if err != nil {
		p.handlePollError(fmt.Errorf("failed to fetch alerts: %w", err))
		return
	}

	// Process alerts
	newCount, err := p.processor.ProcessAlerts(response.Alerts)
	if err != nil {
		p.handlePollError(fmt.Errorf("failed to process alerts: %w", err))
		return
	}

	// Save new cursor
	if response.To != "" {
		if err := p.stateStore.SaveCursor(response.To); err != nil {
			p.handlePollError(fmt.Errorf("failed to save cursor: %w", err))
			return
		}
	}

	// Poll succeeded - update success state
	now := time.Now()
	if err := p.stateStore.SaveLastSuccess(now); err != nil {
		p.api.Log.Error("Failed to save last success time", "backendId", p.backendID, "error", err.Error())
	}

	// Reset failure counter
	if err := p.stateStore.ResetFailures(); err != nil {
		p.api.Log.Error("Failed to reset failure counter", "backendId", p.backendID, "error", err.Error())
	}

	// Clear last error on success
	if err := p.stateStore.SaveLastError(""); err != nil {
		p.api.Log.Error("Failed to clear last error", "backendId", p.backendID, "error", err.Error())
	}

	p.api.Log.Debug("Poll cycle completed",
		"backendId", p.backendID,
		"backendName", p.backendName,
		"totalAlerts", len(response.Alerts),
		"newAlerts", newCount,
		"cursor", response.To)
}

// handlePollError increments failure count and disables backend if threshold exceeded
func (p *Poller) handlePollError(err error) {
	errMsg := err.Error()

	p.api.Log.Error("Poll cycle failed",
		"backendId", p.backendID,
		"backendName", p.backendName,
		"error", errMsg)

	// Save error message
	if saveErr := p.stateStore.SaveLastError(errMsg); saveErr != nil {
		p.api.Log.Error("Failed to save last error",
			"backendId", p.backendID,
			"error", saveErr.Error())
	}

	// Increment failure counter
	failureCount, incrementErr := p.stateStore.IncrementFailures()
	if incrementErr != nil {
		p.api.Log.Error("Failed to increment failure counter",
			"backendId", p.backendID,
			"error", incrementErr.Error())
		return
	}

	// Check if backend should be disabled
	if failureCount >= backend.MaxConsecutiveFailures {
		p.api.Log.Error("Backend reached max consecutive failures",
			"backendId", p.backendID,
			"backendName", p.backendName,
			"consecutiveFailures", failureCount,
			"lastError", errMsg)

		// Call disable callback to persist the configuration change
		// This will trigger OnConfigurationChange which will stop the backend
		// Wrap in goroutine to avoid deadlock (callback triggers Stop() on this backend)
		if p.disableCallback != nil {
			go func() {
				if disableErr := p.disableCallback(p.backendID); disableErr != nil {
					p.api.Log.Error("Failed to disable backend in configuration",
						"backendId", p.backendID,
						"error", disableErr.Error())

					// Fallback: stop the poller locally if callback fails
					if stopErr := p.Stop(); stopErr != nil {
						p.api.Log.Error("Failed to stop poller after callback failure",
							"backendId", p.backendID,
							"error", stopErr.Error())
					}
				}
			}()
		} else {
			// Fallback: stop the poller if no callback is provided
			p.api.Log.Warn("No disable callback provided, stopping poller locally",
				"backendId", p.backendID)
			if stopErr := p.Stop(); stopErr != nil {
				p.api.Log.Error("Failed to stop poller",
					"backendId", p.backendID,
					"error", stopErr.Error())
			}
		}
	}
}
