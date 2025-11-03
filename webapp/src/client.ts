// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4 as Client4Class, ClientError} from '@mattermost/client';
import type {ChannelWithTeamData} from '@mattermost/types/channels';

import type {BackendStatus} from './components/admin_console/backend_settings/types';
import manifest from './manifest';

const Client4 = new Client4Class();

function baseRoute(): string {
    return `/plugins/${manifest.id}`;
}

/**
 * Fetch status for all configured backends
 * Returns a map of backend UUIDs to status objects
 */
export async function getBackendsStatus(): Promise<Record<string, BackendStatus>> {
    const url = `${baseRoute()}/api/v1/backends/status`;
    const response = await fetch(url, Client4.getOptions({
        method: 'GET',
    }));

    if (response.ok) {
        return response.json();
    }

    throw new ClientError(Client4.url, {
        message: '',
        status_code: response.status,
        url,
    });
}

/**
 * Search for channels across all teams
 * @param term - Search term
 * @returns Array of channels with team data
 */
export async function searchAllChannels(term: string): Promise<ChannelWithTeamData[]> {
    return Client4.searchAllChannels(term, {
        nonAdminSearch: false,
        public: true,
        private: true,
        include_deleted: false,
        deleted: false,
    }) as Promise<ChannelWithTeamData[]>;
}

/**
 * Get a channel by ID
 * @param channelId - Channel ID
 * @returns Channel with team data
 */
export async function getChannelById(channelId: string): Promise<ChannelWithTeamData> {
    const channel = await Client4.getChannel(channelId);
    return channel as unknown as ChannelWithTeamData;
}
