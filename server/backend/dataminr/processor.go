package dataminr

import (
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
)

// AlertProcessor orchestrates alert normalization and deduplication
type AlertProcessor struct {
	api          *pluginapi.Client
	backendName  string
	poster       backend.AlertPoster
	channelID    string
	deduplicator *Deduplicator
}

// NewAlertProcessor creates a new alert processor
func NewAlertProcessor(api *pluginapi.Client, backendName string, poster backend.AlertPoster, channelID string) *AlertProcessor {
	return &AlertProcessor{
		api:          api,
		backendName:  backendName,
		poster:       poster,
		channelID:    channelID,
		deduplicator: NewDeduplicator(api),
	}
}

// ProcessAlerts processes a batch of Dataminr alerts
// Returns the number of new alerts processed (after deduplication)
func (p *AlertProcessor) ProcessAlerts(alerts []Alert) (int, error) {
	newCount := 0

	for _, alert := range alerts {
		// Check for duplicates
		if p.deduplicator.IsDuplicate(alert.AlertID) {
			p.api.Log.Debug("Skipping duplicate alert", "alertId", alert.AlertID)
			continue
		}

		// Mark as seen
		p.deduplicator.MarkSeen(alert.AlertID)

		// Normalize to backend.Alert
		normalized := NormalizeAlert(alert, p.backendName)

		// Post alert to Mattermost channel
		if err := p.poster.PostAlert(*normalized, p.channelID); err != nil {
			p.api.Log.Error("Failed to post alert", "alertId", alert.AlertID, "channelId", p.channelID, "error", err.Error())
			continue
		}

		p.api.Log.Debug("Successfully posted alert", "alertId", alert.AlertID, "channelId", p.channelID)
		newCount++
	}

	return newCount, nil
}

// Stop stops the processor and cleanup goroutines
func (p *AlertProcessor) Stop() {
	p.deduplicator.Stop()
}
