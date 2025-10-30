// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Backend types supported by the plugin.
 * Currently 'dataminr' is the only supported type.
 */
export type BackendType = string;

/**
 * Backend configuration as stored in plugin settings
 */
export interface BackendConfig {
    id: string; // UUID v4, immutable
    name: string; // Display name, mutable but must be unique
    type: BackendType;
    enabled: boolean;
    url: string;
    apiId: string;
    apiKey: string;
    channelId: string;
    pollIntervalSeconds: number;
}

/**
 * Backend status from the /api/v1/backends/status endpoint
 */
export interface BackendStatus {
    enabled: boolean;
    lastPollTime: string; // ISO 8601 timestamp
    lastSuccessTime: string; // ISO 8601 timestamp
    consecutiveFailures: number;
    isAuthenticated: boolean;
    lastError: string;
}

/**
 * Status indicator types for UI display
 */
export enum StatusIndicator {
    Active = 'active', // consecutiveFailures = 0
    Warning = 'warning', // 1-4 consecutive failures
    Disabled = 'disabled', // consecutiveFailures >= 5
    Unknown = 'unknown', // No status data available
}

/**
 * Merged backend data for display (config + status)
 */
export interface BackendDisplay extends BackendConfig {
    status?: BackendStatus;
    statusIndicator: StatusIndicator;
}

/**
 * Determines the status indicator based on backend status.
 * The backend automatically disables a backend after consecutive failures,
 * so we just need to check the current state:
 * - No status data → Unknown
 * - No errors (consecutiveFailures = 0) → Active
 * - Has errors but still enabled → Warning
 * - Has errors and disabled → Disabled
 */
export function getStatusIndicator(status?: BackendStatus): StatusIndicator {
    if (!status) {
        return StatusIndicator.Unknown;
    }

    if (status.consecutiveFailures === 0) {
        return StatusIndicator.Active;
    }

    if (status.enabled) {
        return StatusIndicator.Warning;
    }

    return StatusIndicator.Disabled;
}

/**
 * Merges backend configuration with status data
 */
export function mergeBackendStatus(
    config: BackendConfig,
    statusMap: Record<string, BackendStatus>,
): BackendDisplay {
    const status = statusMap[config.id];
    return {
        ...config,
        status,
        statusIndicator: getStatusIndicator(status),
    };
}
