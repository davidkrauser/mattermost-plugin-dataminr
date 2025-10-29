package backend

import (
	"fmt"
	"sync"
)

// Registry manages all active backend instances.
// It provides thread-safe operations for registering, retrieving, and managing backends.
type Registry struct {
	mu       sync.RWMutex
	backends map[string]Backend
}

// NewRegistry creates a new backend registry.
func NewRegistry() *Registry {
	return &Registry{
		backends: make(map[string]Backend),
	}
}

// Register adds a backend to the registry.
// Returns an error if a backend with the same ID already exists.
func (r *Registry) Register(backend Backend) error {
	if backend == nil {
		return fmt.Errorf("cannot register nil backend")
	}

	id := backend.GetID()
	if id == "" {
		return fmt.Errorf("backend ID cannot be empty")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.backends[id]; exists {
		return fmt.Errorf("backend with ID %s already registered", id)
	}

	r.backends[id] = backend
	return nil
}

// Unregister removes a backend from the registry and stops it.
// Returns an error if the backend doesn't exist or cannot be stopped.
// The backend is always removed from the registry, even if Stop fails.
func (r *Registry) Unregister(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	backend, exists := r.backends[id]
	if !exists {
		return fmt.Errorf("backend with ID %s not found", id)
	}

	// Stop the backend before removing it
	var stopErr error
	if err := backend.Stop(); err != nil {
		stopErr = fmt.Errorf("failed to stop backend %s: %w", id, err)
	}

	// Always remove the backend, even if Stop failed
	delete(r.backends, id)
	return stopErr
}

// Get retrieves a backend by its ID.
// Returns nil if the backend doesn't exist.
func (r *Registry) Get(id string) Backend {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.backends[id]
}

// List returns all registered backends.
// Returns a copy of the backend slice to avoid race conditions.
func (r *Registry) List() []Backend {
	r.mu.RLock()
	defer r.mu.RUnlock()

	backends := make([]Backend, 0, len(r.backends))
	for _, backend := range r.backends {
		backends = append(backends, backend)
	}

	return backends
}

// StopAll stops and removes all registered backends.
// Returns the first error encountered, but continues stopping remaining backends.
func (r *Registry) StopAll() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var firstError error

	for id, backend := range r.backends {
		if err := backend.Stop(); err != nil && firstError == nil {
			firstError = fmt.Errorf("failed to stop backend %s: %w", id, err)
		}
		delete(r.backends, id)
	}

	return firstError
}

// Count returns the number of registered backends.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.backends)
}
