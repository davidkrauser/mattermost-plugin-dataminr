package backend

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// Factory is a function type that creates a backend instance
type Factory func(config Config, api *pluginapi.Client, papi plugin.API) (Backend, error)

// factoryRegistry maps backend types to their factory functions
var factoryRegistry = make(map[string]Factory)

// RegisterBackendFactory registers a backend factory for a given type.
// This allows backends to register themselves for creation.
func RegisterBackendFactory(backendType string, factory Factory) {
	factoryRegistry[backendType] = factory
}

// CreateBackend creates a new backend instance based on the provided configuration.
// Returns an error if the backend type is unknown or if creation fails.
func CreateBackend(config Config, api *pluginapi.Client, papi plugin.API) (Backend, error) {
	if config.Type == "" {
		return nil, fmt.Errorf("backend type is required")
	}

	factory, exists := factoryRegistry[config.Type]
	if !exists {
		return nil, fmt.Errorf("unknown backend type: %s", config.Type)
	}

	return factory(config, api, papi)
}
