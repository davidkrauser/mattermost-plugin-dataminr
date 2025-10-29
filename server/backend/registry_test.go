package backend

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockBackendDelays configures delays for mock backend methods
type mockBackendDelays struct {
	start     time.Duration
	stop      time.Duration
	getID     time.Duration
	getName   time.Duration
	getType   time.Duration
	getStatus time.Duration
}

// mockBackend is a simple mock implementation of the Backend interface for testing
type mockBackend struct {
	id      string
	name    string
	typ     string
	stopped bool
	mu      sync.Mutex

	// Errors to return
	stopErr  error
	startErr error

	// Configurable delays for testing lock contention
	delays mockBackendDelays
}

func newMockBackend(id, name, typ string) *mockBackend {
	return &mockBackend{
		id:   id,
		name: name,
		typ:  typ,
	}
}

func newMockBackendWithDelays(id, name, typ string, delays mockBackendDelays) *mockBackend {
	return &mockBackend{
		id:     id,
		name:   name,
		typ:    typ,
		delays: delays,
	}
}

func (m *mockBackend) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.delays.start > 0 {
		time.Sleep(m.delays.start)
	}
	return m.startErr
}

func (m *mockBackend) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.delays.stop > 0 {
		time.Sleep(m.delays.stop)
	}
	m.stopped = true
	return m.stopErr
}

func (m *mockBackend) GetID() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.delays.getID > 0 {
		time.Sleep(m.delays.getID)
	}
	return m.id
}

func (m *mockBackend) GetName() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.delays.getName > 0 {
		time.Sleep(m.delays.getName)
	}
	return m.name
}

func (m *mockBackend) GetType() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.delays.getType > 0 {
		time.Sleep(m.delays.getType)
	}
	return m.typ
}

func (m *mockBackend) GetStatus() Status {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.delays.getStatus > 0 {
		time.Sleep(m.delays.getStatus)
	}
	return Status{}
}

func (m *mockBackend) isStopped() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.stopped
}

func TestNewRegistry(t *testing.T) {
	registry := NewRegistry()
	assert.NotNil(t, registry)
	assert.Equal(t, 0, registry.Count())
}

func TestRegistry_Register(t *testing.T) {
	registry := NewRegistry()
	backend := newMockBackend("backend1", "Test Backend", "dataminr")

	err := registry.Register(backend)
	assert.NoError(t, err)
	assert.Equal(t, 1, registry.Count())

	retrieved := registry.Get("backend1")
	assert.Equal(t, backend, retrieved)
}

func TestRegistry_RegisterNilBackend(t *testing.T) {
	registry := NewRegistry()

	err := registry.Register(nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot register nil backend")
	assert.Equal(t, 0, registry.Count())
}

func TestRegistry_RegisterEmptyID(t *testing.T) {
	registry := NewRegistry()
	backend := newMockBackend("", "Test Backend", "dataminr")

	err := registry.Register(backend)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "backend ID cannot be empty")
	assert.Equal(t, 0, registry.Count())
}

