// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import styled from 'styled-components';

import {ChannelSelector} from './ChannelSelector';
import {DefaultPollIntervalSeconds, MinPollIntervalSeconds, SupportedBackendTypes} from './constants';
import {BooleanItem, ItemLabel, ItemList, SelectionItem, SelectionItemOption, TextItem} from './form_fields';
import type {BackendConfig, BackendDisplay} from './types';
import {validateBackendConfig, type ValidationErrors} from './validation';

type Props = {
    backend: BackendDisplay;
    allBackends: BackendConfig[];
    onChange: (backend: BackendConfig) => void;
};

// Helper to determine if backend was auto-disabled by server
const isAutoDisabledByServer = (backend: BackendDisplay): boolean => {
    return Boolean(backend.status &&
                   backend.status.enabled === false &&
                   (backend.status.consecutiveFailures > 0 || backend.status.lastError));
};

const BackendForm = (props: Props) => {
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touchedFields, setTouchedFields] = useState<Set<keyof BackendConfig>>(new Set());

    // Track if backend was auto-disabled by the server
    const wasAutoDisabledByServer = isAutoDisabledByServer(props.backend);

    // Initialize sync flag based on current state
    // If already auto-disabled on mount, mark it as synced so we don't override user re-enable attempts
    const [serverDisableAlreadySynced, setServerDisableAlreadySynced] = useState(() => {
        return isAutoDisabledByServer(props.backend) && !props.backend.enabled;
    });

    // Sync form field when backend is auto-disabled by server (only once)
    // Only update if form shows enabled but server says disabled
    useEffect(() => {
        if (wasAutoDisabledByServer && props.backend.enabled && !serverDisableAlreadySynced) {
            const updatedBackend = {...props.backend, enabled: false};
            props.onChange(updatedBackend);
            setServerDisableAlreadySynced(true);
        }
    }, [wasAutoDisabledByServer, props.backend.enabled, serverDisableAlreadySynced]);

    // Reset the sync flag when backend is re-enabled and status is cleared or shows enabled
    useEffect(() => {
        if (props.backend.enabled && serverDisableAlreadySynced) {
            // If status is cleared (undefined) or shows enabled, reset the flag
            if (!props.backend.status || props.backend.status.enabled === true) {
                setServerDisableAlreadySynced(false);
            }
        }
    }, [props.backend.enabled, props.backend.status, serverDisableAlreadySynced]);

    const handleFieldChange = (field: keyof BackendConfig, value: any) => {
        const updatedBackend = {...props.backend, [field]: value};
        props.onChange(updatedBackend);
    };

    const handleFieldBlur = (field: keyof BackendConfig) => {
        // Mark field as touched
        setTouchedFields((prev) => new Set(prev).add(field));

        // Validate the entire config (so we can check for duplicate names, etc.)
        const validationErrors = validateBackendConfig(props.backend, props.allBackends);
        setErrors(validationErrors);
    };

    // Only show errors for fields that have been touched
    const getFieldError = (field: keyof BackendConfig): string | undefined => {
        if (touchedFields.has(field)) {
            return errors[field as keyof ValidationErrors];
        }
        return undefined;
    };

    return (
        <FormContainer>
            <ItemList>
                <TextItem
                    label='Name'
                    value={props.backend.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleFieldBlur('name')}
                    placeholder='e.g., Production Alerts'
                    helptext='Display name for this backend (must be unique)'
                    hasError={Boolean(getFieldError('name'))}
                />
                {getFieldError('name') && <ErrorMessage>{getFieldError('name')}</ErrorMessage>}

                <BooleanItem
                    label='Enabled'
                    value={props.backend.enabled}
                    onChange={(value) => handleFieldChange('enabled', value)}
                    helpText='Whether this backend is active and polling for alerts'
                />
                {wasAutoDisabledByServer && !props.backend.enabled && (
                    <ErrorMessage>
                        {'This backend was automatically disabled due to consecutive failures. Please check the configuration and re-enable when ready.'}
                    </ErrorMessage>
                )}

                <SelectionItem
                    label='Type'
                    value={props.backend.type}
                    onChange={(e) => handleFieldChange('type', e.target.value)}
                    helptext='Backend type (currently only Dataminr is supported)'
                >
                    {SupportedBackendTypes.map((type) => (
                        <SelectionItemOption
                            key={type}
                            value={type}
                        >
                            {type}
                        </SelectionItemOption>
                    ))}
                </SelectionItem>
                {getFieldError('type') && <ErrorMessage>{getFieldError('type')}</ErrorMessage>}

                <TextItem
                    label='API URL'
                    value={props.backend.url}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    onBlur={() => handleFieldBlur('url')}
                    placeholder='https://firstalert-api.dataminr.com'
                    helptext='Base URL for the Dataminr API (must use HTTPS)'
                    hasError={Boolean(getFieldError('url'))}
                />
                {getFieldError('url') && <ErrorMessage>{getFieldError('url')}</ErrorMessage>}

                <TextItem
                    label='API ID'
                    value={props.backend.apiId}
                    onChange={(e) => handleFieldChange('apiId', e.target.value)}
                    onBlur={() => handleFieldBlur('apiId')}
                    placeholder='your_api_id'
                    helptext='API user ID for authentication'
                    hasError={Boolean(getFieldError('apiId'))}
                />
                {getFieldError('apiId') && <ErrorMessage>{getFieldError('apiId')}</ErrorMessage>}

                <TextItem
                    label='API Key'
                    value={props.backend.apiKey}
                    type='password'
                    onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                    onBlur={() => handleFieldBlur('apiKey')}
                    placeholder='your_api_key'
                    helptext='API key/password for authentication'
                    hasError={Boolean(getFieldError('apiKey'))}
                />
                {getFieldError('apiKey') && <ErrorMessage>{getFieldError('apiKey')}</ErrorMessage>}

                <ItemLabel>{'Channel'}</ItemLabel>
                <ChannelSelector
                    channelId={props.backend.channelId}
                    onChangeChannelId={(channelId) => handleFieldChange('channelId', channelId)}
                    onBlur={() => handleFieldBlur('channelId')}
                    hasError={Boolean(getFieldError('channelId'))}
                    helptext='Mattermost channel where alerts will be posted'
                />
                {getFieldError('channelId') && <ErrorMessage>{getFieldError('channelId')}</ErrorMessage>}

                <TextItem
                    label='Poll Interval (seconds)'
                    value={String(props.backend.pollIntervalSeconds)}
                    type='number'
                    min={String(MinPollIntervalSeconds)}
                    onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value)) {
                            handleFieldChange('pollIntervalSeconds', value);
                        }
                    }}
                    onBlur={() => handleFieldBlur('pollIntervalSeconds')}
                    placeholder={String(DefaultPollIntervalSeconds)}
                    helptext={`How often to poll for new alerts (minimum ${MinPollIntervalSeconds} seconds)`}
                    hasError={Boolean(getFieldError('pollIntervalSeconds'))}
                />
                {getFieldError('pollIntervalSeconds') && <ErrorMessage>{getFieldError('pollIntervalSeconds')}</ErrorMessage>}
            </ItemList>
        </FormContainer>
    );
};

const FormContainer = styled.div`
    padding: 20px 0;
`;

const ErrorMessage = styled.div`
    grid-column: 2;
    color: var(--error-text);
    font-size: 12px;
    line-height: 16px;
    margin-top: -16px;
    margin-bottom: 8px;
`;

export default BackendForm;
