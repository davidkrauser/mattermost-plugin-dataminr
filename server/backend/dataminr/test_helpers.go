package dataminr

import (
	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
)

// MockPoster is a mock poster implementation for testing
type MockPoster struct {
	PostAlertFn func(alert backend.Alert, channelID string) error
}

// PostAlert calls the mock function
func (m *MockPoster) PostAlert(alert backend.Alert, channelID string) error {
	if m.PostAlertFn != nil {
		return m.PostAlertFn(alert, channelID)
	}
	return nil
}
