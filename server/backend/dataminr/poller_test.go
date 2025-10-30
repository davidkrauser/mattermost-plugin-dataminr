package dataminr

import (
	"errors"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
)

func TestPoller_nextWaitInterval(t *testing.T) {
	t.Run("first run executes immediately", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		poller := NewPoller(
			client,
			api,
			"test-backend-id",
			"Test Backend",
			30*time.Second,
			nil,
			nil,
			nil,
			nil,
		)

		now := time.Now()
		metadata := cluster.JobMetadata{
			LastFinished: time.Time{}, // Zero time = first run
		}

		interval := poller.nextWaitInterval(now, metadata)
		assert.Equal(t, time.Duration(0), interval, "First run should execute immediately")
	})

	t.Run("subsequent runs wait full interval", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		pollInterval := 30 * time.Second
		poller := NewPoller(
			client,
			api,
			"test-backend-id",
			"Test Backend",
			pollInterval,
			nil,
			nil,
			nil,
			nil,
		)

		now := time.Now()
		metadata := cluster.JobMetadata{
			LastFinished: now.Add(-10 * time.Second), // Previously ran 10 seconds ago
		}

		interval := poller.nextWaitInterval(now, metadata)
		assert.Equal(t, pollInterval, interval, "Should wait full poll interval")
	})
}

func TestPoller_run_Success(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("KVSet", mock.Anything, mock.Anything).Return(nil).Maybe()
	api.On("KVGet", mock.Anything).Return(nil, nil).Maybe()
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	// Create mock state store
	stateStore := NewStateStore(api, "test-id")

	// Create mock API client
	mockAlerts := []Alert{
		{
			AlertID:       "alert-1",
			AlertType:     AlertType{Name: "Flash"},
			EventTime:     time.Now(),
			Headline:      "Test Alert",
			FirstAlertURL: "https://example.com/alert/1",
		},
	}
	mockResponse := &AlertsResponse{
		Alerts: mockAlerts,
		To:     "cursor456",
	}
	mockClient := &mockAPIClient{
		response: mockResponse,
	}

	// Create processor with poster that tracks calls
	handlerCalled := false
	mockPoster := &MockPoster{
		PostAlertFn: func(alert backend.Alert, channelID string) error {
			handlerCalled = true
			return nil
		},
	}
	processor := NewAlertProcessor(client, "Test Backend", mockPoster, "test-channel-id")
	defer processor.Stop()

	poller := NewPoller(
		client,
		api,
		"test-id",
		"Test Backend",
		30*time.Second,
		mockClient,
		processor,
		stateStore,
		nil,
	)

	// Run poll cycle
	poller.run()

	// Verify all operations completed
	assert.True(t, handlerCalled, "Alert handler should have been called")
	assert.Equal(t, 1, mockClient.fetchCallCount, "FetchAlerts should have been called once")
}

func TestPoller_run_FetchError(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()

	// Mock KV operations - use Maybe() to allow any KV calls
	failureCount := 0
	api.On("KVGet", mock.Anything).Return(nil, nil).Maybe()
	api.On("KVSet", "backend_test-id_failures", mock.Anything).Run(func(args mock.Arguments) {
		failureCount = 1
	}).Return(nil).Once()
	api.On("KVSet", mock.Anything, mock.Anything).Return(nil).Maybe()

	client := pluginapi.NewClient(api, &plugintest.Driver{})

	stateStore := NewStateStore(api, "test-id")

	// Create mock client that returns error
	mockClient := &mockAPIClient{
		err: errors.New("API error"),
	}

	processor := NewAlertProcessor(client, "Test Backend", &MockPoster{}, "test-channel-id")
	defer processor.Stop()

	poller := NewPoller(
		client,
		api,
		"test-id",
		"Test Backend",
		30*time.Second,
		mockClient,
		processor,
		stateStore,
		nil,
	)

	// Run poll cycle
	poller.run()

	// Verify failure was incremented
	assert.Equal(t, 1, failureCount)
}

func TestPoller_handlePollError_MaxFailures(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()

	// Track failure count manually since we're mocking KV storage
	currentFailures := backend.MaxConsecutiveFailures - 1

	// Mocks for setting up initial failure count (IncrementFailures calls in the setup loop)
	for i := 0; i < backend.MaxConsecutiveFailures-1; i++ {
		api.On("KVGet", "backend_test-id_failures").Return(nil, nil).Once()
		api.On("KVSet", "backend_test-id_failures", mock.Anything).Return(nil).Once()
	}

	client := pluginapi.NewClient(api, &plugintest.Driver{})

	stateStore := NewStateStore(api, "test-id")

	poller := NewPoller(
		client,
		api,
		"test-id",
		"Test Backend",
		30*time.Second,
		nil,
		nil,
		stateStore,
		nil,
	)

	// Set failure count to just below threshold
	for i := 0; i < backend.MaxConsecutiveFailures-1; i++ {
		_, err := stateStore.IncrementFailures()
		assert.NoError(t, err)
	}

	// Now mock the final handlePollError call (SaveLastError + IncrementFailures)
	api.On("KVSet", "backend_test-id_last_error", mock.Anything).Return(nil).Once()
	api.On("KVGet", "backend_test-id_failures").Return(nil, nil).Once()
	api.On("KVSet", "backend_test-id_failures", mock.Anything).Run(func(args mock.Arguments) {
		currentFailures++
	}).Return(nil).Once()

	// Handle one more error to reach threshold
	poller.handlePollError(errors.New("test error"))

	// Verify failure count reached threshold
	assert.Equal(t, backend.MaxConsecutiveFailures, currentFailures)

	// Verify poller was stopped (job should be nil)
	assert.Nil(t, poller.job, "Poller should have been stopped after max failures")
}

func TestPoller_handlePollError_BelowThreshold(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()

	// Mock single increment (also includes SaveLastError call)
	failureCount := 0
	api.On("KVSet", "backend_test-id_last_error", mock.Anything).Return(nil).Once()
	api.On("KVGet", "backend_test-id_failures").Return(nil, nil).Once()
	api.On("KVSet", "backend_test-id_failures", mock.Anything).Run(func(args mock.Arguments) {
		failureCount = 1
	}).Return(nil).Once()

	client := pluginapi.NewClient(api, &plugintest.Driver{})

	stateStore := NewStateStore(api, "test-id")

	poller := NewPoller(
		client,
		api,
		"test-id",
		"Test Backend",
		30*time.Second,
		nil,
		nil,
		stateStore,
		nil,
	)

	// Handle error below threshold
	poller.handlePollError(errors.New("test error"))

	// Verify failure count incremented but below threshold
	assert.Equal(t, 1, failureCount)
	assert.Less(t, failureCount, backend.MaxConsecutiveFailures)
}

// mockAPIClient is a simple mock for APIClient
type mockAPIClient struct {
	response       *AlertsResponse
	err            error
	fetchCallCount int
}

func (m *mockAPIClient) FetchAlerts(cursor string) (*AlertsResponse, error) {
	m.fetchCallCount++
	if m.err != nil {
		return nil, m.err
	}
	return m.response, nil
}
