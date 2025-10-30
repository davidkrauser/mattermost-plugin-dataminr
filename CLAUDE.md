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
- **Alert Processor**: Orchestrates normalization, deduplication, and alert handling
  - Uses pure adapter functions for normalization
  - Maintains in-memory deduplication cache with automatic cleanup
  - Invokes alert handler callback for posting to Mattermost
- **Error Tracking**: Tracks failures in state storage, implements retry logic at poll cycle intervals, isolates errors per backend

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

All backend types must implement a common interface. Key responsibilities:

- Initialize with configuration
- Start/stop polling lifecycle
- Provide unique identifier, name, and type
- Return current health status

The interface works with three main structures:
- **Config**: ID, Name, Type, Enabled, URL, credentials, ChannelID, PollIntervalSeconds
- **Status**: Enabled, poll times, failure count, authentication state, last error
- **Alert**: Normalized alert data with backend name, alert metadata (topics, lists, linked alerts), location, source text, translated text, and media URLs

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
├── dataminr.go       # Main backend implementation (dataminr.Backend type)
├── auth.go           # Authentication manager
├── client.go         # API client
├── poller.go         # Polling job
├── adapter.go        # Alert normalization (pure functions)
├── deduplicator.go   # Deduplication cache
├── processor.go      # Alert processing orchestrator
├── state.go          # KV state storage
├── scheduler.go      # Job scheduler interface
└── types.go          # Dataminr-specific types
```

**Backend Core Files:**
```
server/backend/
├── constants.go      # Application constants (MaxConsecutiveFailures, etc.)
├── interface.go      # Backend interface definition
├── backend.go        # Config and Status structs
├── alert.go          # Normalized Alert and Location structs
├── registry.go       # Thread-safe backend registry
└── validator.go      # Configuration validation
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

**Alert Processing (`adapter.go`, `deduplicator.go`, `processor.go`):**
- **Adapter** (`adapter.go`): Pure functions to normalize Dataminr alerts to backend.Alert
  - Extracts metadata (topics, alert lists, linked alerts, sub-headline, media)
  - Converts miles to meters for location confidence radius
  - Formats sub-headlines with markdown
- **Deduplicator** (`deduplicator.go`): In-memory deduplication cache
  - Tracks seen alert IDs with timestamps
  - Cleanup runs every 10 minutes, removes entries older than 1 hour
  - Thread-safe with RWMutex for concurrent access
- **Processor** (`processor.go`): Orchestrates normalization, deduplication, and alert handling
  - Processes alert batches from API client
  - Skips duplicates and continues on handler errors
  - Calls alert handler callback for each new alert

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

- Each backend manages errors independently via state storage
- Track consecutive failures, last error, and error time in KV store
- Reset counter on successful poll
- Disable backend when failures reach `MaxConsecutiveFailures` (5) threshold

### 7.2 Error Types and Responses

| Error Type | HTTP Code | Action | Wait Time | Notes |
|------------|-----------|--------|-----------|-------|
| Authentication Failed | 401 | Force re-authentication | Next poll cycle | Token expired |
| Rate Limit | 429 | Log and continue | Next poll cycle | Resume at next interval |
| Network Error | - | Log and retry | Next poll cycle | Transient network issues |
| Timeout | - | Log and retry | Next poll cycle | May indicate API issues |
| Bad Request | 400 | Log and skip | Next poll cycle | Configuration issue |
| Server Error | 500 | Log and retry | Next poll cycle | Backend API issue |

**Note:** No exponential backoff is implemented. Backends will simply retry at their configured poll interval. After `MaxConsecutiveFailures` (5) consecutive failures, the backend is automatically disabled.

### 7.3 Error Logging

When a backend experiences errors:
- Log each error with details (backend ID, backend name, error type, error message)
- Track consecutive failure count
- When a backend is disabled due to `MaxConsecutiveFailures`:
  - Log critical error with backend details and last error message
  - Update backend status in KV store to reflect disabled state
  - Backend will not resume until admin re-enables it via configuration or plugin reload
- Administrators should monitor server logs for backend health

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

## Implementation Plan

### Overview

This plan breaks down the implementation into discrete phases. Each phase represents a complete, independently testable component. Within each phase, steps must be completed sequentially, with each step including:
1. Code implementation
2. Unit tests (must pass)
3. Lint checks with `make check-style` (must pass)
4. Git commit

Integration tests (using `_integration_test.go` files) are added at the end of applicable phases.

**After completing each phase:**
1. Update CLAUDE.md to mark the phase as complete
2. Simplify the phase details (remove redundant step-by-step instructions)
3. List all commit hashes from that phase
4. Commit the CLAUDE.md update as a separate commit

### Testing Strategy

