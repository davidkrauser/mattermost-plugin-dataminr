// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import BackendList from './BackendList';
import NoBackendsPage from './NoBackendsPage';
import type {BackendConfig} from './types';

type Props = {
    id: string;
    label: string;
    helpText: React.ReactNode;
    value: BackendConfig[];
    disabled: boolean;
    config: any;
    currentState: any;
    license: any;
    setByEnv: boolean;
    onChange: (id: string, value: any) => void;
    setSaveNeeded: () => void;
    registerSaveAction: (action: () => Promise<{error?: {message?: string}}>) => void;
    unRegisterSaveAction: (action: () => Promise<{error?: {message?: string}}>) => void;
};

const BackendSettings = (props: Props) => {
    const backends = props.value || [];

    const handleBackendsChange = (newBackends: BackendConfig[]) => {
        props.onChange(props.id, newBackends);
        props.setSaveNeeded();
    };

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
                onChange={handleBackendsChange}
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
