// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import styled from 'styled-components';

import BackendList from './BackendList';
import NoBackendsPage from './NoBackendsPage';
import type {BackendConfig} from './types';
import {useBackendStatus} from './useBackendStatus';
import {validateBackendConfig, hasValidationErrors, type ValidationErrors} from './validation';

type Props = {
    id: string;
    label: string;
    helpText: React.ReactNode;
    value: BackendConfig[];
    disabled: boolean;
    config?: any;
    currentState?: any;
    license?: any;
    setByEnv: boolean;
    onChange: (id: string, value: any) => void;
    setSaveNeeded: () => void;
    registerSaveAction?: (action: () => Promise<{error?: {message?: string}}>) => void;
    unRegisterSaveAction?: (action: () => Promise<{error?: {message?: string}}>) => void;
};

const BackendSettings = (props: Props) => {
    const backends = props.value || [];
    const {statusMap} = useBackendStatus();

    // Validation errors shown after save attempt
    const [validationErrors, setValidationErrors] = useState<Record<string, ValidationErrors>>({});

    const handleBackendsChange = (newBackends: BackendConfig[]) => {
        props.onChange(props.id, newBackends);
        props.setSaveNeeded();

        // Clear validation errors when user makes changes
        setValidationErrors({});
    };

    // Register save action for validation
    useEffect(() => {
        if (!props.registerSaveAction || !props.unRegisterSaveAction) {
            return undefined;
        }

        const saveAction = async () => {
            // Validate all backends
            const errors: Record<string, ValidationErrors> = {};
            let hasErrors = false;

            backends.forEach((backend) => {
                const backendErrors = validateBackendConfig(backend, backends);
                if (hasValidationErrors(backendErrors)) {
                    errors[backend.id] = backendErrors;
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                setValidationErrors(errors);
                return {error: {message: 'Please fix validation errors before saving'}};
            }

            // All validations passed
            return {};
        };

        props.registerSaveAction(saveAction);
        return () => props.unRegisterSaveAction(saveAction);
    }, [backends, props.registerSaveAction, props.unRegisterSaveAction]);

    const handleAddBackend = () => {
        const id = crypto.randomUUID();
        const newBackend: BackendConfig = {
            id,
            name: '',
            type: 'dataminr',
            enabled: true,
            url: 'https://firstalert-api.dataminr.com',
            apiId: '',
            apiKey: '',
            channelId: '',
            pollIntervalSeconds: 30,
        };
        handleBackendsChange([...backends, newBackend]);
    };

    // Empty state: no backends configured
    if (backends.length === 0) {
        return (
            <Container>
                <NoBackendsPage onAddBackendPressed={handleAddBackend}/>
            </Container>
        );
    }

    // Render backends list
    return (
        <Container>
            <BackendList
                backends={backends}
                statusMap={statusMap}
                onChange={handleBackendsChange}
                validationErrors={validationErrors}
            />
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

export default BackendSettings;
