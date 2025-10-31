// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlusIcon} from '@mattermost/compass-icons/components';

import BackendCard from './BackendCard';
import {TertiaryButton} from './buttons';
import type {BackendConfig} from './types';

const defaultNewBackend: Omit<BackendConfig, 'id'> = {
    name: '',
    type: 'dataminr',
    enabled: true,
    url: 'https://firstalert-api.dataminr.com',
    apiId: '',
    apiKey: '',
    channelId: '',
    pollIntervalSeconds: 30,
};

type Props = {
    backends: BackendConfig[];
    onChange: (backends: BackendConfig[]) => void;
};

const BackendList = (props: Props) => {
    const addNewBackend = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const id = crypto.randomUUID();
        props.onChange([
            ...props.backends,
            {
                ...defaultNewBackend,
                id,
            },
        ]);
    };

    const onChange = (newBackend: BackendConfig) => {
        props.onChange(props.backends.map((b) => (b.id === newBackend.id ? newBackend : b)));
    };

    const onDelete = (id: string) => {
        props.onChange(props.backends.filter((b) => b.id !== id));
    };

    return (
        <>
            <BackendsListContainer>
                {props.backends.map((backend) => (
                    <BackendCard
                        key={backend.id}
                        backend={backend}
                        onChange={onChange}
                        onDelete={() => onDelete(backend.id)}
                    />
                ))}
            </BackendsListContainer>
            <TertiaryButton onClick={addNewBackend}>
                <PlusIcon/>
                {'Add Backend'}
            </TertiaryButton>
        </>
    );
};

const BackendsListContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 24px;
`;

export default BackendList;
