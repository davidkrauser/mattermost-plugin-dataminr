// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import BackendCard from './BackendCard';
import {ButtonIcon} from './buttons';
import {GrayPill, SuccessPill, WarningPill, DangerPill} from './pill';
import type {BackendDisplay} from './types';
import {StatusIndicator} from './types';

describe('BackendCard', () => {
    const mockBackend: BackendDisplay = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Backend',
        type: 'dataminr',
        enabled: true,
        url: 'https://api.example.com',
        apiId: 'test-api-id',
        apiKey: 'test-api-key',
        channelId: 'test-channel-id',
        pollIntervalSeconds: 30,
        statusIndicator: StatusIndicator.Unknown,
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

    it('should show ACTIVE pill for active status', () => {
        const activeBackend = {...mockBackend, statusIndicator: StatusIndicator.Active};
        const wrapper = shallow(
            <BackendCard
                backend={activeBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const pills = wrapper.find(SuccessPill);
        expect(pills).toHaveLength(1);
        expect(pills.at(0).children().text()).toBe('ACTIVE');
    });

    it('should show WARNING pill for warning status', () => {
        const warningBackend = {...mockBackend, statusIndicator: StatusIndicator.Warning};
        const wrapper = shallow(
            <BackendCard
                backend={warningBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const pills = wrapper.find(WarningPill);
        expect(pills).toHaveLength(1);
        expect(pills.at(0).children().text()).toBe('WARNING');
    });

    it('should show DISABLED pill for disabled status', () => {
        const disabledBackend = {...mockBackend, statusIndicator: StatusIndicator.Disabled};
        const wrapper = shallow(
            <BackendCard
                backend={disabledBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const pills = wrapper.find(DangerPill);
        expect(pills).toHaveLength(1);
        expect(pills.at(0).children().text()).toBe('DISABLED');
    });

    it('should show UNKNOWN pill for unknown status', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        const pills = wrapper.find(GrayPill);
        expect(pills).toHaveLength(1);
        expect(pills.at(0).children().text()).toBe('UNKNOWN');
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

    it('should display status details when status is available', () => {
        const backendWithStatus: BackendDisplay = {
            ...mockBackend,
            statusIndicator: StatusIndicator.Active,
            status: {
                enabled: true,
                lastPollTime: '2025-10-31T12:00:00Z',
                lastSuccessTime: '2025-10-31T12:00:00Z',
                consecutiveFailures: 0,
                isAuthenticated: true,
                lastError: '',
            },
        };

        const wrapper = shallow(
            <BackendCard
                backend={backendWithStatus}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Expand card
        const header = wrapper.childAt(0);
        header.simulate('click');

        const text = wrapper.text();
        expect(text).toContain('Status');
        expect(text).toContain('Consecutive Failures:');
        expect(text).toContain('0');
        expect(text).toContain('Authenticated:');
        expect(text).toContain('Yes');
        expect(text).toContain('Last Poll:');
        expect(text).toContain('Last Success:');
    });

    it('should display last error when present', () => {
        const backendWithError: BackendDisplay = {
            ...mockBackend,
            statusIndicator: StatusIndicator.Disabled,
            status: {
                enabled: false,
                lastPollTime: '2025-10-31T12:00:00Z',
                lastSuccessTime: '2025-10-31T11:55:00Z',
                consecutiveFailures: 5,
                isAuthenticated: false,
                lastError: 'Authentication failed: invalid credentials',
            },
        };

        const wrapper = shallow(
            <BackendCard
                backend={backendWithError}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Expand card
        const header = wrapper.childAt(0);
        header.simulate('click');

        const text = wrapper.text();
        expect(text).toContain('Last Error:');
        expect(text).toContain('Authentication failed: invalid credentials');
    });

    it('should not display status section when status is unavailable', () => {
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
        expect(text).toContain('Configuration');
        expect(text).not.toContain('Consecutive Failures:');
        expect(text).not.toContain('Authenticated:');
    });
});
