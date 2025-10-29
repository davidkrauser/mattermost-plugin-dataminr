package backend

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateBackendsJSON_Valid(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int // number of backends expected
	}{
		{
			name:     "empty configuration",
			input:    "",
			expected: 0,
		},
		{
			name:     "empty array",
			input:    "[]",
			expected: 0,
		},
		{
			name: "single valid backend",
			input: `[{
				"id": "550e8400-e29b-41d4-a716-446655440000",
				"name": "Test Backend",
				"type": "dataminr",
				"enabled": true,
				"url": "https://api.example.com",
				"apiId": "test-id",
				"apiKey": "test-key",
				"channelId": "channel123",
				"pollIntervalSeconds": 30
			}]`,
			expected: 1,
		},
		{
			name: "multiple valid backends",
			input: `[
				{
					"id": "550e8400-e29b-41d4-a716-446655440000",
					"name": "Backend One",
					"type": "dataminr",
					"enabled": true,
					"url": "https://api1.example.com",
					"apiId": "id1",
					"apiKey": "key1",
					"channelId": "channel1",
					"pollIntervalSeconds": 30
				},
				{
					"id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
					"name": "Backend Two",
					"type": "dataminr",
					"enabled": false,
					"url": "https://api2.example.com",
					"apiId": "id2",
					"apiKey": "key2",
					"channelId": "channel2",
					"pollIntervalSeconds": 60
				}
			]`,
			expected: 2,
		},
		{
			name: "minimum poll interval",
			input: `[{
				"id": "550e8400-e29b-41d4-a716-446655440000",
				"name": "Test Backend",
				"type": "dataminr",
				"enabled": true,
				"url": "https://api.example.com",
				"apiId": "test-id",
				"apiKey": "test-key",
				"channelId": "channel123",
				"pollIntervalSeconds": 10
			}]`,
			expected: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configs, err := ValidateBackendsJSON(tt.input)
			require.NoError(t, err)
			assert.Len(t, configs, tt.expected)
		})
	}
}

