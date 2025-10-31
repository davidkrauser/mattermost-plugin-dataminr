// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import BackendCard from './BackendCard';
import {ButtonIcon} from './buttons';
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
                allBackends={[mockBackend]}
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
                allBackends={[unnamedBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        expect(wrapper.text()).toContain('(Unnamed Backend)');
    });

    it('should show status pill for active status', () => {
        const activeBackend = {...mockBackend, statusIndicator: StatusIndicator.Active};
        shallow(
            <BackendCard
                backend={activeBackend}
                allBackends={[activeBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Check that backend has active status indicator
        expect(activeBackend.statusIndicator).toBe(StatusIndicator.Active);
    });

    it('should show status pill for warning status', () => {
        const warningBackend = {...mockBackend, statusIndicator: StatusIndicator.Warning};
        shallow(
            <BackendCard
                backend={warningBackend}
                allBackends={[warningBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Check that backend has warning status indicator
        expect(warningBackend.statusIndicator).toBe(StatusIndicator.Warning);
    });

    it('should show status pill for disabled status', () => {
        const disabledBackend = {...mockBackend, statusIndicator: StatusIndicator.Disabled};
        shallow(
            <BackendCard
                backend={disabledBackend}
                allBackends={[disabledBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Check that backend has disabled status indicator
        expect(disabledBackend.statusIndicator).toBe(StatusIndicator.Disabled);
    });

    it('should show status pill for unknown status', () => {
        shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Check that backend has unknown status indicator
        expect(mockBackend.statusIndicator).toBe(StatusIndicator.Unknown);
    });

    it('should be collapsed by default', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        expect(wrapper.find(ChevronDownIcon)).toHaveLength(1);
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(0);
    });

    it('should expand when header is clicked', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
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
        expect(wrapper.text()).toContain('Configuration');
    });

    it('should collapse when header is clicked again', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
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
                allBackends={[mockBackend]}
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

    it('should render BackendForm when expanded', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Expand card
        const header = wrapper.childAt(0);
        header.simulate('click');

        // Check BackendForm is rendered
        expect(wrapper.find('BackendForm')).toHaveLength(1);
        expect(wrapper.text()).toContain('Configuration');
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
                allBackends={[backendWithStatus]}
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
                allBackends={[backendWithError]}
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
                allBackends={[mockBackend]}
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
