// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BackendCard from './BackendCard';
import BackendList from './BackendList';
import {TertiaryButton} from './buttons';
import type {BackendConfig} from './types';

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

    const mockOnChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render empty list with Add Backend button when no backends', () => {
        const wrapper = shallow(
            <BackendList
                backends={[]}
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
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);
        expect(cards).toHaveLength(2);
        expect(cards.at(0).prop('backend')).toEqual(mockBackend1);
        expect(cards.at(1).prop('backend')).toEqual(mockBackend2);
    });

    it('should call onChange when a backend is updated', () => {
        const wrapper = shallow(
            <BackendList
                backends={[mockBackend1, mockBackend2]}
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
                onChange={mockOnChange}
            />,
        );

        const cards = wrapper.find(BackendCard);
        expect(cards.at(0).key()).toBe('1');
        expect(cards.at(1).key()).toBe('2');
    });
});
