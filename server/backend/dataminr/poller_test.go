package dataminr

import (
	"context"
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

	t.Run("subsequent run with time remaining returns remaining wait", func(t *testing.T) {
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
		assert.Equal(t, 20*time.Second, interval, "Should wait remaining 20 seconds")
	})

	t.Run("subsequent run after full interval executes immediately", func(t *testing.T) {
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
			LastFinished: now.Add(-30 * time.Second), // Previously ran 30 seconds ago
		}

		interval := poller.nextWaitInterval(now, metadata)
		assert.Equal(t, time.Duration(0), interval, "Should execute immediately after full interval")
	})

	t.Run("subsequent run after more than interval executes immediately", func(t *testing.T) {
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
			LastFinished: now.Add(-45 * time.Second), // Previously ran 45 seconds ago
		}

		interval := poller.nextWaitInterval(now, metadata)
		assert.Equal(t, time.Duration(0), interval, "Should execute immediately when past interval")
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

func TestPoller_Start_WithExistingCursor(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	// Mock GetCursor to return existing cursor
	api.On("KVGet", "backend_test-id_cursor").Return([]byte("existing-cursor"), nil).Once()

	client := pluginapi.NewClient(api, &plugintest.Driver{})
	stateStore := NewStateStore(api, "test-id")

	mockScheduler := &mockJobScheduler{}
	poller := NewPoller(client, api, "test-id", "Test Backend", 30*time.Second, nil, nil, stateStore, nil)
	poller.SetScheduler(mockScheduler)

	err := poller.Start()
	assert.NoError(t, err)
	assert.True(t, mockScheduler.scheduleCalled, "Should start regular job immediately when cursor exists")
	assert.Nil(t, poller.catchUpCancel, "Should not have catch-up cancel function")
}

func TestPoller_Start_WithoutCursor_StartsCatchUp(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	// Mock GetCursor to return no cursor
	api.On("KVGet", "backend_test-id_cursor").Return(nil, nil)
	// Mock SaveCursor during catch-up
	api.On("KVSet", "backend_test-id_cursor", mock.Anything).Return(nil).Maybe()

	client := pluginapi.NewClient(api, &plugintest.Driver{})
	stateStore := NewStateStore(api, "test-id")

	// Mock client that returns recent alert to complete catch-up quickly
	recentAlert := Alert{
		AlertID:   "alert-1",
		EventTime: time.Now().Add(-1 * time.Hour), // Within 24 hours
		Headline:  "Recent Alert",
	}
	mockClient := &mockAPIClient{
		response: &AlertsResponse{
			Alerts: []Alert{recentAlert},
			To:     "cursor123",
		},
	}

	mockScheduler := &mockJobScheduler{}
	poller := NewPoller(client, api, "test-id", "Test Backend", 30*time.Second, mockClient, nil, stateStore, nil)
	poller.SetScheduler(mockScheduler)

	err := poller.Start()
	assert.NoError(t, err)
	assert.NotNil(t, poller.catchUpCancel, "Should have catch-up cancel function")

	// Wait for catch-up to complete (should be quick since alert is recent)
	time.Sleep(100 * time.Millisecond)

	// Verify regular job was started after catch-up
	assert.Eventually(t, func() bool {
		return mockScheduler.scheduleCalled
	}, 1*time.Second, 100*time.Millisecond, "Should start regular job after catch-up")
}

func TestPoller_CatchUp_SkipsOldAlerts(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("KVSet", "backend_test-id_cursor", mock.Anything).Return(nil).Maybe()

	client := pluginapi.NewClient(api, &plugintest.Driver{})
	stateStore := NewStateStore(api, "test-id")

	// Create mock client that returns multiple batches:
	// 1. Old alerts (>24h)
	// 2. Recent alert (<24h) - triggers stop
	oldAlert := Alert{
		AlertID:   "alert-old",
		EventTime: time.Now().Add(-48 * time.Hour), // 2 days old
		Headline:  "Old Alert",
	}
	recentAlert := Alert{
		AlertID:   "alert-recent",
		EventTime: time.Now().Add(-1 * time.Hour), // 1 hour old
		Headline:  "Recent Alert",
	}

	callCount := 0
	mockClient := &mockAPIClientWithCallback{
		callback: func(cursor string) (*AlertsResponse, error) {
			callCount++
			if callCount == 1 {
				// First call: return old alerts
				return &AlertsResponse{
					Alerts: []Alert{oldAlert},
					To:     "cursor1",
				}, nil
			}
			// Second call: return recent alert
			return &AlertsResponse{
				Alerts: []Alert{recentAlert},
				To:     "cursor2",
			}, nil
		},
	}

	mockScheduler := &mockJobScheduler{}
	poller := NewPoller(client, api, "test-id", "Test Backend", 30*time.Second, mockClient, nil, stateStore, nil)
	poller.SetScheduler(mockScheduler)

	// Start catch-up
	ctx := context.Background()
	poller.catchUp(ctx)

	// Verify:
	// 1. Multiple fetch calls were made
	assert.Equal(t, 2, callCount, "Should fetch multiple batches until finding recent alert")
	// 2. Regular job was started
	assert.True(t, mockScheduler.scheduleCalled, "Should start regular job after catch-up")
}

func TestPoller_CatchUp_HandlesCancellation(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	// Mock KVSet for cursor saves during catch-up
	api.On("KVSet", "backend_test-id_cursor", mock.Anything).Return(nil).Maybe()

	client := pluginapi.NewClient(api, &plugintest.Driver{})
	stateStore := NewStateStore(api, "test-id")

	// Mock client that would return old alerts forever
	oldAlert := Alert{
		AlertID:   "alert-old",
		EventTime: time.Now().Add(-48 * time.Hour),
		Headline:  "Old Alert",
	}
	mockClient := &mockAPIClient{
		response: &AlertsResponse{
			Alerts: []Alert{oldAlert},
			To:     "cursor-next",
		},
	}

	poller := NewPoller(client, api, "test-id", "Test Backend", 30*time.Second, mockClient, nil, stateStore, nil)

	// Create cancellable context
	ctx, cancel := context.WithCancel(context.Background())

	// Start catch-up in goroutine
	done := make(chan bool)
	go func() {
		poller.catchUp(ctx)
		done <- true
	}()

	// Cancel after short delay
	time.Sleep(100 * time.Millisecond)
	cancel()

	// Verify catch-up stops
	select {
	case <-done:
		// Success - catch-up stopped
	case <-time.After(2 * time.Second):
		t.Fatal("Catch-up did not stop after cancellation")
	}
}

func TestPoller_Stop_CancelsCatchUp(t *testing.T) {
	api := plugintest.NewAPI(t)
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("KVGet", "backend_test-id_cursor").Return(nil, nil).Once()
	api.On("KVSet", "backend_test-id_cursor", mock.Anything).Return(nil).Maybe()

	client := pluginapi.NewClient(api, &plugintest.Driver{})
	stateStore := NewStateStore(api, "test-id")

	// Mock client that returns old alerts (would never complete catch-up naturally)
	oldAlert := Alert{
		AlertID:   "alert-old",
		EventTime: time.Now().Add(-48 * time.Hour),
		Headline:  "Old Alert",
	}
	mockClient := &mockAPIClient{
		response: &AlertsResponse{
			Alerts: []Alert{oldAlert},
			To:     "cursor-next",
		},
	}

	poller := NewPoller(client, api, "test-id", "Test Backend", 30*time.Second, mockClient, nil, stateStore, nil)

	// Start (triggers catch-up in background)
	err := poller.Start()
	assert.NoError(t, err)
	assert.NotNil(t, poller.catchUpCancel, "Should have catch-up cancel function")

	// Wait briefly for catch-up to start
	time.Sleep(50 * time.Millisecond)

	// Stop should cancel catch-up
	err = poller.Stop()
	assert.NoError(t, err)
	assert.Nil(t, poller.catchUpCancel, "Cancel function should be cleared after Stop")
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

// mockAPIClientWithCallback allows dynamic responses
type mockAPIClientWithCallback struct {
	callback func(cursor string) (*AlertsResponse, error)
}

func (m *mockAPIClientWithCallback) FetchAlerts(cursor string) (*AlertsResponse, error) {
	return m.callback(cursor)
}

// mockJobScheduler is a mock for the JobScheduler interface
type mockJobScheduler struct {
	scheduleCalled bool
	job            *mockJob
}

func (m *mockJobScheduler) Schedule(jobID string, nextWaitInterval cluster.NextWaitInterval, callback func()) (Job, error) {
	m.scheduleCalled = true
	m.job = &mockJob{}
	return m.job, nil
}

// mockJob is a mock for the Job interface
type mockJob struct {
	closed bool
}

func (m *mockJob) Close() error {
	m.closed = true
	return nil
}