- **Unit Tests**: Use `testify` for assertions, `plugintest` for mocking Mattermost Plugin API
- **HTTP Mocking**: Use `httptest` for mocking external API calls (Dataminr)
- **Integration Tests**: Tests exercising multiple components together, still using mocks, in `*_integration_test.go` files
- **UUID Generation**: Use Go's built-in `crypto/rand` with standard UUID v4 format

### Phase Status Tracking

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Complete | Project Setup & Cleanup |
| 1 | ✅ Complete | Core Backend Infrastructure |
| 2 | ✅ Complete | Configuration System |
| 3 | ✅ Complete | Dataminr Types & State |
| 4 | ✅ Complete | Dataminr Authentication |
| 5 | ✅ Complete | Dataminr API Client |
| 6 | ✅ Complete | Dataminr Alert Processor |
| 7 | ✅ Complete | Dataminr Poller |
| 8 | ✅ Complete | Dataminr Backend Main |
| 9 | ✅ Complete | Backend Manager & Plugin Integration |
| 10 | ✅ Complete | Backend Status API |
| 11 | ✅ Complete | Alert Formatter |
| 12 | ✅ Complete | Mattermost Poster |
| 13 | ✅ Complete | Webapp Foundation & Types |
| 14 | ⬜ Not Started | Backend List & Card UI |
| 15 | ⬜ Not Started | Status Integration & Indicators |
| 16 | ⬜ Not Started | Backend Form Fields |
| 17 | ⬜ Not Started | CRUD Operations |
| 18 | ⬜ Not Started | Persistence, Validation & Polish |

---

### Phase 0: Project Setup & Cleanup ✅

**Status**: Complete
**Commits**: d98db0e

Removed all starter template code and prepared clean foundation. Build system verified functional with all tests passing.

---

### Phase 1: Core Backend Infrastructure ✅

**Status**: Complete
**Commits**: 0db1f99, ec4a3c3, 63bc9fc, 20db689

Implemented backend infrastructure with:
- Core types: Config, Status, Alert, Location (separated into constants.go, backend.go, alert.go)
- Backend interface defining lifecycle and status methods
- Thread-safe Registry with RWMutex for managing backend instances
- Comprehensive unit tests covering CRUD operations, error handling, and edge cases
- All tests and lint checks passing

---

### Phase 2: Configuration System ✅

**Status**: Complete
**Commits**: eb3b1ab, 2116218, afe8a2e

Implemented comprehensive configuration system with:
- Backend validator in `server/backend/validator.go` with ValidateBackends() accepting []Config directly
- Configuration struct with Backends []backend.Config field and deep copy Clone() method
- Helper functions: findBackendConfigByID and unregisterBackend for lifecycle management
- OnConfigurationChange with:
  - Configuration validation using backend.ValidateBackends
  - Config diffing to detect add/update/remove operations
  - Backend lifecycle management (unregister for remove/update, logging for add)
  - Phase 9 TODO markers for backend factory integration
- Comprehensive unit tests covering all validation scenarios
- All tests and lint checks passing

---

### Phase 3: Dataminr Types & State ✅

**Status**: Complete
**Commits**: f5600cb, 2b10bc4

Implemented Dataminr-specific types and state storage:
- **Types** (`types.go`): Alert, AuthResponse, APIError, AlertsResponse with custom JSON unmarshaling
  - Automatic time conversion from milliseconds to time.Time (UTC)
  - Location parsing from array format [address, lat, lon, confidence, mgrs] to structured Location type
  - Type alias pattern to prevent infinite recursion in custom unmarshalers
- **State Store** (`state.go`): KV persistence layer with backend-scoped keys
  - Auth token storage with expiry tracking
  - Cursor management for API pagination
  - Failure counter with increment/reset operations
  - Last poll timestamp tracking
  - ClearAll() for backend cleanup
- Comprehensive unit tests for both types and state operations
- All tests and lint checks passing

---

### Phase 4: Dataminr Authentication ✅

**Status**: Complete
**Commits**: ab45ce4

Implemented Dataminr authentication manager with:
- AuthManager in `server/backend/dataminr/auth.go` handling token lifecycle
- Form-encoded POST authentication (critical: `application/x-www-form-urlencoded`, not JSON)
- Token caching in KV store with expiry tracking
- Proactive token refresh (5 minute buffer before expiry)
- `Dmauth` authorization header format (not Bearer)
- Comprehensive error handling for auth failures (401, 500, network errors)
- Integration with StateStore for persistence across restarts
- Full unit test coverage with httptest mocking
- All tests and lint checks passing

---

### Phase 5: Dataminr API Client ✅

**Status**: Complete
**Commits**: 59be662

