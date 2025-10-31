// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react-hooks';

import type {BackendStatus} from './types';
import {useBackendStatus} from './useBackendStatus';

import * as client from '../../../client';

jest.mock('../../../client');

describe('useBackendStatus', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
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

    it('should poll every 10 seconds', async () => {
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

        const {waitForNextUpdate} = renderHook(() => useBackendStatus());

        // Wait for initial fetch
        await waitForNextUpdate();
        expect(client.getBackendsStatus).toHaveBeenCalledTimes(1);

        // Advance time by 10 seconds
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        await waitForNextUpdate();
        expect(client.getBackendsStatus).toHaveBeenCalledTimes(2);

        // Advance time by another 10 seconds
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        await waitForNextUpdate();
        expect(client.getBackendsStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle fetch errors gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        (client.getBackendsStatus as jest.Mock).mockRejectedValue(new Error('Network error'));

        const {result, waitForNextUpdate} = renderHook(() => useBackendStatus());

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.statusMap).toEqual({});
        expect(result.current.error).toBe('Failed to fetch backend status');
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });

    it('should clear interval on unmount', async () => {
        const mockStatus: Record<string, BackendStatus> = {};
        (client.getBackendsStatus as jest.Mock).mockResolvedValue(mockStatus);

        const {unmount, waitForNextUpdate} = renderHook(() => useBackendStatus());

        await waitForNextUpdate();

        unmount();

        // Advance time to ensure no more calls happen
        act(() => {
            jest.advanceTimersByTime(20000);
        });

        expect(client.getBackendsStatus).toHaveBeenCalledTimes(1);
    });
});
