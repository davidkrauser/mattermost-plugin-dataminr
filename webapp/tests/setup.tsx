// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Enzyme from 'enzyme';
import * as AdapterModule from 'enzyme-adapter-react-17-updated';

// @ts-expect-error - enzyme-adapter-react-17-updated doesn't have proper TypeScript types
const Adapter = AdapterModule.default || AdapterModule;

Enzyme.configure({adapter: new Adapter()});

export {};
