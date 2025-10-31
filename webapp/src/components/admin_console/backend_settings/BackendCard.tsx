// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {TrashCanOutlineIcon, ChevronDownIcon, ChevronUpIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';

import {ButtonIcon} from './buttons';
import {GrayPill, SuccessPill, WarningPill, DangerPill} from './pill';
import type {BackendConfig, BackendDisplay, StatusIndicator} from './types';

type Props = {
    backend: BackendDisplay;
    onChange: (backend: BackendConfig) => void;
    onDelete: () => void;
};

const StatusPill = ({indicator}: {indicator: StatusIndicator}) => {
    switch (indicator) {
    case 'active':
        return <SuccessPill>{'ACTIVE'}</SuccessPill>;
    case 'warning':
        return <WarningPill>{'WARNING'}</WarningPill>;
    case 'disabled':
        return <DangerPill>{'DISABLED'}</DangerPill>;
    case 'unknown':
    default:
        return <GrayPill>{'UNKNOWN'}</GrayPill>;
    }
};

const BackendCard = (props: Props) => {
    const [open, setOpen] = useState(false);

    return (
        <BackendContainer>
            <HeaderContainer onClick={() => setOpen((o) => !o)}>
                <StyledAlertIcon/>
                <Title>
                    <NameText>
                        {props.backend.name || '(Unnamed Backend)'}
                    </NameText>
                    <VerticalDivider/>
                    <TypeText>
                        {props.backend.type}
                    </TypeText>
                </Title>
                <Spacer/>
                <StatusPill indicator={props.backend.statusIndicator}/>
                <ButtonIcon
                    onClick={(e) => {
                        e.stopPropagation();
                        props.onDelete();
                    }}
                >
                    <TrashIcon/>
                </ButtonIcon>
                {open ? <ChevronUpIcon/> : <ChevronDownIcon/>}
            </HeaderContainer>
            {open && (
                <ContentContainer>
                    <PlaceholderText>
                        {'Backend configuration form will be implemented in Phase 16'}
                    </PlaceholderText>
                    <SectionTitle>{'Configuration'}</SectionTitle>
                    <InfoList>
                        <InfoItem><strong>{'ID:'}</strong> {props.backend.id}</InfoItem>
                        <InfoItem><strong>{'Name:'}</strong> {props.backend.name}</InfoItem>
                        <InfoItem><strong>{'Type:'}</strong> {props.backend.type}</InfoItem>
                        <InfoItem><strong>{'URL:'}</strong> {props.backend.url}</InfoItem>
                        <InfoItem><strong>{'Channel ID:'}</strong> {props.backend.channelId}</InfoItem>
                        <InfoItem><strong>{'Poll Interval:'}</strong> {props.backend.pollIntervalSeconds}{'s'}</InfoItem>
                        <InfoItem><strong>{'Enabled:'}</strong> {props.backend.enabled ? 'Yes' : 'No'}</InfoItem>
                    </InfoList>

                    {props.backend.status && (
                        <>
                            <SectionTitle>{'Status'}</SectionTitle>
                            <InfoList>
                                <InfoItem>
                                    <strong>{'Consecutive Failures:'}</strong> {props.backend.status.consecutiveFailures}
                                </InfoItem>
                                <InfoItem>
                                    <strong>{'Authenticated:'}</strong> {props.backend.status.isAuthenticated ? 'Yes' : 'No'}
                                </InfoItem>
                                {props.backend.status.lastPollTime && (
                                    <InfoItem>
                                        <strong>{'Last Poll:'}</strong> {new Date(props.backend.status.lastPollTime).toLocaleString()}
                                    </InfoItem>
                                )}
                                {props.backend.status.lastSuccessTime && (
                                    <InfoItem>
                                        <strong>{'Last Success:'}</strong> {new Date(props.backend.status.lastSuccessTime).toLocaleString()}
                                    </InfoItem>
                                )}
                                {props.backend.status.lastError && (
                                    <InfoItem>
                                        <ErrorLabel>{'Last Error:'}</ErrorLabel>
                                        <ErrorText>{props.backend.status.lastError}</ErrorText>
                                    </InfoItem>
                                )}
                            </InfoList>
                        </>
                    )}
                </ContentContainer>
            )}
        </BackendContainer>
    );
};

const BackendContainer = styled.div`
    display: flex;
    flex-direction: column;

    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);

    &:hover {
        box-shadow: 0px 2px 3px 0px rgba(0, 0, 0, 0.08);
    }
`;

const HeaderContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 16px 12px 20px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    cursor: pointer;
    background-color: rgba(var(--center-channel-color-rgb), 0.02);

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const StyledAlertIcon = styled(AlertOutlineIcon)`
    width: 24px;
    height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Title = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
`;

const NameText = styled.div`
    font-size: 14px;
    font-weight: 600;
`;

const TypeText = styled.div`
    font-size: 14px;
    font-weight: 400;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Spacer = styled.div`
    flex-grow: 1;
`;

const TrashIcon = styled(TrashCanOutlineIcon)`
    width: 16px;
    height: 16px;
    color: #D24B4E;
`;

const VerticalDivider = styled.div`
    width: 1px;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    height: 24px;
`;

const ContentContainer = styled.div`
    padding: 24px 20px;
`;

const PlaceholderText = styled.div`
    font-size: 14px;
    font-style: italic;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-bottom: 16px;
`;

const InfoList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const InfoItem = styled.div`
    font-size: 13px;
    line-height: 20px;
`;

const SectionTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    margin-top: 16px;
    margin-bottom: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ErrorLabel = styled.strong`
    color: var(--error-text);
`;

const ErrorText = styled.span`
    color: var(--error-text);
    word-break: break-word;
`;

export default BackendCard;