func TestValidateBackendsJSON_InvalidJSON(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "malformed json",
			input: `[{invalid json}]`,
		},
		{
			name:  "not an array",
			input: `{"id": "test"}`,
		},
		{
			name:  "unclosed array",
			input: `[{"id": "test"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateBackendsJSON(tt.input)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "invalid JSON format")
		})
	}
}

func TestValidateBackendsJSON_MissingRequiredFields(t *testing.T) {
	baseConfig := Config{
		ID:                  "550e8400-e29b-41d4-a716-446655440000",
		Name:                "Test Backend",
		Type:                "dataminr",
		Enabled:             true,
		URL:                 "https://api.example.com",
		APIId:               "test-id",
		APIKey:              "test-key",
		ChannelID:           "channel123",
		PollIntervalSeconds: 30,
	}

	tests := []struct {
		name      string
		omitField string
		errorMsg  string
	}{
		{"missing id", "id", "missing required field 'id'"},
		{"missing name", "name", "missing required field 'name'"},
		{"missing type", "type", "missing required field 'type'"},
		{"missing url", "url", "missing required field 'url'"},
		{"missing apiId", "apiId", "missing required field 'apiId'"},
		{"missing apiKey", "apiKey", "missing required field 'apiKey'"},
		{"missing channelId", "channelId", "missing required field 'channelId'"},
		{"missing pollIntervalSeconds", "pollIntervalSeconds", "missing required field 'pollIntervalSeconds'"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := baseConfig
			switch tt.omitField {
			case "id":
				config.ID = ""
			case "name":
				config.Name = ""
			case "type":
				config.Type = ""
			case "url":
				config.URL = ""
			case "apiId":
				config.APIId = ""
			case "apiKey":
				config.APIKey = ""
			case "channelId":
				config.ChannelID = ""
			case "pollIntervalSeconds":
				config.PollIntervalSeconds = 0
			}

			configJSON, _ := json.Marshal([]Config{config})
			_, err := ValidateBackendsJSON(string(configJSON))
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.errorMsg)
		})
	}
}

func TestValidateBackendsJSON_InvalidUUID(t *testing.T) {
	tests := []struct {
		name  string
		id    string
		valid bool
	}{
		{
			name:  "valid uuid v4",
			id:    "550e8400-e29b-41d4-a716-446655440000",
			valid: true,
		},
		{
			name:  "uuid v1 rejected",
			id:    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			valid: false,
		},
		{
			name:  "invalid format",
			id:    "not-a-uuid",
			valid: false,
		},
		{
			name:  "nil uuid",
			id:    "00000000-0000-0000-0000-000000000000",
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := Config{
				ID:                  tt.id,
				Name:                "Test Backend",
				Type:                "dataminr",
				Enabled:             true,
				URL:                 "https://api.example.com",
				APIId:               "test-id",
				APIKey:              "test-key",
				ChannelID:           "channel123",
				PollIntervalSeconds: 30,
			}

			configJSON, _ := json.Marshal([]Config{config})
			_, err := ValidateBackendsJSON(string(configJSON))

			if tt.valid {
				assert.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.Contains(t, err.Error(), "UUID")
			}
		})
	}
}

func TestValidateBackendsJSON_DuplicateIDs(t *testing.T) {
	duplicateID := uuid.New().String()
	input := `[
		{
			"id": "` + duplicateID + `",
			"name": "Backend One",
			"type": "dataminr",
			"enabled": true,
			"url": "https://api1.example.com",
			"apiId": "id1",
			"apiKey": "key1",
			"channelId": "channel1",
			"pollIntervalSeconds": 30
		},
		{
			"id": "` + duplicateID + `",
			"name": "Backend Two",
			"type": "dataminr",
			"enabled": true,
			"url": "https://api2.example.com",
			"apiId": "id2",
			"apiKey": "key2",
			"channelId": "channel2",
			"pollIntervalSeconds": 30
		}
	]`

	_, err := ValidateBackendsJSON(input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate backend ID")
}

func TestValidateBackendsJSON_DuplicateNames(t *testing.T) {
	input := `[
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"name": "Same Name",
			"type": "dataminr",
			"enabled": true,
			"url": "https://api1.example.com",
			"apiId": "id1",
			"apiKey": "key1",
			"channelId": "channel1",
			"pollIntervalSeconds": 30
		},
		{
			"id": "6ba7b810-9dad-41d4-80b4-00c04fd430c8",
			"name": "Same Name",
			"type": "dataminr",
			"enabled": true,
			"url": "https://api2.example.com",
			"apiId": "id2",
			"apiKey": "key2",
			"channelId": "channel2",
			"pollIntervalSeconds": 30
		}
	]`

	_, err := ValidateBackendsJSON(input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate backend name")
}

func TestValidateBackendsJSON_UnsupportedType(t *testing.T) {
	config := Config{
		ID:                  uuid.New().String(),
		Name:                "Test Backend",
		Type:                "unsupported-type",
		Enabled:             true,
		URL:                 "https://api.example.com",
		APIId:               "test-id",
		APIKey:              "test-key",
		ChannelID:           "channel123",
		PollIntervalSeconds: 30,
	}

	configJSON, _ := json.Marshal([]Config{config})
	_, err := ValidateBackendsJSON(string(configJSON))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported type")
	assert.Contains(t, err.Error(), "dataminr")
}

func TestValidateBackendsJSON_InvalidURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		errorMsg string
	}{
		{
			name:     "http instead of https",
			url:      "http://api.example.com",
			errorMsg: "must use HTTPS",
		},
		{
			name:     "no scheme",
			url:      "api.example.com",
			errorMsg: "must use HTTPS",
		},
		{
			name:     "invalid format",
			url:      "://invalid",
			errorMsg: "invalid url format",
		},
		{
			name:     "no host",
			url:      "https://",
			errorMsg: "must include a hostname",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := Config{
				ID:                  uuid.New().String(),
				Name:                "Test Backend",
				Type:                "dataminr",
				Enabled:             true,
				URL:                 tt.url,
				APIId:               "test-id",
				APIKey:              "test-key",
				ChannelID:           "channel123",
				PollIntervalSeconds: 30,
			}

			configJSON, _ := json.Marshal([]Config{config})
			_, err := ValidateBackendsJSON(string(configJSON))
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.errorMsg)
		})
	}
}

func TestValidateBackendsJSON_PollIntervalTooLow(t *testing.T) {
	config := Config{
		ID:                  uuid.New().String(),
		Name:                "Test Backend",
		Type:                "dataminr",
		Enabled:             true,
		URL:                 "https://api.example.com",
		APIId:               "test-id",
		APIKey:              "test-key",
		ChannelID:           "channel123",
		PollIntervalSeconds: 5, // Below minimum of 10
	}

	configJSON, _ := json.Marshal([]Config{config})
	_, err := ValidateBackendsJSON(string(configJSON))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "must be at least 10 seconds")
}

func TestDiffBackendConfigs_NoChanges(t *testing.T) {
	configs := []Config{
		{
			ID:                  uuid.New().String(),
			Name:                "Backend One",
			Type:                "dataminr",
			Enabled:             true,
			URL:                 "https://api.example.com",
			APIId:               "id1",
			APIKey:              "key1",
			ChannelID:           "channel1",
			PollIntervalSeconds: 30,
		},
	}

	toAdd, toUpdate, toRemove := DiffBackendConfigs(configs, configs)
	assert.Empty(t, toAdd)
	assert.Empty(t, toUpdate)
	assert.Empty(t, toRemove)
}

func TestDiffBackendConfigs_Add(t *testing.T) {
	id1 := uuid.New().String()
	id2 := uuid.New().String()

	oldConfigs := []Config{
		{ID: id1, Name: "Backend One", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
	}

	newConfigs := []Config{
		{ID: id1, Name: "Backend One", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
		{ID: id2, Name: "Backend Two", Type: "dataminr", Enabled: true, URL: "https://api2.example.com", APIId: "id2", APIKey: "key2", ChannelID: "ch2", PollIntervalSeconds: 30},
	}

	toAdd, toUpdate, toRemove := DiffBackendConfigs(oldConfigs, newConfigs)
	assert.Equal(t, []string{id2}, toAdd)
	assert.Empty(t, toUpdate)
	assert.Empty(t, toRemove)
}

func TestDiffBackendConfigs_Remove(t *testing.T) {
	id1 := uuid.New().String()
	id2 := uuid.New().String()

	oldConfigs := []Config{
		{ID: id1, Name: "Backend One", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
		{ID: id2, Name: "Backend Two", Type: "dataminr", Enabled: true, URL: "https://api2.example.com", APIId: "id2", APIKey: "key2", ChannelID: "ch2", PollIntervalSeconds: 30},
	}

	newConfigs := []Config{
		{ID: id1, Name: "Backend One", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
	}

	toAdd, toUpdate, toRemove := DiffBackendConfigs(oldConfigs, newConfigs)
	assert.Empty(t, toAdd)
	assert.Empty(t, toUpdate)
	assert.Equal(t, []string{id2}, toRemove)
}

func TestDiffBackendConfigs_Update(t *testing.T) {
	id := uuid.New().String()

	oldConfigs := []Config{
		{ID: id, Name: "Backend One", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
	}

	newConfigs := []Config{
		{ID: id, Name: "Backend One Updated", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
	}

	toAdd, toUpdate, toRemove := DiffBackendConfigs(oldConfigs, newConfigs)
	assert.Empty(t, toAdd)
	assert.Equal(t, []string{id}, toUpdate)
	assert.Empty(t, toRemove)
}

func TestDiffBackendConfigs_UpdateMultipleFields(t *testing.T) {
	id := uuid.New().String()

	oldConfig := Config{
		ID:                  id,
		Name:                "Backend",
		Type:                "dataminr",
		Enabled:             true,
		URL:                 "https://api.example.com",
		APIId:               "id1",
		APIKey:              "key1",
		ChannelID:           "ch1",
		PollIntervalSeconds: 30,
	}

	tests := []struct {
		name   string
		modify func(*Config)
	}{
		{"name change", func(c *Config) { c.Name = "New Name" }},
		{"enabled change", func(c *Config) { c.Enabled = false }},
		{"url change", func(c *Config) { c.URL = "https://new-api.example.com" }},
		{"apiId change", func(c *Config) { c.APIId = "new-id" }},
		{"apiKey change", func(c *Config) { c.APIKey = "new-key" }},
		{"channelId change", func(c *Config) { c.ChannelID = "new-channel" }},
		{"pollInterval change", func(c *Config) { c.PollIntervalSeconds = 60 }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newConfig := oldConfig
			tt.modify(&newConfig)

			toAdd, toUpdate, toRemove := DiffBackendConfigs([]Config{oldConfig}, []Config{newConfig})
			assert.Empty(t, toAdd)
			assert.Equal(t, []string{id}, toUpdate)
			assert.Empty(t, toRemove)
		})
	}
}

func TestDiffBackendConfigs_Mixed(t *testing.T) {
	id1 := uuid.New().String()
	id2 := uuid.New().String()
	id3 := uuid.New().String()

	oldConfigs := []Config{
		{ID: id1, Name: "Backend One", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
		{ID: id2, Name: "Backend Two", Type: "dataminr", Enabled: true, URL: "https://api2.example.com", APIId: "id2", APIKey: "key2", ChannelID: "ch2", PollIntervalSeconds: 30},
	}

	newConfigs := []Config{
		{ID: id1, Name: "Backend One Updated", Type: "dataminr", Enabled: true, URL: "https://api1.example.com", APIId: "id1", APIKey: "key1", ChannelID: "ch1", PollIntervalSeconds: 30},
		{ID: id3, Name: "Backend Three", Type: "dataminr", Enabled: true, URL: "https://api3.example.com", APIId: "id3", APIKey: "key3", ChannelID: "ch3", PollIntervalSeconds: 30},
	}

	toAdd, toUpdate, toRemove := DiffBackendConfigs(oldConfigs, newConfigs)
	assert.Equal(t, []string{id3}, toAdd)
	assert.Equal(t, []string{id1}, toUpdate)
	assert.Equal(t, []string{id2}, toRemove)
}
