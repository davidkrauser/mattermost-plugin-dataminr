// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4 as Client4Class, ClientError} from '@mattermost/client';

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