Implemented Dataminr API client with:
- APIClient in `server/backend/dataminr/client.go` for polling alerts
- Cursor-based pagination with hardcoded alertversion=19
- `Dmauth` authorization header format (not Bearer)
- Comprehensive HTTP error handling (401, 429, 500, 400)
- Helper function createTestServerWithAuth for test code reuse
- Full unit test coverage with httptest mocking
- Integration tests validated against real dataminr-bridge test API
- All tests and lint checks passing

---

### Phase 6: Dataminr Alert Processor ✅

**Status**: Complete
**Commits**: 7367452

Implemented alert processing with three focused components:
- **Adapter** (`adapter.go`): Pure functions converting Dataminr alerts to normalized backend.Alert format
  - Extracts all metadata (topics, lists, linked alerts, sub-headlines)
  - Converts miles to meters for location confidence radius
  - Formats sub-headlines with markdown
- **Deduplicator** (`deduplicator.go`): In-memory cache with automatic cleanup
  - Tracks seen alert IDs with timestamps
  - Cleanup every 10 minutes, removes entries older than 1 hour
  - Thread-safe with RWMutex
- **Processor** (`processor.go`): Orchestrates normalization, deduplication, and alert handling
  - Processes alert batches, skips duplicates, continues on handler errors
  - Calls alert handler callback for each new alert
- Comprehensive unit tests covering all field combinations, deduplication, error handling, and concurrent access
- All tests and lint checks passing

---

### Phase 7: Dataminr Poller ✅

**Status**: Complete
**Commits**: e822da4

Implemented cluster-aware poller with:
- Poller component using Mattermost's cluster job system for HA deployments
- AlertFetcher interface for testing with mocks
- Poll cycle: load cursor → fetch alerts → process → save cursor → reset failures
- Error handling with automatic backend disable after MaxConsecutiveFailures (5)
- Comprehensive unit tests covering success, failures, and auto-disable threshold
- All tests and lint checks passing

---

### Phase 8: Dataminr Backend Main ✅

**Status**: Complete
**Commits**: d595fd8, d2d7341, d282fc7

Implemented main Dataminr backend with:
- `dataminr.Backend` struct implementing `backend.Backend` interface
- `dataminr.New()` constructor wiring all components together
- Placeholder `handleAlert()` callback (to be replaced in Phase 12)
- Job scheduler interface for testability (`scheduler.go`)
- Comprehensive unit tests with mocked job scheduler
- Integration tests exercising full flow including authentication, polling, and error handling
- All tests and lint checks passing

**Note on Naming**: The type is named `Backend` (not `DataminrBackend`) following Go conventions - when imported it reads as `dataminr.Backend` which is clear and idiomatic.

---

### Phase 9: Backend Manager & Plugin Integration ✅

**Status**: Complete
**Commits**: 3a492a7, feaae8a

Integrated backends into plugin lifecycle:
- Backend factory with registration system (`backend.Create()`)
- Dataminr backend auto-registers via `init()` function
- `OnActivate` initializes backends from configuration
- `OnConfigurationChange` handles backend add/update/remove operations
- `createAndStartBackend` helper for backend creation, registration, and startup
- All tests and lint checks passing

---

### Phase 10: Backend Status API ✅

**Status**: Complete
**Commits**: a7d17f4

Implemented REST API endpoint for backend status:
- GET `/api/v1/backends/status` endpoint in `server/api.go`
- Returns map of backend UUIDs to status objects (enabled, poll times, failures, auth state, last error)
- System admin permission checking in ServeHTTP
- Empty map response for no configured backends
- All lint checks passing

---

### Phase 11: Alert Formatter ✅

**Status**: Complete
**Commits**: fcfc7c3

Implemented alert formatter with rich Mattermost formatting:
- FormatAlert function converting backend.Alert to SlackAttachment
- Color coding and emoji indicators for alert types (Flash=Red 🔴, Urgent=Orange 🟠, Alert=Yellow 🟡)
- Structured field layout with proper short/long field handling
- Location formatting, bulleted lists, text truncation
- Media handling with first image embedded
- Comprehensive unit tests covering all scenarios
- All tests and lint checks passing

---

### Phase 12: Mattermost Poster ✅

**Status**: Complete
**Commits**: 4362a3c, 0669b62, e8187ef, 583a25b, 4836f15, 9fffaae

Implemented Mattermost poster with:
- **Poster package** (`server/poster/poster.go`) with stateless Poster struct holding API and botID
- **Bot configuration** in plugin.json with username and display name settings
- **Bot initialization** in Plugin.OnActivate using EnsureBotUser API
- **AlertPoster interface** in backend package for dependency injection
- **Backend integration** with poster passed through factory to all backends
- **Direct posting** from AlertProcessor calling poster.PostAlert with channelID
- **Comprehensive tests** for poster functionality and error handling
- All tests and lint checks passing

