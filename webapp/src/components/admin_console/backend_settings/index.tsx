// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {PlusIcon} from '@mattermost/compass-icons/components';

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

    // Empty state: no backends configured
    if (backends.length === 0) {
        return (
            <Container>
                <EmptyStateContainer>
                    <EmptyStateTitle>
                        <FormattedMessage defaultMessage='No backends configured'/>
                    </EmptyStateTitle>
                    <EmptyStateDescription>
                        <FormattedMessage defaultMessage='Configure alert backends to monitor. Each backend independently polls its API and posts alerts to a designated channel.'/>
                    </EmptyStateDescription>
                    <AddButton onClick={() => {}}>
                        <PlusIconStyled/>
                        <FormattedMessage defaultMessage='Add Backend'/>
                    </AddButton>
                </EmptyStateContainer>
            </Container>
        );
    }

    // Placeholder for when backends exist (will be implemented in later phases)
    return (
        <Container>
            <FormattedMessage defaultMessage='Backends list will be displayed here'/>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const EmptyStateContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
`;

const EmptyStateTitle = styled.h3`
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const EmptyStateDescription = styled.p`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    margin: 0 0 24px 0;
    max-width: 500px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const AddButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--button-bg);
    color: var(--button-color);
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
        background: linear-gradient(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.08)), var(--button-bg);
    }

    &:active {
        background: linear-gradient(rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.16)), var(--button-bg);
    }
`;

const PlusIconStyled = styled(PlusIcon)`
    width: 18px;
    height: 18px;
`;

export default BackendSettings;
