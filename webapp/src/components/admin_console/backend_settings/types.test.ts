// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BackendConfig, BackendStatus} from './types';
import {
    StatusIndicator,
    getStatusIndicator,
    mergeBackendStatus,
} from './types';

describe('getStatusIndicator', () => {
    it('should return Unknown when status is undefined', () => {
        expect(getStatusIndicator(undefined)).toBe(StatusIndicator.Unknown);
    });

    it('should return Active when enabled and no errors', () => {
        const status: BackendStatus = {
            enabled: true,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T12:00:00Z',
            consecutiveFailures: 0,
            isAuthenticated: true,
            lastError: '',
        };
        expect(getStatusIndicator(status)).toBe(StatusIndicator.Active);
    });

    it('should return Warning when enabled with errors', () => {
        const status: BackendStatus = {
            enabled: true,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T11:00:00Z',
            consecutiveFailures: 3,
            isAuthenticated: true,
            lastError: 'some error',
        };
        expect(getStatusIndicator(status)).toBe(StatusIndicator.Warning);
    });

    it('should return Disabled when disabled and no errors', () => {
        const status: BackendStatus = {
            enabled: false,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T12:00:00Z',
            consecutiveFailures: 0,
            isAuthenticated: true,
            lastError: '',
        };
        expect(getStatusIndicator(status)).toBe(StatusIndicator.Disabled);
    });

    it('should return Error when disabled with consecutive failures', () => {
        const status: BackendStatus = {
            enabled: false,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T11:00:00Z',
            consecutiveFailures: 5,
            isAuthenticated: false,
            lastError: 'too many failures',
        };
        expect(getStatusIndicator(status)).toBe(StatusIndicator.Error);
    });

    it('should return Error when disabled with lastError', () => {
        const status: BackendStatus = {
            enabled: false,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T11:00:00Z',
            consecutiveFailures: 0,
            isAuthenticated: false,
            lastError: 'authentication failed',
        };
        expect(getStatusIndicator(status)).toBe(StatusIndicator.Error);
    });

    it('should return Error when disabled with both consecutiveFailures and lastError', () => {
        const status: BackendStatus = {
            enabled: false,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T11:00:00Z',
            consecutiveFailures: 10,
            isAuthenticated: false,
            lastError: 'too many failures',
        };
        expect(getStatusIndicator(status)).toBe(StatusIndicator.Error);
    });
});

describe('mergeBackendStatus', () => {
    const config: BackendConfig = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Backend',
        type: 'dataminr',
        enabled: true,
        url: 'https://api.example.com',
        apiId: 'test-api-id',
        apiKey: 'test-api-key',
        channelId: 'test-channel-id',
        pollIntervalSeconds: 30,
    };

    it('should merge config with status when status exists', () => {
        const status: BackendStatus = {
            enabled: true,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T12:00:00Z',
            consecutiveFailures: 0,
            isAuthenticated: true,
            lastError: '',
        };
        const statusMap = {[config.id]: status};

        const result = mergeBackendStatus(config, statusMap);

        expect(result.id).toBe(config.id);
        expect(result.name).toBe(config.name);
        expect(result.status).toBe(status);
        expect(result.statusIndicator).toBe(StatusIndicator.Active);
    });

    it('should set statusIndicator to Unknown when status does not exist', () => {
        const statusMap = {};

        const result = mergeBackendStatus(config, statusMap);

        expect(result.id).toBe(config.id);
        expect(result.name).toBe(config.name);
        expect(result.status).toBeUndefined();
        expect(result.statusIndicator).toBe(StatusIndicator.Unknown);
    });

    it('should correctly set statusIndicator based on status', () => {
        const status: BackendStatus = {
            enabled: true,
            lastPollTime: '2025-10-30T12:00:00Z',
            lastSuccessTime: '2025-10-30T11:00:00Z',
            consecutiveFailures: 2,
            isAuthenticated: true,
            lastError: 'some error',
        };
        const statusMap = {[config.id]: status};

        const result = mergeBackendStatus(config, statusMap);

        expect(result.statusIndicator).toBe(StatusIndicator.Warning);
    });
});
