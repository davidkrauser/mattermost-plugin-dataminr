// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BackendForm from './BackendForm';
import type {BackendConfig} from './types';

describe('BackendForm', () => {
    const validBackend: BackendConfig = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Backend',
        type: 'dataminr',
        enabled: true,
        url: 'https://api.example.com',
        apiId: 'test-id',
        apiKey: 'test-key',
        channelId: 'test-channel',
        pollIntervalSeconds: 30,
    };

    const mockOnChange = jest.fn();

    beforeEach(() => {
        mockOnChange.mockClear();
    });

    it('should render all form fields', () => {
        const wrapper = shallow(
            <BackendForm
                backend={validBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        expect(wrapper.find('TextItem')).toHaveLength(6); // name, url, apiId, apiKey, channelId, pollIntervalSeconds
        expect(wrapper.find('BooleanItem')).toHaveLength(1); // enabled
        expect(wrapper.find('SelectionItem')).toHaveLength(1); // type
    });

    it('should display correct field values', () => {
        const wrapper = shallow(
            <BackendForm
                backend={validBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        const nameField = wrapper.find('TextItem').at(0);
        expect(nameField.prop('value')).toBe('Test Backend');
        expect(nameField.prop('label')).toBe('Name');

        const enabledField = wrapper.find('BooleanItem');
        expect(enabledField.prop('value')).toBe(true);

        const typeField = wrapper.find('SelectionItem');
        expect(typeField.prop('value')).toBe('dataminr');

        const urlField = wrapper.find('TextItem').at(1);
        expect(urlField.prop('value')).toBe('https://api.example.com');

        const apiIdField = wrapper.find('TextItem').at(2);
        expect(apiIdField.prop('value')).toBe('test-id');

        const apiKeyField = wrapper.find('TextItem').at(3);
        expect(apiKeyField.prop('value')).toBe('test-key');
        expect(apiKeyField.prop('type')).toBe('password');

        const channelIdField = wrapper.find('TextItem').at(4);
        expect(channelIdField.prop('value')).toBe('test-channel');

        const pollIntervalField = wrapper.find('TextItem').at(5);
        expect(pollIntervalField.prop('value')).toBe('30');
        expect(pollIntervalField.prop('type')).toBe('number');
    });

    it('should call onChange when field values change', () => {
        const wrapper = shallow(
            <BackendForm
                backend={validBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        // Test name field change
        const nameField = wrapper.find('TextItem').at(0);
        nameField.prop('onChange')({target: {value: 'New Name'}} as any);
        expect(mockOnChange).toHaveBeenCalledWith({
            ...validBackend,
            name: 'New Name',
        });

        mockOnChange.mockClear();

        // Test enabled field change
        const enabledField = wrapper.find('BooleanItem');
        enabledField.prop('onChange')(false);
        expect(mockOnChange).toHaveBeenCalledWith({
            ...validBackend,
            enabled: false,
        });

        mockOnChange.mockClear();

        // Test url field change
        const urlField = wrapper.find('TextItem').at(1);
        urlField.prop('onChange')({target: {value: 'https://new-url.com'}} as any);
        expect(mockOnChange).toHaveBeenCalledWith({
            ...validBackend,
            url: 'https://new-url.com',
        });
    });

    it('should not show errors initially', () => {
        const wrapper = shallow(
            <BackendForm
                backend={validBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        expect(wrapper.find('ErrorMessage')).toHaveLength(0);

        // Fields should not have hasError prop set to true
        wrapper.find('TextItem').forEach((field) => {
            expect(field.prop('hasError')).toBe(false);
        });
    });

    it('should show error after blur on invalid field', () => {
        const invalidBackend: BackendConfig = {
            ...validBackend,
            name: '', // Invalid: empty name
        };

        const wrapper = shallow(
            <BackendForm
                backend={invalidBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        // Blur the name field
        const nameField = wrapper.find('TextItem').at(0);
        if (nameField.prop('onBlur')) {
            nameField.prop('onBlur')({} as any);
        }

        // Re-render to see the error
        wrapper.update();

        // Check hasError prop is set
        const nameFieldAfterBlur = wrapper.find('TextItem').at(0);
        expect(nameFieldAfterBlur.prop('hasError')).toBe(true);
    });

    it('should show error for duplicate name', () => {
        const existingBackend: BackendConfig = {
            ...validBackend,
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            name: 'Duplicate Name',
        };

        const currentBackend: BackendConfig = {
            ...validBackend,
            name: 'Duplicate Name',
        };

        const wrapper = shallow(
            <BackendForm
                backend={currentBackend}
                allBackends={[existingBackend]}
                onChange={mockOnChange}
            />,
        );

        // Blur the name field
        const nameField = wrapper.find('TextItem').at(0);
        if (nameField.prop('onBlur')) {
            nameField.prop('onBlur')({} as any);
        }

        wrapper.update();

        // Check hasError prop is set for duplicate name
        const nameFieldAfterBlur = wrapper.find('TextItem').at(0);
        expect(nameFieldAfterBlur.prop('hasError')).toBe(true);
    });

    it('should show error for non-HTTPS URL', () => {
        const invalidBackend: BackendConfig = {
            ...validBackend,
            url: 'http://api.example.com', // Invalid: HTTP not HTTPS
        };

        const wrapper = shallow(
            <BackendForm
                backend={invalidBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        // Blur the url field
        const urlField = wrapper.find('TextItem').at(1);
        if (urlField.prop('onBlur')) {
            urlField.prop('onBlur')({} as any);
        }

        wrapper.update();

        // Check hasError prop is set for non-HTTPS URL
        const urlFieldAfterBlur = wrapper.find('TextItem').at(1);
        expect(urlFieldAfterBlur.prop('hasError')).toBe(true);
    });

    it('should show error for invalid poll interval', () => {
        const invalidBackend: BackendConfig = {
            ...validBackend,
            pollIntervalSeconds: 5, // Invalid: below minimum of 10
        };

        const wrapper = shallow(
            <BackendForm
                backend={invalidBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        // Blur the poll interval field
        const pollIntervalField = wrapper.find('TextItem').at(5);
        if (pollIntervalField.prop('onBlur')) {
            pollIntervalField.prop('onBlur')({} as any);
        }

        wrapper.update();

        // Check hasError prop is set for invalid poll interval
        const pollIntervalFieldAfterBlur = wrapper.find('TextItem').at(5);
        expect(pollIntervalFieldAfterBlur.prop('hasError')).toBe(true);
    });

    it('should handle poll interval change correctly', () => {
        const wrapper = shallow(
            <BackendForm
                backend={validBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        const pollIntervalField = wrapper.find('TextItem').at(5);
        pollIntervalField.prop('onChange')({target: {value: '60'}} as any);

        expect(mockOnChange).toHaveBeenCalledWith({
            ...validBackend,
            pollIntervalSeconds: 60,
        });
    });

    it('should show multiple errors for multiple invalid fields', () => {
        const invalidBackend: BackendConfig = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: '',
            type: 'dataminr',
            enabled: true,
            url: 'http://invalid-url.com',
            apiId: '',
            apiKey: '',
            channelId: '',
            pollIntervalSeconds: 5,
        };

        const wrapper = shallow(
            <BackendForm
                backend={invalidBackend}
                allBackends={[]}
                onChange={mockOnChange}
            />,
        );

        // Blur all fields
        wrapper.find('TextItem').forEach((field) => {
            if (field.prop('onBlur')) {
                field.prop('onBlur')({} as any);
            }
        });

        wrapper.update();

        // Should have multiple fields with errors
        let errorCount = 0;
        wrapper.find('TextItem').forEach((field) => {
            if (field.prop('hasError')) {
                errorCount++;
            }
        });
        expect(errorCount).toBeGreaterThan(1);
    });
});
