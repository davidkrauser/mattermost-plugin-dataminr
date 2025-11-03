// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Enzyme from 'enzyme';
import * as AdapterModule from 'enzyme-adapter-react-17-updated';
import {JSDOM} from 'jsdom';

// @ts-expect-error - enzyme-adapter-react-17-updated doesn't have proper TypeScript types
const Adapter = AdapterModule.default || AdapterModule;

Enzyme.configure({adapter: new Adapter()});

// Setup DOM for mount() tests
if (typeof document === 'undefined') {
    const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
        url: 'http://localhost',
    });
    global.document = jsdom.window.document;
    global.window = jsdom.window as any;
}

// Mock @mattermost/client globally to prevent module resolution issues
jest.mock('@mattermost/client', () => {
    const mockGetOptions = jest.fn((opts) => opts);
    return {
        Client4: jest.fn().mockImplementation(() => ({
            getOptions: mockGetOptions,
            url: 'http://localhost:8065',
            searchAllChannels: jest.fn(),
            getChannel: jest.fn(),
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

export {};
