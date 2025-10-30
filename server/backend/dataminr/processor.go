package dataminr

import (
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
)

// AlertProcessor orchestrates alert normalization and deduplication
type AlertProcessor struct {
	api          *pluginapi.Client
	backendName  string
	deduplicator *Deduplicator
	alertHandler func(*backend.Alert) error
}

// NewAlertProcessor creates a new alert processor
func NewAlertProcessor(api *pluginapi.Client, backendName string, alertHandler func(*backend.Alert) error) *AlertProcessor {
	return &AlertProcessor{
		api:          api,
		backendName:  backendName,
		deduplicator: NewDeduplicator(api),
		alertHandler: alertHandler,
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

		// Call the alert handler (typically posts to Mattermost)
		if p.alertHandler != nil {
			if err := p.alertHandler(normalized); err != nil {
				p.api.Log.Error("Failed to handle alert", "alertId", alert.AlertID, "error", err.Error())
				continue
			}
		}

		newCount++
	}

	return newCount, nil
}

// Stop stops the processor and cleanup goroutines
func (p *AlertProcessor) Stop() {
	p.deduplicator.Stop()
}
