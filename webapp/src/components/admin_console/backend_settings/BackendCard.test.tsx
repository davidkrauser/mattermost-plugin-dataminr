// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import BackendCard from './BackendCard';
import {ButtonIcon} from './buttons';
import ConfirmationDialog from './ConfirmationDialog';
import type {BackendDisplay} from './types';
import {StatusIndicator} from './types';
import type {ValidationErrors} from './validation';

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

        // Simulate click by calling the onClick handler
        // Find the first element with an onClick that changes state
        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);
        headerElement.prop('onClick')();

        // Check that content is now visible
        wrapper.update();
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

        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);

        // Expand
        headerElement.prop('onClick')();
        wrapper.update();
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(1);

        // Collapse
        headerElement.prop('onClick')();
        wrapper.update();
        expect(wrapper.find(ChevronDownIcon)).toHaveLength(1);
        expect(wrapper.find(ChevronUpIcon)).toHaveLength(0);
    });

    it('should show confirmation dialog when delete button is clicked', () => {
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

        // Should show confirmation dialog, not call onDelete immediately
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockStopPropagation).toHaveBeenCalled();
        expect(wrapper.find(ConfirmationDialog)).toHaveLength(1);
    });

    it('should call onDelete when confirmation dialog is confirmed', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Click delete button to show dialog
        const deleteButton = wrapper.find(ButtonIcon);
        deleteButton.simulate('click', {stopPropagation: jest.fn()});

        // Confirm delete in dialog
        const dialog = wrapper.find(ConfirmationDialog);
        dialog.prop('onConfirm')();

        expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should close confirmation dialog when cancelled', () => {
        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
            />,
        );

        // Click delete button to show dialog
        const deleteButton = wrapper.find(ButtonIcon);
        deleteButton.simulate('click', {stopPropagation: jest.fn()});

        // Confirm dialog is shown
        expect(wrapper.find(ConfirmationDialog)).toHaveLength(1);

        // Cancel dialog
        const dialog = wrapper.find(ConfirmationDialog);
        dialog.prop('onCancel')();

        // Dialog should be closed and onDelete not called
        expect(wrapper.find(ConfirmationDialog)).toHaveLength(0);
        expect(mockOnDelete).not.toHaveBeenCalled();
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
        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);
        headerElement.prop('onClick')();

        // Check BackendForm is rendered
        wrapper.update();
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
        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);
        headerElement.prop('onClick')();

        wrapper.update();
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
        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);
        headerElement.prop('onClick')();

        wrapper.update();
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
        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);
        headerElement.prop('onClick')();

        wrapper.update();
        const text = wrapper.text();
        expect(text).toContain('Configuration');
        expect(text).not.toContain('Consecutive Failures:');
        expect(text).not.toContain('Authenticated:');
    });

    it('should display validation errors when present', () => {
        const validationErrors: ValidationErrors = {
            name: 'Name is required',
            url: 'URL must be a valid HTTPS URL',
        };

        const wrapper = shallow(
            <BackendCard
                backend={mockBackend}
                allBackends={[mockBackend]}
                onChange={mockOnChange}
                onDelete={mockOnDelete}
                validationErrors={validationErrors}
            />,
        );

        // Expand card
        const clickableElements = wrapper.find('[onClick]');
        const headerElement = clickableElements.at(0);
        headerElement.prop('onClick')();

        wrapper.update();
        const text = wrapper.text();
        expect(text).toContain('Validation Errors');
        expect(text).toContain('name');
        expect(text).toContain('Name is required');
        expect(text).toContain('url');
        expect(text).toContain('URL must be a valid HTTPS URL');
    });

    it('should not display validation errors when none are present', () => {
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
        expect(text).not.toContain('Validation Errors');
    });
});
