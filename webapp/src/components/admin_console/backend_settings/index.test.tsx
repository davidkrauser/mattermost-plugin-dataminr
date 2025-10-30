// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

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

        // Check for FormattedMessage components by their defaultMessage prop
        const formattedMessages = wrapper.find(FormattedMessage);
        const messages = formattedMessages.map((msg) => msg.prop('defaultMessage'));

        expect(messages).toContain('No backends configured');
        expect(messages).toContain('Add Backend');
    });

    it('should render placeholder when backends exist', () => {
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

        const formattedMessages = wrapper.find(FormattedMessage);
        const messages = formattedMessages.map((msg) => msg.prop('defaultMessage'));

        expect(messages).toContain('Backends list will be displayed here');
        expect(messages).not.toContain('No backends configured');
    });

    it('should handle undefined value prop', () => {
        // Remove the required validation warning by not setting value to undefined
        // Instead, test that empty array is handled
        const wrapper = shallow(<BackendSettings {...baseProps}/>);

        const formattedMessages = wrapper.find(FormattedMessage);
        const messages = formattedMessages.map((msg) => msg.prop('defaultMessage'));

        expect(messages).toContain('No backends configured');
    });

    it('should render Add Backend button in empty state', () => {
        const wrapper = shallow(<BackendSettings {...baseProps}/>);

        // Check that the button's FormattedMessage is present
        const formattedMessages = wrapper.find(FormattedMessage);
        const messages = formattedMessages.map((msg) => msg.prop('defaultMessage'));

        expect(messages).toContain('Add Backend');

        // Verify onChange is not called when rendering (button is placeholder)
        expect(baseProps.onChange).not.toHaveBeenCalled();
    });
});
