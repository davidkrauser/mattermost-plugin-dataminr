// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {getBackendsStatus} from './client';

// Mock the Client4
jest.mock('@mattermost/client', () => ({
    Client4: jest.fn(),
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

describe('client', () => {
    let mockGetOptions: jest.Mock;

    beforeEach(() => {
        mockGetOptions = jest.fn((opts) => opts);

        // Mock Client4 instance
        (Client4 as unknown as jest.Mock).mockImplementation(() => ({
            getOptions: mockGetOptions,
            url: 'http://localhost:8065',
        }));

        // Reset fetch mock
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getBackendsStatus', () => {
        it('should fetch backend status successfully', async () => {
            const mockStatus = {
                'backend-id-1': {
                    enabled: true,
                    lastPollTime: '2025-10-31T12:00:00Z',
                    lastSuccessTime: '2025-10-31T12:00:00Z',
                    consecutiveFailures: 0,
                    isAuthenticated: true,
                    lastError: '',
                },
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockStatus,
            });

            const result = await getBackendsStatus();

            expect(global.fetch).toHaveBeenCalledWith(
                '/plugins/com.mattermost.dataminr/api/v1/backends/status',
                expect.objectContaining({
                    method: 'GET',
                }),
            );
            expect(result).toEqual(mockStatus);
        });

        it('should throw ClientError on fetch failure', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
            });

            await expect(getBackendsStatus()).rejects.toThrow();
        });

        it('should handle empty status map', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({}),
            });

            const result = await getBackendsStatus();

            expect(result).toEqual({});
        });
    });
});