---

### Phase 13: Webapp Foundation & Types ✅

**Status**: Complete
**Commits**: 140e8c5

Established webapp foundation with:
- Dependencies added: styled-components, @mattermost/compass-icons, react-intl
- Directory structure: `webapp/src/components/admin_console/backend_settings/`
- TypeScript types (`types.ts`):
  - `BackendConfig` interface for configuration
  - `BackendStatus` interface for status API
  - `StatusIndicator` enum (Active, Warning, Disabled, Unknown)
  - Helper functions: `getStatusIndicator()`, `mergeBackendStatus()`
- BackendSettings component with empty state and non-functional "Add Backend" button
- Custom setting registered in `webapp/src/index.tsx`
- Enzyme test adapter configured
- Comprehensive unit tests for types utilities and component rendering
- All tests and lint checks passing

---

### Phase 14: Backend List & Card UI ⬜

**Goal**: Implement backend list display with collapsible card pattern.

**Work**:
- Create `BackendList.tsx` component rendering array of backends
- Create `BackendCard.tsx` with collapsible card pattern (header + expand/collapse)
- Card header shows: icon, backend name, type, enabled badge
- Expand/collapse with chevron icon (similar to agents plugin bot cards)
- Render "No backends configured" empty state
- Pass backend data from props through to cards
- Write component tests for list rendering, expand/collapse behavior

**Completion Criteria**: Can view list of backends in collapsible cards, no status or editing yet, all tests and lint checks passing

---

### Phase 15: Status Integration & Indicators ⬜

**Goal**: Integrate real-time status polling and display health indicators.

**Work**:
- Create status polling service/hook that calls `/api/v1/backends/status` every 10 seconds
- Merge status data with config data by matching backend UUIDs
- Add status indicators to card headers: ✅ Active (0 failures), ⚠️ Warning (1-4 failures), ❌ Disabled (5+ failures), ❓ Unknown (no status)
- Display in expanded card: last poll time, last success time, consecutive failures, auth status, last error message
- Handle loading and error states for status API calls
- Write tests for status polling, merging logic, and indicator display

**Completion Criteria**: Real-time status visible for each backend, visual indicators working, all tests and lint checks passing

---

### Phase 16: Backend Form Fields ⬜

**Goal**: Implement form for viewing/editing backend configuration.

**Work**:
- Create `BackendForm.tsx` component (rendered inline in expanded card)
- Implement all form fields:
  - Name (text input)
  - Type (dropdown, hardcoded "dataminr" option for now)
  - Enabled (toggle switch)
  - URL (text input)
  - API ID (text input)
  - API Key (password input)
  - Channel ID (text input, no autocomplete)
  - Poll Interval Seconds (number input, min: 10)
- Basic field validation (non-empty fields only, backend handles detailed validation)
- Use `crypto.randomUUID()` for generating IDs for new backends
- Write tests for form rendering, validation, and field interactions

**Completion Criteria**: Form displays all fields, basic validation works, can view/edit backend details (no save yet), all tests and lint checks passing

---

### Phase 17: CRUD Operations ⬜

**Goal**: Implement add, edit, and delete operations with local state management.

**Work**:
- Add "Add Backend" button that creates new backend with UUID and default values
- Implement edit flow: changes update local state
- Implement delete with confirmation dialog (reuse agents plugin pattern)
- Manage form state within component
- Propagate changes via `onChange(id, value)` prop
- Write tests for add, edit, delete operations and state management

**Completion Criteria**: Can add/edit/delete backends, changes reflected in UI (not persisted yet), all tests and lint checks passing

---

### Phase 18: Persistence, Validation & Polish ⬜

**Goal**: Complete integration with Mattermost config system and production polish.

**Work**:
- Integrate with Mattermost `updateConfig()` Redux action for persistence
- Call `setSaveNeeded()` prop when changes occur
- Implement `registerSaveAction` / `unRegisterSaveAction` for custom save logic if needed
- Add loading/saving indicators
- Error handling for save failures
- Accessibility improvements (ARIA labels, keyboard navigation)
- Polish UX (transitions, error messages, disabled states)
- Write integration tests for full add→edit→save→delete flow
- Test error scenarios

**Completion Criteria**: Full CRUD workflow persists to server, production-ready, all tests and lint checks passing

---

### Final Steps

After all phases complete:

1. **System Integration Testing**: Manual testing with real Mattermost instance
2. **Documentation Review**: Update README.md and ensure CLAUDE.md is current
3. **Final Commit**

---

**End of Implementation Plan**
