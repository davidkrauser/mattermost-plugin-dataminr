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
    Active = 'active', // consecutiveFailures = 0 and enabled
    Warning = 'warning', // 1-4 consecutive failures and enabled
    Disabled = 'disabled', // Backend disabled with no errors
    Error = 'error', // Backend disabled with errors
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
 * Logic:
 * - No status data → Unknown
 * - Backend disabled with errors → Error
 * - Backend disabled with no errors → Disabled
 * - Backend enabled with no errors → Active
 * - Backend enabled with errors → Warning
 */
export function getStatusIndicator(status?: BackendStatus): StatusIndicator {
    if (!status) {
        return StatusIndicator.Unknown;
    }

    // Backend is disabled
    if (!status.enabled) {
        // Check if there are errors
        if (status.consecutiveFailures > 0 || status.lastError) {
            return StatusIndicator.Error;
        }
        return StatusIndicator.Disabled;
    }

    // Backend is enabled
    if (status.consecutiveFailures === 0) {
        return StatusIndicator.Active;
    }

    return StatusIndicator.Warning;
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
