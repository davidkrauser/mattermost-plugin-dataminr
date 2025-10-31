// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import BackendCard from './BackendCard';
import {ButtonIcon} from './buttons';
import {GrayPill} from './pill';
import type {BackendConfig} from './types';

describe('BackendCard', () => {
    const mockBackend: BackendConfig = {
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

    const mockOnChange = jest.fn();
    const mockOnDelete = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render backend name in header', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        expect(wrapper.text()).toContain('Test Backend');
        expect(wrapper.text()).toContain('dataminr');
    });

    it('should render "(Unnamed Backend)" when name is empty', () => {
        const unnamedBackend = {...mockBackend, name: ''};
        const wrapper = shallow(
            <BackendCard
                backend={unnamedBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        expect(wrapper.text()).toContain('(Unnamed Backend)');
    });

    it('should show ENABLED pill when backend is enabled', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const pills = wrapper.find(GrayPill);
        expect(pills).toHaveLength(1);
        expect(pills.at(0).children().text()).toBe('ENABLED');
    });

    it('should show DISABLED pill when backend is disabled', () => {
        const disabledBackend = {...mockBackend, enabled: false};
        const wrapper = shallow(
            <BackendCard
                backend={disabledBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const pills = wrapper.find(GrayPill);
        expect(pills).toHaveLength(1);
        expect(pills.at(0).children().text()).toBe('DISABLED');
    });

    it('should be collapsed by default', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        expect(wrapper.find(ChevronDownIcon)).toHaveLength(1);
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(0);
        expect(wrapper.text()).not.toContain('Backend configuration form will be implemented');
    });

    it('should expand when header is clicked', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Find the clickable header (first child of the root)
        const header = wrapper.childAt(0);
        header.simulate('click');

        // Check that content is now visible
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(1);
        expect(wrapper.find(ChevronDownIcon)).toHaveLength(0);
        expect(wrapper.text()).toContain('Backend configuration form will be implemented');
        expect(wrapper.text()).toContain('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should collapse when header is clicked again', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const header = wrapper.childAt(0);

        // Expand
        header.simulate('click');
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(1);

        // Collapse
        header.simulate('click');
        expect(wrapper.find(ChevronDownIcon)).toHaveLength(1);
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(0);
    });

    it('should call onDelete when delete button is clicked', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const deleteButton = wrapper.find(ButtonIcon);
        const mockStopPropagation = jest.fn();
        deleteButton.simulate('click', {stopPropagation: mockStopPropagation});

        expect(mockOnDelete).toHaveBeenCalledTimes(1);
        expect(mockStopPropagation).toHaveBeenCalled();
    });

    it('should display backend details when expanded', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Expand card
        const header = wrapper.childAt(0);
        header.simulate('click');

        const text = wrapper.text();
        expect(text).toContain('550e8400-e29b-41d4-a716-446655440000');
        expect(text).toContain('Test Backend');
        expect(text).toContain('dataminr');
        expect(text).toContain('https://api.example.com');
        expect(text).toContain('test-channel-id');
        expect(text).toContain('30s');
        expect(text).toContain('Yes');
    });
});
