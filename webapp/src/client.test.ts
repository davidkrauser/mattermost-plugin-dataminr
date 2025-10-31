// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getBackendsStatus} from './client';

// Mock the Client4 module
jest.mock('@mattermost/client', () => {
    const mockGetOptions = jest.fn((opts) => opts);
    return {
        Client4: jest.fn().mockImplementation(() => ({
            getOptions: mockGetOptions,
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
    };
});

describe('client', () => {
    beforeEach(() => {
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
                '/plugins/com.mattermost.plugin-dataminr/api/v1/backends/status',
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
