package backend

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockFactory creates a mock backend using the existing mockBackend from registry_test.go
func mockFactory(config Config, api *pluginapi.Client, papi plugin.API) (Backend, error) {
	return newMockBackend(config.ID, config.Name, config.Type), nil
}

func TestRegisterBackendFactory(t *testing.T) {
	// Save original registry and restore after test
	originalRegistry := factoryRegistry
	defer func() { factoryRegistry = originalRegistry }()

	// Reset registry for clean test
	factoryRegistry = make(map[string]Factory)

	t.Run("register new factory", func(t *testing.T) {
		RegisterBackendFactory("test", mockFactory)

		assert.Contains(t, factoryRegistry, "test")
	})

	t.Run("register multiple factories", func(t *testing.T) {
		factoryRegistry = make(map[string]Factory)

		RegisterBackendFactory("type1", mockFactory)
		RegisterBackendFactory("type2", mockFactory)

		assert.Contains(t, factoryRegistry, "type1")
		assert.Contains(t, factoryRegistry, "type2")
		assert.Len(t, factoryRegistry, 2)
	})

	t.Run("overwrite existing factory", func(t *testing.T) {
		factoryRegistry = make(map[string]Factory)

		RegisterBackendFactory("test", mockFactory)
		RegisterBackendFactory("test", mockFactory)

		// Should have only one entry
		assert.Len(t, factoryRegistry, 1)
	})
}

func TestCreateBackend(t *testing.T) {
	// Save original registry and restore after test
	originalRegistry := factoryRegistry
	defer func() { factoryRegistry = originalRegistry }()

	// Setup test API
	api := &plugintest.API{}
	client := pluginapi.NewClient(api, nil)

	t.Run("create backend with registered factory", func(t *testing.T) {
		factoryRegistry = make(map[string]Factory)

		RegisterBackendFactory("mock", mockFactory)

		config := Config{
			ID:   "test-id",
			Name: "Test Backend",
			Type: "mock",
		}

		backend, err := CreateBackend(config, client, api)
		require.NoError(t, err)
		require.NotNil(t, backend)

		assert.Equal(t, "test-id", backend.GetID())
		assert.Equal(t, "Test Backend", backend.GetName())
		assert.Equal(t, "mock", backend.GetType())
	})

	t.Run("fail with unknown backend type", func(t *testing.T) {
		factoryRegistry = make(map[string]Factory)

		config := Config{
			ID:   "test-id",
			Name: "Test Backend",
			Type: "unknown",
		}

		backend, err := CreateBackend(config, client, api)
		assert.Error(t, err)
		assert.Nil(t, backend)
		assert.Contains(t, err.Error(), "unknown backend type: unknown")
	})

	t.Run("fail with empty backend type", func(t *testing.T) {
		factoryRegistry = make(map[string]Factory)

		config := Config{
			ID:   "test-id",
			Name: "Test Backend",
			Type: "",
		}

		backend, err := CreateBackend(config, client, api)
		assert.Error(t, err)
		assert.Nil(t, backend)
		assert.Contains(t, err.Error(), "backend type is required")
	})
}
