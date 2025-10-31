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

export {};
