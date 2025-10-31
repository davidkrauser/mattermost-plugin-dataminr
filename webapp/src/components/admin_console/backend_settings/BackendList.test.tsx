// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BackendCard from './BackendCard';
import BackendList from './BackendList';
import {TertiaryButton} from './buttons';
import type {BackendConfig, BackendStatus} from './types';
import {StatusIndicator} from './types';

// Mock crypto.randomUUID
const mockUUID = '550e8400-e29b-41d4-a716-446655440000';
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: () => mockUUID,
    },
});

describe('BackendList', () => {
    const mockBackend1: BackendConfig = {
        id: '1',
        name: 'Backend 1',
        type: 'dataminr',
        enabled: true,
        url: 'https://api1.example.com',
        apiId: 'api-id-1',
        apiKey: 'api-key-1',
        channelId: 'channel-1',
        pollIntervalSeconds: 30,
    };

    const mockBackend2: BackendConfig = {
        id: '2',
        name: 'Backend 2',
        type: 'dataminr',
        enabled: false,
        url: 'https://api2.example.com',
        apiId: 'api-id-2',
        apiKey: 'api-key-2',
        channelId: 'channel-2',
        pollIntervalSeconds: 60,
    };

    const mockStatus1: BackendStatus = {
        enabled: true,
        lastPollTime: '2025-10-31T12:00:00Z',
        lastSuccessTime: '2025-10-31T12:00:00Z',
        consecutiveFailures: 0,
        isAuthenticated: true,
        lastError: '',
    };

    const mockStatus2: BackendStatus = {
        enabled: false,
        lastPollTime: '2025-10-31T12:00:00Z',
        lastSuccessTime: '2025-10-31T11:55:00Z',
        consecutiveFailures: 5,
        isAuthenticated: false,
        lastError: 'Authentication failed',
    };

    const mockOnChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render empty list with Add Backend button when no backends', () => {
        const wrapper = shallow(
            <BackendList
                backends={[]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        expect(wrapper.find(BackendCard)).toHaveLength(0);
        expect(wrapper.find(TertiaryButton)).toHaveLength(1);
    });

    it('should render backend cards for each backend', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);
        expect(cards).toHaveLength(2);
        expect(cards.at(0).prop('backend')).toMatchObject({
            ...mockBackend1,
            statusIndicator: StatusIndicator.Unknown,
        });
        expect(cards.at(1).prop('backend')).toMatchObject({
            ...mockBackend2,
            statusIndicator: StatusIndicator.Unknown,
        });
    });

    it('should call onChange when a backend is updated', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        const updatedBackend = {...mockBackend1, name: 'Updated Name'};
        const cards = wrapper.find(BackendCard);
        cards.at(0).prop('onChange')(updatedBackend);

        expect(mockOnChange).toHaveBeenCalledWith([updatedBackend, mockBackend2]);
    });

    it('should call onChange when a backend is deleted', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);
        cards.at(0).prop('onDelete')();

        expect(mockOnChange).toHaveBeenCalledWith([mockBackend2]);
    });

    it('should add new backend with UUID when Add Backend button is clicked', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        const button = wrapper.find(TertiaryButton);
        button.simulate('click', {preventDefault: jest.fn()});

        expect(mockOnChange).toHaveBeenCalledWith([
            mockBackend1,
            {
                id: mockUUID,
                name: '',
                type: 'dataminr',
                enabled: true,
                url: 'https://firstalert-api.dataminr.com',
                apiId: '',
                apiKey: '',
                channelId: '',
                pollIntervalSeconds: 30,
            },
        ]);
    });

    it('should render backends with correct keys', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);
        expect(cards.at(0).key()).toBe('1');
        expect(cards.at(1).key()).toBe('2');
    });

    it('should merge status data with backend configs', () => {
        const statusMap = {
            1: mockStatus1,
            2: mockStatus2,
        };

        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={statusMap}
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);
        expect(cards).toHaveLength(2);

        // Backend 1 should have Active status (consecutiveFailures = 0)
        expect(cards.at(0).prop('backend')).toMatchObject({
            ...mockBackend1,
            status: mockStatus1,
            statusIndicator: StatusIndicator.Active,
        });

        // Backend 2 should have Disabled status (consecutiveFailures >= 5 and enabled = false)
        expect(cards.at(1).prop('backend')).toMatchObject({
            ...mockBackend2,
            status: mockStatus2,
            statusIndicator: StatusIndicator.Disabled,
        });
    });

    it('should show Unknown status when status data is not available', () => {
        const statusMap = {
            1: mockStatus1,

            // Backend 2 has no status data
        };

        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={statusMap}
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);

        // Backend 1 has status
        expect(cards.at(0).prop('backend')).toMatchObject({
            status: mockStatus1,
            statusIndicator: StatusIndicator.Active,
        });

        // Backend 2 has no status (Unknown)
        expect(cards.at(1).prop('backend')).toMatchObject({
            statusIndicator: StatusIndicator.Unknown,
        });
        expect(cards.at(1).prop('backend').status).toBeUndefined();
    });

    it('should pass validation errors to backend cards', () => {
        const validationErrors = {
            1: {
                name: 'Name is required',
                url: 'Invalid URL',
            },
            2: {
                apiId: 'API ID is required',
            },
        };

        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={{}}
                onChange={mockOnChange}
                validationErrors={validationErrors}
            />,
        );

        const cards = wrapper.find(BackendCard);

        // Backend 1 should receive its validation errors
        expect(cards.at(0).prop('validationErrors')).toEqual({
            name: 'Name is required',
            url: 'Invalid URL',
        });

        // Backend 2 should receive its validation errors
        expect(cards.at(1).prop('validationErrors')).toEqual({
            apiId: 'API ID is required',
        });
    });

    it('should not pass validation errors when none are present', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
                statusMap={{}}
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);

        // No validation errors should be passed
        expect(cards.at(0).prop('validationErrors')).toBeUndefined();
        expect(cards.at(1).prop('validationErrors')).toBeUndefined();
    });
});
