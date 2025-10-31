// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mock @mattermost/client before importing anything that depends on it
jest.mock('@mattermost/client', () => ({
    Client4: jest.fn().mockImplementation(() => ({
        getOptions: jest.fn((opts) => opts),
        url: 'http://localhost:8065',
    })),
    ClientError: class ClientError extends Error {
        status_code: number;
        url: string;

        constructor(baseUrl: string, data: {message: string; status_code: number; url: string}) {
            super(data.message);
            this.status_code = data.status_code;
            this.url = data.url;
            this.name = 'ClientError';
        }
    },
}));

import {renderHook} from '@testing-library/react-hooks';

import type {BackendStatus} from './types';
import {useBackendStatus} from './useBackendStatus';

import * as client from '../../../client';

jest.mock('../../../client');

describe('useBackendStatus', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch status on mount', async () => {
        const mockStatus: Record<string, BackendStatus> = {
            'backend-id-1': {
                enabled: true,
                lastPollTime: '2025-10-31T12:00:00Z',
                lastSuccessTime: '2025-10-31T12:00:00Z',
                consecutiveFailures: 0,
                isAuthenticated: true,
                lastError: '',
            },
        };

        (client.getBackendsStatus as jest.Mock).mockResolvedValue(mockStatus);

        const {result, waitForNextUpdate} = renderHook(() => useBackendStatus());

        // Initial state
        expect(result.current.loading).toBe(true);
        expect(result.current.statusMap).toEqual({});
        expect(result.current.error).toBeNull();

        // Wait for initial fetch
        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.statusMap).toEqual(mockStatus);
        expect(result.current.error).toBeNull();
        expect(client.getBackendsStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch errors gracefully', async () => {
        (client.getBackendsStatus as jest.Mock).mockRejectedValue(new Error('Network error'));

        const {result, waitForNextUpdate} = renderHook(() => useBackendStatus());

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.statusMap).toEqual({});
        expect(result.current.error).toBe('Failed to fetch backend status');
    });
});
