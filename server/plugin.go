package main

import (
	"encoding/json"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
	_ "github.com/mattermost/mattermost-plugin-dataminr/server/backend/dataminr" // Register dataminr backend factory
	"github.com/mattermost/mattermost-plugin-dataminr/server/poster"
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

	// poster posts alerts to Mattermost channels.
	poster backend.AlertPoster
}

// OnActivate is invoked when the plugin is activated. If an error is returned, the plugin will be deactivated.
func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API, p.Driver)
	p.registry = backend.NewRegistry()

	// Check license
	if !pluginapi.IsEnterpriseLicensedOrDevelopment(p.API.GetConfig(), p.API.GetLicense()) {
		err := errors.New("this plugin requires an Enterprise license")
		p.API.LogError("Cannot initialize plugin", "err", err)
		return err
	}

	// Get configuration
	config := p.getConfiguration()

	// Ensure bot user exists
	botUsername := config.BotUsername
	if botUsername == "" {
		botUsername = "dataminr-alerts"
	}
	botDisplayName := config.BotDisplayName
	if botDisplayName == "" {
		botDisplayName = "Dataminr Alerts"
	}

	botID, err := p.API.EnsureBotUser(&model.Bot{
		Username:    botUsername,
		DisplayName: botDisplayName,
		Description: "Bot for posting Dataminr alerts to Mattermost channels",
	})
	if err != nil {
		return errors.Wrap(err, "failed to ensure bot user")
	}

	p.API.LogInfo("Bot user initialized", "botID", botID, "username", botUsername)

	// Create poster with bot ID
	p.poster = poster.New(p.API, botID)

	// Initialize backends from current configuration
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

	// Create backend instance using factory, passing the disable callback
	b, err := backend.Create(config, p.client, p.API, p.poster, p.disableBackend)
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

// disableBackend sets a backend's enabled flag to false and persists the configuration change.
// This is called when a backend reaches MaxConsecutiveFailures and needs to be auto-disabled.
// The configuration change will trigger OnConfigurationChange, which will stop the backend.
func (p *Plugin) disableBackend(backendID string) error {
	p.configurationLock.Lock()
	defer p.configurationLock.Unlock()

	if p.configuration == nil {
		return errors.New("configuration is nil")
	}

	// Find the backend in the configuration
	found := false
	for i := range p.configuration.Backends {
		if p.configuration.Backends[i].ID == backendID {
			// Set enabled to false
			p.configuration.Backends[i].Enabled = false
			found = true
			p.API.LogInfo("Disabling backend in configuration", "id", backendID, "name", p.configuration.Backends[i].Name)
			break
		}
	}

	if !found {
		return errors.Errorf("backend with ID %s not found in configuration", backendID)
	}

	// Marshal the configuration to map[string]any for SavePluginConfig
	marshalBytes, err := json.Marshal(p.configuration)
	if err != nil {
		return errors.Wrap(err, "failed to marshal configuration")
	}

	configMap := make(map[string]any)
	if err := json.Unmarshal(marshalBytes, &configMap); err != nil {
		return errors.Wrap(err, "failed to unmarshal configuration to map")
	}

	// Persist the configuration change
	if err := p.client.Configuration.SavePluginConfig(configMap); err != nil {
		return errors.Wrap(err, "failed to save plugin configuration")
	}

	p.API.LogInfo("Backend disabled and configuration persisted", "id", backendID)
	return nil
}

// See https://developers.mattermost.com/extend/plugins/server/reference/