func TestRegistry_RegisterDuplicateID(t *testing.T) {
	registry := NewRegistry()
	backend1 := newMockBackend("backend1", "Test Backend 1", "dataminr")
	backend2 := newMockBackend("backend1", "Test Backend 2", "dataminr")

	err := registry.Register(backend1)
	require.NoError(t, err)

	err = registry.Register(backend2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
	assert.Equal(t, 1, registry.Count())

	// Verify the first backend is still registered
	retrieved := registry.Get("backend1")
	assert.Equal(t, backend1, retrieved)
}

func TestRegistry_Unregister(t *testing.T) {
	registry := NewRegistry()
	backend := newMockBackend("backend1", "Test Backend", "dataminr")

	err := registry.Register(backend)
	require.NoError(t, err)

	err = registry.Unregister("backend1")
	assert.NoError(t, err)
	assert.Equal(t, 0, registry.Count())
	assert.True(t, backend.isStopped())

	retrieved := registry.Get("backend1")
	assert.Nil(t, retrieved)
}

func TestRegistry_UnregisterNotFound(t *testing.T) {
	registry := NewRegistry()

	err := registry.Unregister("nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRegistry_UnregisterStopError(t *testing.T) {
	registry := NewRegistry()
	backend := newMockBackend("backend1", "Test Backend", "dataminr")
	backend.stopErr = fmt.Errorf("stop failed")

	err := registry.Register(backend)
	require.NoError(t, err)

	err = registry.Unregister("backend1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to stop backend")
	assert.Contains(t, err.Error(), "stop failed")

	// Backend should still be removed even if Stop failed
	assert.Equal(t, 0, registry.Count())
}

func TestRegistry_Get(t *testing.T) {
	registry := NewRegistry()
	backend1 := newMockBackend("backend1", "Test Backend 1", "dataminr")
	backend2 := newMockBackend("backend2", "Test Backend 2", "dataminr")

	err := registry.Register(backend1)
	require.NoError(t, err)
	err = registry.Register(backend2)
	require.NoError(t, err)

	retrieved := registry.Get("backend1")
	assert.Equal(t, backend1, retrieved)

	retrieved = registry.Get("backend2")
	assert.Equal(t, backend2, retrieved)

	retrieved = registry.Get("nonexistent")
	assert.Nil(t, retrieved)
}

func TestRegistry_List(t *testing.T) {
	registry := NewRegistry()

	// Empty registry
	list := registry.List()
	assert.NotNil(t, list)
	assert.Equal(t, 0, len(list))

	// Add backends
	backend1 := newMockBackend("backend1", "Test Backend 1", "dataminr")
	backend2 := newMockBackend("backend2", "Test Backend 2", "dataminr")
	backend3 := newMockBackend("backend3", "Test Backend 3", "dataminr")

	require.NoError(t, registry.Register(backend1))
	require.NoError(t, registry.Register(backend2))
	require.NoError(t, registry.Register(backend3))

	list = registry.List()
	assert.Equal(t, 3, len(list))

	// Verify all backends are in the list
	ids := make(map[string]bool)
	for _, b := range list {
		ids[b.GetID()] = true
	}
	assert.True(t, ids["backend1"])
	assert.True(t, ids["backend2"])
	assert.True(t, ids["backend3"])
}

func TestRegistry_StopAll(t *testing.T) {
	registry := NewRegistry()

	backend1 := newMockBackend("backend1", "Test Backend 1", "dataminr")
	backend2 := newMockBackend("backend2", "Test Backend 2", "dataminr")
	backend3 := newMockBackend("backend3", "Test Backend 3", "dataminr")

	require.NoError(t, registry.Register(backend1))
	require.NoError(t, registry.Register(backend2))
	require.NoError(t, registry.Register(backend3))

	err := registry.StopAll()
	assert.NoError(t, err)
	assert.Equal(t, 0, registry.Count())

	// Verify all backends were stopped
	assert.True(t, backend1.isStopped())
	assert.True(t, backend2.isStopped())
	assert.True(t, backend3.isStopped())
}

func TestRegistry_StopAllWithErrors(t *testing.T) {
	registry := NewRegistry()

	backend1 := newMockBackend("backend1", "Test Backend 1", "dataminr")
	backend2 := newMockBackend("backend2", "Test Backend 2", "dataminr")
	backend2.stopErr = fmt.Errorf("backend2 stop failed")
	backend3 := newMockBackend("backend3", "Test Backend 3", "dataminr")

	require.NoError(t, registry.Register(backend1))
	require.NoError(t, registry.Register(backend2))
	require.NoError(t, registry.Register(backend3))

	err := registry.StopAll()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to stop backend")

	// All backends should be removed despite errors
	assert.Equal(t, 0, registry.Count())
}

func TestRegistry_Count(t *testing.T) {
	registry := NewRegistry()
	assert.Equal(t, 0, registry.Count())

	backend1 := newMockBackend("backend1", "Test Backend 1", "dataminr")
	require.NoError(t, registry.Register(backend1))
	assert.Equal(t, 1, registry.Count())

	backend2 := newMockBackend("backend2", "Test Backend 2", "dataminr")
	require.NoError(t, registry.Register(backend2))
	assert.Equal(t, 2, registry.Count())

	require.NoError(t, registry.Unregister("backend1"))
	assert.Equal(t, 1, registry.Count())

	require.NoError(t, registry.Unregister("backend2"))
	assert.Equal(t, 0, registry.Count())
}

// TestRegistry_ConcurrentReads verifies that multiple read operations (Get, List, Count)
// can execute concurrently without blocking each other (RLock behavior).
func TestRegistry_ConcurrentReads(t *testing.T) {
	registry := NewRegistry()

	// Pre-populate registry with backends that have slow GetID (called by Get)
	readDelay := 50 * time.Millisecond
	delays := mockBackendDelays{getID: readDelay}

	for i := 0; i < 3; i++ {
		backend := newMockBackendWithDelays(
			fmt.Sprintf("backend%d", i),
			fmt.Sprintf("Backend %d", i),
			"dataminr",
			delays,
		)
		require.NoError(t, registry.Register(backend))
	}

	// Track timing to ensure reads happen concurrently
	start := time.Now()
	numReaders := 5
	var wg sync.WaitGroup
	wg.Add(numReaders)

	// Spawn multiple readers that each call Get (which calls backend.GetID())
	// Each GetID holds the backend's lock for readDelay
	for i := 0; i < numReaders; i++ {
		go func(index int) {
			defer wg.Done()
			// Get will call GetID() on the backend, which sleeps while holding backend's lock
			// But multiple goroutines should be able to hold the registry's RLock concurrently
			backend := registry.Get(fmt.Sprintf("backend%d", index%3))
			if backend != nil {
				_ = backend.GetID() // This sleeps while holding backend's lock
			}
		}(i)
	}

	wg.Wait()
	elapsed := time.Since(start)

	// If reads were truly concurrent (RLock), they shouldn't be serialized
	// Each backend's GetID takes readDelay, but multiple goroutines can read the registry concurrently
	// Worst case: 5 readers hitting 3 backends means at most 2 concurrent calls per backend
	// So elapsed should be around 2*readDelay, not 5*readDelay
	maxExpected := 3 * readDelay // Give some buffer
	assert.Less(t, elapsed, maxExpected,
		"Read operations should execute concurrently with RLock")
}

// TestRegistry_WriteLockBlocksReads verifies that a write operation (Unregister)
// blocks read operations until the write completes.
func TestRegistry_WriteLockBlocksReads(t *testing.T) {
	registry := NewRegistry()

	// Create backend with slow Stop (used by Unregister)
	writeDuration := 100 * time.Millisecond
	delays := mockBackendDelays{stop: writeDuration}
	slowBackend := newMockBackendWithDelays("backend1", "Backend 1", "dataminr", delays)
	require.NoError(t, registry.Register(slowBackend))

	// Add another backend for reading
	fastBackend := newMockBackend("backend2", "Backend 2", "dataminr")
	require.NoError(t, registry.Register(fastBackend))

	var readStarted, readCompleted time.Time
	var wg sync.WaitGroup
	wg.Add(2)

	// Writer goroutine - Unregister holds write lock and calls Stop() which sleeps
	go func() {
		defer wg.Done()
		_ = registry.Unregister("backend1") // This holds write lock during Stop()
	}()

	// Give writer time to acquire lock
	time.Sleep(10 * time.Millisecond)

	// Reader goroutine - should be blocked by writer
	go func() {
		defer wg.Done()
		readStarted = time.Now()
		_ = registry.Get("backend2")
		readCompleted = time.Now()
	}()

	wg.Wait()

	// Read should have been delayed by at least writeDuration
	readDelay := readCompleted.Sub(readStarted)
	assert.GreaterOrEqual(t, readDelay, writeDuration-20*time.Millisecond,
		"Read should be blocked while write lock is held")
}

// TestRegistry_WriteLockBlocksWrites verifies that concurrent write operations
// (Unregister) are serialized and execute one at a time.
func TestRegistry_WriteLockBlocksWrites(t *testing.T) {
	registry := NewRegistry()

	writeDuration := 50 * time.Millisecond
	delays := mockBackendDelays{stop: writeDuration}
	numWriters := 4

	// Register backends with slow Stop
	for i := 0; i < numWriters; i++ {
		backend := newMockBackendWithDelays(
			fmt.Sprintf("backend%d", i),
			fmt.Sprintf("Backend %d", i),
			"dataminr",
			delays,
		)
		require.NoError(t, registry.Register(backend))
	}

	start := time.Now()
	var wg sync.WaitGroup
	wg.Add(numWriters)

	// Track completion times to verify serialization
	completionTimes := make([]time.Time, numWriters)
	var mu sync.Mutex

	// Spawn multiple writers that each call Unregister (holds write lock during Stop)
	for i := 0; i < numWriters; i++ {
		go func(index int) {
			defer wg.Done()
			_ = registry.Unregister(fmt.Sprintf("backend%d", index))
			mu.Lock()
			completionTimes[index] = time.Now()
			mu.Unlock()
		}(i)
	}

	wg.Wait()
	elapsed := time.Since(start)

	// Total time should be approximately numWriters * writeDuration
	// because writes are serialized
	expectedMin := time.Duration(numWriters) * writeDuration
	assert.GreaterOrEqual(t, elapsed, expectedMin-30*time.Millisecond,
		"Write operations should be serialized")

	// Verify writes completed in sequence, not in parallel
	// Check that completion times are spread out (not all within a small window)
	mu.Lock()
	firstCompletion := completionTimes[0]
	lastCompletion := completionTimes[0]
	for _, ct := range completionTimes {
		if ct.Before(firstCompletion) {
			firstCompletion = ct
		}
		if ct.After(lastCompletion) {
			lastCompletion = ct
		}
	}
	mu.Unlock()

	// Span between first and last completion should be close to (numWriters-1) * writeDuration
	completionSpan := lastCompletion.Sub(firstCompletion)
	expectedSpan := time.Duration(numWriters-1) * writeDuration
	assert.GreaterOrEqual(t, completionSpan, expectedSpan-30*time.Millisecond,
		"Writes should complete sequentially, not in parallel")
}

// TestRegistry_StopAllSerializes verifies that StopAll properly serializes
// Stop calls and holds the write lock throughout.
func TestRegistry_StopAllSerializes(t *testing.T) {
	registry := NewRegistry()

	// Register multiple backends with Stop delays
	stopDelay := 40 * time.Millisecond
	numBackends := 3
	delays := mockBackendDelays{stop: stopDelay}

	for i := 0; i < numBackends; i++ {
		backend := newMockBackendWithDelays(
			fmt.Sprintf("backend%d", i),
			fmt.Sprintf("Backend %d", i),
			"dataminr",
			delays,
		)
		require.NoError(t, registry.Register(backend))
	}

	start := time.Now()
	var readCompleted time.Time
	var wg sync.WaitGroup
	wg.Add(2)

	// StopAll in goroutine
	go func() {
		defer wg.Done()
		_ = registry.StopAll()
	}()

	// Give StopAll time to start
	time.Sleep(10 * time.Millisecond)

	// Try to read while StopAll is in progress
	readStarted := time.Now()
	go func() {
		defer wg.Done()
		_ = registry.Get("backend1")
		readCompleted = time.Now()
	}()

	wg.Wait()
	elapsed := time.Since(start)

	// StopAll should take at least numBackends * stopDelay
	expectedMin := time.Duration(numBackends) * stopDelay
	assert.GreaterOrEqual(t, elapsed, expectedMin-30*time.Millisecond,
		"StopAll should serialize Stop calls")

	// Read should be blocked until StopAll completes
	readDelay := readCompleted.Sub(readStarted)
	assert.GreaterOrEqual(t, readDelay, expectedMin-30*time.Millisecond,
		"Read should be blocked while StopAll holds write lock")
}

// TestRegistry_RegisterDuringRead verifies that Register (write) is blocked
// while reads are in progress, and completes after reads finish.
func TestRegistry_RegisterDuringRead(t *testing.T) {
	registry := NewRegistry()

	// Pre-populate registry with backend that has slow GetID
	readDuration := 80 * time.Millisecond
	delays := mockBackendDelays{getID: readDuration}
	backend1 := newMockBackendWithDelays("backend1", "Backend 1", "dataminr", delays)
	require.NoError(t, registry.Register(backend1))

	var registerCompleted time.Time
	var wg sync.WaitGroup
	wg.Add(2)

	// Reader holds read lock, then calls GetID which sleeps
	go func() {
		defer wg.Done()
		backend := registry.Get("backend1")
		if backend != nil {
			_ = backend.GetID() // Sleeps while holding backend's lock (not registry lock)
		}
	}()

	// Give reader time to acquire registry's read lock
	time.Sleep(10 * time.Millisecond)

	// Writer tries to register while read is in progress
	registerStarted := time.Now()
	go func() {
		defer wg.Done()
		backend2 := newMockBackend("backend2", "Backend 2", "dataminr")
		_ = registry.Register(backend2)
		registerCompleted = time.Now()
	}()

	wg.Wait()

	// Register should complete quickly after the read lock is released
	// The read lock is held only during Get(), not during GetID()
	// So Register shouldn't be delayed by the full readDuration
	registerDelay := registerCompleted.Sub(registerStarted)

	// Register should be blocked briefly (while Get holds RLock), but not for readDuration
	// because GetID runs after the RLock is released
	assert.Less(t, registerDelay, readDuration/2,
		"Register should not be blocked by backend operations, only by registry RLock")
}

// TestRegistry_ConcurrentMixedOperations tests realistic mixed concurrent access
func TestRegistry_ConcurrentMixedOperations(t *testing.T) {
	registry := NewRegistry()

	// Pre-populate with some backends
	for i := 0; i < 5; i++ {
		backend := newMockBackend(fmt.Sprintf("initial%d", i), fmt.Sprintf("Initial %d", i), "dataminr")
		require.NoError(t, registry.Register(backend))
	}

	// Run mixed operations concurrently
	var wg sync.WaitGroup
	numOps := 20
	wg.Add(numOps)

	for i := 0; i < numOps; i++ {
		go func(index int) {
			defer wg.Done()

			switch index % 4 {
			case 0: // Read operation
				_ = registry.Get(fmt.Sprintf("initial%d", index%5))
			case 1: // List operation
				_ = registry.List()
			case 2: // Register new backend
				backend := newMockBackend(
					fmt.Sprintf("new%d", index),
					fmt.Sprintf("New %d", index),
					"dataminr",
				)
				_ = registry.Register(backend)
			case 3: // Count operation
				_ = registry.Count()
			}
		}(i)
	}

	wg.Wait()

	// Verify registry is in valid state
	count := registry.Count()
	assert.GreaterOrEqual(t, count, 5, "Should have at least initial backends")
	list := registry.List()
	assert.Equal(t, count, len(list), "Count should match List length")
}
