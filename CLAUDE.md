# Mattermost Dataminr Plugin - Technical Specification

**Version:** 1.0
**Date:** 2025-10-29
**Status:** Initial Specification

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Configuration System](#3-configuration-system)
4. [Backend System](#4-backend-system)
5. [Dataminr Backend Implementation](#5-dataminr-backend-implementation)
6. [Alert Formatting](#6-alert-formatting)
7. [Error Handling](#7-error-handling)

---

## 1. Project Overview

### 1.1 Purpose

The Mattermost Dataminr Plugin is a real-time alerting system that integrates Dataminr First Alert API with Mattermost. It continuously polls configured Dataminr backends for new events and posts them to designated Mattermost channels, enabling teams to receive critical alerts directly in their communication platform. The plugin architecture is designed to be extensible for future backend integrations.

### 1.2 Initial Scope

**Version 1.0 Features:**
- Support for multiple Dataminr backend configurations
- Dataminr First Alert API integration
- System Console configuration interface
- Per-backend authentication and polling
- Rich alert formatting in Mattermost with color coding and embedded media
- Individual backend error handling and isolation
- 30-second polling interval per backend

### 1.3 Key Design Principles

1. **Isolation**: Each Dataminr backend operates independently with its own authentication, polling state, and error handling
2. **Resilience**: Backend failures don't affect other backends or the plugin stability
3. **Extensibility**: Architecture designed to support future backend types beyond Dataminr
4. **Rich UX**: Alerts are formatted with color coding, embedded media, and structured data matching Dataminr's alert types
5. **Administrative Control**: All configuration via System Console with validation

---

## 2. Architecture

### 2.1 Component Descriptions

#### Configuration Manager
- Parses the `backends` JSON configuration from plugin settings
- Validates backend configurations (URLs, credentials, channel IDs)
- Triggers backend creation/destruction on configuration changes
- Provides configuration validation feedback to admins

#### Backend Manager
- Maintains a registry of active backend instances
- Creates backend instances from configuration
- Starts/stops polling jobs for each backend
- Provides health status for all backends

#### Backend Instance
Each backend instance is self-contained and manages:
- **Authentication Manager**: Handles token lifecycle (obtain, refresh, validate)
- **API Client**: HTTP client for backend-specific API calls
- **Poller**: Cluster-aware scheduled job that runs every 30 seconds (uses Mattermost's cluster plugin scheduled job system to ensure only one instance polls in multi-server deployments)
- **State Storage**: Per-backend KV store keys (auth token, cursor, error count)
- **Alert Processor**: Normalizes and deduplicates alerts
- **Error Handler**: Tracks failures, implements retry logic, isolates errors

#### Alert Formatter
- Backend-agnostic formatting layer
- Converts normalized alerts to Mattermost message attachments
- Applies rich formatting (colors, embedded images, fields)
- Supports backend-specific customization

#### Mattermost Poster
- Posts formatted alerts to configured channels
- Handles posting errors (channel not found, permissions)
- Validates bot access to channels

---

## 3. Configuration System

### 3.1 Plugin Settings Schema

The plugin configuration in `plugin.json` will have the following settings:

```json
{
  "settings_schema": {
    "header": "Configure backends to monitor for alerts. Each backend polls for events and posts them to a designated Mattermost channel.",
    "footer": "Note: Configuration changes require a plugin reload to take effect.",
    "settings": [
      {
        "key": "Backends",
        "display_name": "Backend Configurations",
        "type": "custom",
        "help_text": "Configure alert backends to monitor. Each backend independently polls its API and posts alerts to a designated channel."
      }
    ]
  }
}
```

**Note:** Plugin enable/disable is handled by Mattermost's standard plugin management interface and does not require a custom setting.

**Custom Webapp Component for Backends:**

The `Backends` custom type requires a React component in the webapp that provides:

- **Backend List View**: Display all configured backends with status indicators
- **Add/Edit Backend Form**: Fields for name, type, URL, credentials, channel, poll interval
- **Status Display**: Show backend health with visual indicators:
  - ✅ Active and polling successfully (consecutiveFailures = 0)
  - ⚠️ Warning (1-4 consecutive failures, still enabled)
  - ❌ Disabled (consecutiveFailures >= MaxConsecutiveFailures)
  - ❓ Unknown (no status data available yet)
  - Error message display for failed backends (from lastError field)
  - Last poll time and last success time
- **Per-Backend Configuration Fields**:
  - Name (unique identifier, text input)
  - Type (dropdown: "dataminr", extensible for future types)
  - Enabled toggle (per-backend enable/disable)
  - API URL (text input with HTTPS validation)
  - API credentials (apiId and apiKey text inputs, displayed as password fields)
  - Target Mattermost channel (channel picker component)
  - Poll interval in seconds (number input, min: 10, default: 30)
- **Actions**: Add, edit, delete, enable/disable toggle
- **Real-time Status**: Periodically fetch backend status from `/api/v1/backends/status` endpoint (every 30 seconds) and merge with configuration data for display
- **Configuration Persistence**: Uses Mattermost's standard `updateConfig()` Redux action to save backend array to plugin settings

**Component Location:**
- `webapp/src/components/admin_console/backend_settings.tsx`
- Register in `webapp/src/index.tsx` via `registerAdminConsoleCustomSetting()`

**Status Merging Logic:**
- The component displays all backends from the configuration (received via props from plugin settings)
- A separate API call polls the `/api/v1/backends/status` endpoint every 30 seconds
- Status data is merged with configuration data by matching backend IDs
- This fills in the status indicators (✅ ⚠️ ❌ ❓), error messages (from lastError), and timestamps
- Backends in configuration without status data show as ❓ Unknown state
- When a backend is disabled due to failures, administrators can re-enable it by toggling the "enabled" field and saving the configuration, which will trigger `OnConfigurationChange` and restart the backend with cleared error state

### 3.2 Backend Configuration Schema

The `Backends` field contains a JSON array of backend objects. Each backend has:

```json
{
  "id": "string",                  // Unique stable identifier (UUID v4, auto-generated, immutable)
  "name": "string",                // Display name (e.g., "Production Alerts", user can change)
  "type": "string",                // Backend type: "dataminr" (extensible to others)
  "enabled": "boolean",            // Whether this backend is active (default: true)
  "url": "string",                 // Base API URL
  "apiId": "string",               // API user ID (backend-specific)
  "apiKey": "string",              // API key/password (backend-specific)
  "channelId": "string",           // Mattermost channel ID to post alerts
  "pollIntervalSeconds": "number"  // How often to poll this backend (min: 10, recommended: 30)
}
```

**Backend Identification:**
- Each backend is assigned a **unique ID** (UUID v4) when created by the admin console component
- The `id` field is **immutable** and **must be unique** across all backends
- The `id` field is used for all internal operations:
  - KV store keys (e.g., `backend_{id}_cursor`, `backend_{id}_auth`)
  - Cluster scheduled job IDs
  - Backend registry lookups
- The `name` field is **mutable** but **must also be unique** across all backends to avoid admin confusion
- When a backend name changes, no KV store migration is needed (keys remain stable using the immutable `id`)
- The webapp component must:
  - Generate a UUID v4 when creating a new backend
  - Validate that the name is unique before saving
  - Preserve the `id` field when editing a backend configuration
- Configuration validation must ensure:
  - No duplicate `id` values exist
  - No duplicate `name` values exist

**Example Configuration:**

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Production Dataminr",
    "type": "dataminr",
    "enabled": true,
    "url": "https://firstalert-api.dataminr.com",
    "apiId": "your_api_id",
    "apiKey": "your_api_key",
    "channelId": "your_channel_id",
    "pollIntervalSeconds": 30
  }
]
```

### 3.3 Configuration Validation

On configuration change (`OnConfigurationChange` hook), validate:

1. **JSON Parsing**: Backends field is valid JSON array
2. **Required Fields**: Each backend has id, name, type, url, apiId, apiKey, channelId, pollIntervalSeconds
3. **UUID Format**: Each backend `id` is a valid UUID v4
4. **Duplicate IDs**: No two backends have the same `id`
5. **Duplicate Names**: No two backends have the same `name`
6. **Type Support**: Backend type is "dataminr" (reject unknown types)
7. **URL Format**: URLs are valid and use HTTPS
8. **Poll Interval Minimum**: pollIntervalSeconds is at least 10
9. **Channel Access**: Plugin bot has permission to post in specified channels

**Validation Errors**: If validation fails, log detailed error and return error from `OnConfigurationChange`. Plugin will continue with previous valid configuration.

---

## 4. Backend System

### 4.1 Constants

The following constants are defined at the application level:

```go
const (
	// MaxConsecutiveFailures is the number of consecutive polling failures
	// before a backend is automatically disabled. This prevents runaway
	// error conditions and excessive API calls to failing backends.
	MaxConsecutiveFailures = 5

	// MinPollIntervalSeconds is the minimum allowed poll interval
	MinPollIntervalSeconds = 10

	// DefaultPollIntervalSeconds is the recommended default
	DefaultPollIntervalSeconds = 30

	// AuthTokenRefreshBuffer is how long before token expiry to refresh
	AuthTokenRefreshBuffer = 5 * time.Minute
)
```

When a backend reaches `MaxConsecutiveFailures`, it is automatically disabled and its status is updated in the KV store. The custom webapp component will display this failure state with the error message to administrators.

### 4.2 REST API Endpoints

The plugin exposes a single REST API endpoint for backend status:

**GET /plugins/com.mattermost.dataminr/api/v1/backends/status**
- Returns status for all configured backends
- Response: Map of backend IDs (UUIDs) to status objects containing:
  - `enabled`: boolean (whether backend is active)
  - `lastPollTime`: timestamp of last poll attempt
  - `lastSuccessTime`: timestamp of last successful poll
  - `consecutiveFailures`: number of consecutive failures
  - `isAuthenticated`: boolean (auth token validity)
  - `lastError`: string (error message from most recent failure, empty if no error)
- Map keys are backend IDs, not names (to maintain stability when names change)
- Used by admin console component to display real-time backend health
- Requires system admin permissions

**Example Response:**
```json
{
  "550e8400-e29b-41d4-a716-446655440000": {
    "enabled": true,
    "lastPollTime": "2025-10-29T14:30:00Z",
    "lastSuccessTime": "2025-10-29T14:30:00Z",
    "consecutiveFailures": 0,
    "isAuthenticated": true,
    "lastError": ""
  },
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8": {
    "enabled": false,
    "lastPollTime": "2025-10-29T14:25:00Z",
    "lastSuccessTime": "2025-10-29T14:00:00Z",
    "consecutiveFailures": 5,
    "isAuthenticated": false,
    "lastError": "authentication failed: invalid credentials"
  }
}
```

**Note:** Backend configuration (create, update, delete) is handled through Mattermost's standard plugin configuration API. The custom webapp component uses the standard `updateConfig` action to save backend configurations.

### 4.3 Backend Interface

All backend types must implement a common interface defined in `server/backend/interface.go`:

**Key Interface Methods:**
- `Initialize(config Config)` - Prepares the backend with its configuration
- `Start(ctx context.Context)` - Begins the polling cycle
- `Stop()` - Gracefully stops the backend
- `GetID()` - Returns the backend's unique identifier (UUID)
- `GetName()` - Returns the backend's display name
- `GetType()` - Returns the backend type (e.g., "dataminr")
- `GetStatus()` - Returns the current health status

**Configuration Structure:**
- ID (UUID v4), Name, Type, Enabled, URL
- APIID, APIKey, ChannelID
- PollIntervalSeconds

**Status Structure:**
- Enabled, LastPollTime, LastSuccessTime
- ConsecutiveFailures, IsAuthenticated, LastError

**Alert Structure:**
- BackendName, AlertID, AlertType, Headline
- EventTime, AlertURL, PublicLink, PublicText
- LocationData (Address, Latitude, Longitude, Confidence)
- Metadata, RawJSON

### 4.4 Backend Registry

A central registry (implemented in `server/backend/registry.go`) manages all backend instances:

**Responsibilities:**
- Maintains a map of backend ID (UUID) to Backend instance
- Thread-safe operations with mutex protection
- Registers new backends and prevents duplicate IDs
- Unregisters backends (stops backend before removal)
- Retrieves backends by ID
- Lists all registered backends
- Stops all backends on shutdown

### 4.5 Backend Lifecycle

**On Plugin Activation:**
1. Parse `Backends` configuration
2. For each backend config:
   - Create backend instance (factory pattern based on type)
   - Initialize with config
   - Register in registry
   - Start polling

**On Configuration Change:**
1. Parse new `Backends` configuration
2. Compare with current backends
3. For removed backends:
   - Stop and unregister
4. For new backends:
   - Create, initialize, register, start
5. For modified backends:
   - Stop old instance
   - Create new instance
   - Start new instance

**On Plugin Deactivation:**
1. Stop all backends gracefully
2. Clear registry

---

## 5. Dataminr Backend Implementation

### 5.1 Package Structure

```
server/backend/dataminr/
├── dataminr.go       # Main backend implementation
├── auth.go           # Authentication manager
├── client.go         # API client
├── poller.go         # Polling job
├── processor.go      # Alert normalization
├── state.go          # KV state storage
└── types.go          # Dataminr-specific types
```

### 5.2 Key Implementation Requirements

**Authentication (`auth.go`):**
- **CRITICAL**: Must use `application/x-www-form-urlencoded`, NOT JSON
- Endpoint: `POST /auth/1/userAuthorization`
- Parameters: `grant_type=api_key&scope=first_alert_api&api_user_id=X&api_password=Y`
- Token lifetime: 1 hour
- Authorization header: `Dmauth {token}` (NOT "Bearer")
- Proactively refresh 5 minutes before expiry

**API Client (`client.go`):**
- Endpoint: `GET /alerts/1/alerts?alertversion=19&from={cursor}`
- Alert version is hardcoded to 19 (changing this requires updating parsing logic)
- Use `Dmauth` authorization header
- Handle errors: 401 (re-auth), 429 (rate limit), 500 (retry)
- Parse response with cursor for pagination

**Poller (`poller.go`):**
- **CRITICAL**: Must use Mattermost's cluster plugin scheduled job system (plugin API's `PluginAPI.Jobs.CreateJob()` and job callback registration)
- This ensures only ONE server instance polls each backend in a multi-server cluster deployment
- 30-second polling cycle
- Poll immediately on start (via initial job scheduling)
- Load cursor from state → poll API → process alerts → save cursor
- Graceful shutdown by canceling scheduled jobs
- Each backend registers its own unique job with a backend-specific job ID

**Alert Processor (`processor.go`):**
- Normalize RawAlert to backend.Alert
- Parse location data from `estimatedEventLocation` array
- Convert event time from milliseconds to time.Time
- Store metadata (topics, alert lists, linked alerts, sub-headline, media)
- In-memory deduplication cache (24-hour cleanup)

**State Storage (`state.go`):**
- KV store keys: `backend_{id}_cursor`, `backend_{id}_last_poll`, `backend_{id}_failures`, `backend_{id}_auth`
  - Uses backend UUID `id` field for stable key naming
  - Keys remain unchanged when backend `name` is updated
- Cursor tracking for pagination
- Auth token persistence
- Error count tracking

---

## 6. Alert Formatting

### 6.1 Formatting Requirements

**Color Coding by Alert Type:**
- **Flash**: Red (#FF0000) 🔴 - Breaking news, highest priority
- **Urgent**: Orange (#FF9900) 🟠 - High priority
- **Alert**: Yellow (#FFFF00) 🟡 - Normal priority
- Unknown: Gray (#808080) ⚪

**Mattermost Attachment Structure:**
- Pretext: Emoji + Alert Type (uppercase)
- Title: Alert headline (linked to AlertURL if available)
- Color: Alert type color
- Fields (displayed in order):
  - Alert Type + Event Time (side by side)
  - Additional Context (sub-headline if available)
  - Location (address, coordinates, confidence radius)
  - Topics (bulleted list, short field)
  - Alert Lists (bulleted list, short field)
  - Related Alerts count (if linked alerts exist)
  - Public Source link
  - Original Source Text (truncate at 500 chars)
  - Translated Text (truncate at 500 chars)
  - Additional Media (links to media 2-4)
- ImageURL: First media item embedded
- Footer: Backend name + Alert ID

---

## 7. Error Handling

### 7.1 Error Isolation

- Each backend manages errors independently with `ErrorHandler`
- Track consecutive failures, last error, and error time
- Reset counter on successful poll
- Disable backend when failures reach max threshold

### 7.2 Error Types and Responses

| Error Type | HTTP Code | Action | Wait Time | Notes |
|------------|-----------|--------|-----------|-------|
| Authentication Failed | 401 | Force re-authentication | Immediate | Token expired |
| Rate Limit | 429 | Back off | 60 seconds | Resume after backoff |
| Network Error | - | Retry with backoff | 30s, 60s, 120s | Exponential backoff |
| Timeout | - | Retry | 30 seconds | May indicate API issues |
| Bad Request | 400 | Log and skip | Next cycle | Configuration issue |
| Server Error | 500 | Retry | 60 seconds | Backend API issue |

### 7.3 Admin Notifications

When a backend is disabled due to consecutive failures, post notification to configured admin channel:
- Backend name and last error
- Action required: Check config, verify credentials, check API status, reload plugin
- Backend will not resume until plugin reload

---

## Appendix A: Configuration Examples

### A.1 Single Backend Configuration

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Production Alerts",
    "type": "dataminr",
    "enabled": true,
    "url": "https://firstalert-api.dataminr.com",
    "apiId": "your_api_id",
    "apiKey": "your_api_key",
    "channelId": "abc123channelid",
    "pollIntervalSeconds": 30
  }
]
```

### A.2 Multiple Backend Configuration

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Dataminr Production",
    "type": "dataminr",
    "enabled": true,
    "url": "https://firstalert-api.dataminr.com",
    "apiId": "prod_user",
    "apiKey": "prod_key",
    "channelId": "prod_channel_id",
    "pollIntervalSeconds": 30
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "name": "Dataminr Staging",
    "type": "dataminr",
    "enabled": true,
    "url": "https://staging-api.dataminr.com",
    "apiId": "staging_user",
    "apiKey": "staging_key",
    "channelId": "staging_channel_id",
    "pollIntervalSeconds": 60
  }
]
```

---

## Appendix B: Dataminr API Quick Reference

**Authentication:**
```
POST /auth/1/userAuthorization
Content-Type: application/x-www-form-urlencoded

grant_type=api_key&scope=first_alert_api&api_user_id=X&api_password=Y

Response: {"authorizationToken": "...", "expirationTime": 123...}
```

**Polling:**
```
GET /alerts/1/alerts?alertversion=19&from={cursor}
Authorization: Dmauth {token}

Response: {"alerts": [...], "to": "cursor"}
```

**Key Details:**
- Token lifetime: 1 hour
- Authorization header: `Dmauth {token}` (NOT Bearer)
- Poll interval: 30 seconds recommended
- Rate limit: 180 requests / 10 minutes
- Cursor-based pagination required

**Alert Types:**
- **Flash** - Red (#FF0000) - Breaking news
- **Urgent** - Orange (#FF9900) - High priority
- **Alert** - Yellow (#FFFF00) - Normal

---

---

**End of Specification**
