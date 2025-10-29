package backend

// Backend defines the interface that all backend implementations must satisfy.
// Each backend type (e.g., Dataminr) implements this interface to provide
// standardized alert polling and management capabilities.
type Backend interface {
	// Start begins the backend's polling lifecycle.
	// This should initialize any necessary resources and start the polling job.
	// Returns an error if the backend cannot be started.
	Start() error

	// Stop gracefully shuts down the backend.
	// This should cancel any running polling jobs and clean up resources.
	// Returns an error if the shutdown encounters issues.
	Stop() error

	// GetID returns the unique identifier for this backend (UUID v4).
	// This ID is immutable and used for internal operations.
	GetID() string

	// GetName returns the display name for this backend.
	// This name is mutable and user-facing.
	GetName() string

	// GetType returns the backend type (e.g., "dataminr").
	GetType() string

	// GetStatus returns the current operational status of the backend.
	// This includes health information, failure counts, and authentication state.
	GetStatus() Status
}
