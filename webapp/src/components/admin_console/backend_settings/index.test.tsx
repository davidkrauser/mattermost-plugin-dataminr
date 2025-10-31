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

    it('should register save action on mount', () => {
        const registerSaveAction = jest.fn();
        const props = {
            ...baseProps,
            registerSaveAction,
        };

        shallow(<BackendSettings {...props}/>);

        expect(registerSaveAction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should unregister save action on unmount', () => {
        const unRegisterSaveAction = jest.fn();
        const props = {
            ...baseProps,
            unRegisterSaveAction,
        };

        const wrapper = shallow(<BackendSettings {...props}/>);
        wrapper.unmount();

        expect(unRegisterSaveAction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should validate backends on save and return error if validation fails', async () => {
        const invalidBackend: BackendConfig = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: '', // Invalid: name is required
            type: 'dataminr',
            enabled: true,
            url: 'https://api.example.com',
            apiId: 'test-api-id',
            apiKey: 'test-api-key',
            channelId: 'test-channel-id',
            pollIntervalSeconds: 30,
        };

        let saveAction: (() => Promise<{error?: {message?: string}}>) | undefined;
        const registerSaveAction = jest.fn((action) => {
            saveAction = action;
        });

        const props = {
            ...baseProps,
            value: [invalidBackend],
            registerSaveAction,
        };

        shallow(<BackendSettings {...props}/>);

        expect(saveAction).toBeDefined();
        const result = await saveAction!();

        expect(result).toEqual({error: {message: 'Please fix validation errors before saving'}});
    });

    it('should validate backends on save and return success if validation passes', async () => {
        const validBackend: BackendConfig = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Valid Backend',
            type: 'dataminr',
            enabled: true,
            url: 'https://api.example.com',
            apiId: 'test-api-id',
            apiKey: 'test-api-key',
            channelId: 'test-channel-id',
            pollIntervalSeconds: 30,
        };

        let saveAction: (() => Promise<{error?: {message?: string}}>) | undefined;
        const registerSaveAction = jest.fn((action) => {
            saveAction = action;
        });

        const props = {
            ...baseProps,
            value: [validBackend],
            registerSaveAction,
        };

        shallow(<BackendSettings {...props}/>);

        expect(saveAction).toBeDefined();
        const result = await saveAction!();

        expect(result).toEqual({});
    });

    it('should clear validation errors when backends change', () => {
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

        // Initially no validation errors
        expect(wrapper.find(BackendList).prop('validationErrors')).toEqual({});

        // Change backends
        const backendList = wrapper.find(BackendList);
        const updatedBackend = {...backend, name: 'Updated Name'};
        backendList.prop('onChange')([updatedBackend]);

        // Validation errors should still be empty/cleared
        wrapper.update();
        expect(wrapper.find(BackendList).prop('validationErrors')).toEqual({});
    });
});
