// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback} from 'react';

import type {BackendStatus} from './types';

import {getBackendsStatus} from '../../../client';

export const useBackendStatus = () => {
    const [statusMap, setStatusMap] = useState<Record<string, BackendStatus>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch backend status
    const fetchStatus = useCallback(async () => {
        try {
            const status = await getBackendsStatus();
            setStatusMap(status);
            setError(null);
            setLoading(false);
        } catch (err) {
            // Don't show error for expected scenarios (no backends configured, etc)
            // Just continue with empty status
            setError('Failed to fetch backend status');
            setLoading(false);
        }
    }, []);

    // Poll status every 10 seconds
    useEffect(() => {
        // Fetch immediately on mount
        fetchStatus();

        // Set up polling interval
        const interval = setInterval(() => {
            fetchStatus();
        }, 10000); // 10 seconds

        // Cleanup on unmount
        return () => clearInterval(interval);
    }, [fetchStatus]);

    return {
        statusMap,
        loading,
        error,
    };
};
