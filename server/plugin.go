package main

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
	_ "github.com/mattermost/mattermost-plugin-dataminr/server/backend/dataminr" // Register dataminr backend factory
)

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	// client is the Mattermost server API client.
	client *pluginapi.Client

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration

	// registry manages all active backend instances.
	registry *backend.Registry
}

// OnActivate is invoked when the plugin is activated. If an error is returned, the plugin will be deactivated.
func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API, p.Driver)
	p.registry = backend.NewRegistry()

	// Initialize backends from current configuration
	config := p.getConfiguration()
	for _, backendConfig := range config.Backends {
		p.createAndStartBackend(backendConfig)
	}

	return nil
}

// OnDeactivate is invoked when the plugin is deactivated.
func (p *Plugin) OnDeactivate() error {
	if p.registry != nil {
		if err := p.registry.StopAll(); err != nil {
			p.API.LogError("Failed to stop all backends during deactivation", "error", err.Error())
			return err
		}
	}
	return nil
}

// createAndStartBackend creates a backend instance, registers it, and starts it.
// Logs errors but does not fail - errors are non-fatal for individual backends.
func (p *Plugin) createAndStartBackend(config backend.Config) {
	// Skip disabled backends
	if !config.Enabled {
		p.API.LogInfo("Skipping disabled backend", "id", config.ID, "name", config.Name)
		return
	}

	// Create backend instance using factory
	b, err := backend.Create(config, p.client, p.API)
	if err != nil {
		p.API.LogError("Failed to create backend", "id", config.ID, "name", config.Name, "error", err.Error())
		return
	}

	// Register backend
	if err := p.registry.Register(b); err != nil {
		p.API.LogError("Failed to register backend", "id", config.ID, "name", config.Name, "error", err.Error())
		return
	}

	// Start backend
	if err := b.Start(); err != nil {
		p.API.LogError("Failed to start backend", "id", config.ID, "name", config.Name, "error", err.Error())
		// Unregister since we couldn't start it
		_ = p.registry.Unregister(config.ID)
		return
	}

	p.API.LogInfo("Backend started successfully", "id", config.ID, "name", config.Name, "type", config.Type)
}

// See https://developers.mattermost.com/extend/plugins/server/reference/
