// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BackendList from './BackendList';
import NoBackendsPage from './NoBackendsPage';
import type {BackendConfig} from './types';

import BackendSettings from './index';

describe('BackendSettings', () => {
    const baseProps = {
        id: 'Backends',
        label: 'Backend Configurations',
        helpText: 'Configure alert backends',
        value: [] as BackendConfig[],
        disabled: false,
        config: {},
        currentState: {},
        license: {},
        setByEnv: false,
        onChange: jest.fn(),
        setSaveNeeded: jest.fn(),
        registerSaveAction: jest.fn(),
        unRegisterSaveAction: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render empty state when no backends are configured', () => {
        const wrapper = shallow(<BackendSettings {...baseProps}/>);

        expect(wrapper.find(NoBackendsPage)).toHaveLength(1);
        expect(wrapper.find(BackendList)).toHaveLength(0);
    });

    it('should render BackendList when backends exist', () => {
        const backend: BackendConfig = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Backend',
            type: 'dataminr',
            enabled: true,
            url: 'https://api.example.com',
            apiId: 'test-api-id',
            apiKey: 'test-api-key',
            channelId: 'test-channel-id',
            pollIntervalSeconds: 30,
        };

        const props = {
            ...baseProps,
            value: [backend],
        };

        const wrapper = shallow(<BackendSettings {...props}/>);

        expect(wrapper.find(BackendList)).toHaveLength(1);
        expect(wrapper.find(NoBackendsPage)).toHaveLength(0);
        expect(wrapper.find(BackendList).prop('backends')).toEqual([backend]);
    });

    it('should handle undefined value prop', () => {
        const wrapper = shallow(<BackendSettings {...baseProps}/>);

        expect(wrapper.find(NoBackendsPage)).toHaveLength(1);
    });

    it('should call onChange and setSaveNeeded when backends change', () => {
        const backend: BackendConfig = {
            id: '1',
            name: 'Test Backend',
            type: 'dataminr',
            enabled: true,
            url: 'https://api.example.com',
            apiId: 'test-api-id',
            apiKey: 'test-api-key',
            channelId: 'test-channel-id',
            pollIntervalSeconds: 30,
        };

        const props = {
            ...baseProps,
            value: [backend],
        };

        const wrapper = shallow(<BackendSettings {...props}/>);
        const backendList = wrapper.find(BackendList);

        const updatedBackend = {...backend, name: 'Updated Name'};
        backendList.prop('onChange')([updatedBackend]);

        expect(props.onChange).toHaveBeenCalledWith('Backends', [updatedBackend]);
        expect(props.setSaveNeeded).toHaveBeenCalled();
    });
});
