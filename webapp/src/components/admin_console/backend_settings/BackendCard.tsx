// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {TrashCanOutlineIcon, ChevronDownIcon, ChevronUpIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';

import BackendForm from './BackendForm';
import {ButtonIcon} from './buttons';
import ConfirmationDialog from './ConfirmationDialog';
import {GrayPill, SuccessPill, WarningPill, DangerPill} from './pill';
import type {BackendConfig, BackendDisplay, StatusIndicator} from './types';
import type {ValidationErrors} from './validation';

type Props = {
    backend: BackendDisplay;
    allBackends: BackendConfig[];
    onChange: (backend: BackendConfig) => void;
    onDelete: () => void;
    validationErrors?: ValidationErrors;
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        props.onDelete();
        setShowDeleteConfirm(false);
    };

    const hasValidationErrors = props.validationErrors && Object.keys(props.validationErrors).length > 0;

    return (
        <>
            <BackendContainer>
                <HeaderContainer onClick={() => setOpen((o) => !o)}>
                    <StyledAlertIcon $hasError={hasValidationErrors}/>
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
                    <ButtonIcon onClick={handleDeleteClick}>
                        <TrashIcon/>
                    </ButtonIcon>
                    {open ? <ChevronUpIcon/> : <ChevronDownIcon/>}
                </HeaderContainer>
                {open && (
                    <ContentContainer>
                        {props.validationErrors && Object.keys(props.validationErrors).length > 0 && (
                            <ErrorBanner>
                                <ErrorBannerTitle>{'Validation Errors'}</ErrorBannerTitle>
                                <ErrorList>
                                    {Object.entries(props.validationErrors).map(([field, error]) => (
                                        <ErrorItem key={field}>
                                            <strong>{field}{': '}</strong>{error}
                                        </ErrorItem>
                                    ))}
                                </ErrorList>
                            </ErrorBanner>
                        )}
                        <SectionTitle>{'Configuration'}</SectionTitle>
                        <BackendForm
                            backend={props.backend}
                            allBackends={props.allBackends}
                            onChange={props.onChange}
                        />

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

            {showDeleteConfirm && (
                <ConfirmationDialog
                    title={'Delete backend?'}
                    message={`This will remove the backend "${props.backend.name || '(Unnamed Backend)'}" and stop monitoring it for alerts. This action cannot be undone.`}
                    confirmButtonText={'Delete'}
                    cancelButtonText={'Cancel'}
                    onConfirm={confirmDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                    isDestructive={true}
                />
            )}
        </>
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

const StyledAlertIcon = styled(AlertOutlineIcon)<{$hasError?: boolean}>`
    width: 24px;
    height: 24px;
    color: ${(props) => (props.$hasError ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
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

const ErrorBanner = styled.div`
    background-color: rgba(var(--error-text-color-rgb, 210, 75, 78), 0.08);
    border: 1px solid var(--error-text);
    border-radius: 4px;
    padding: 12px 16px;
    margin-bottom: 16px;
`;

const ErrorBannerTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--error-text);
    margin-bottom: 8px;
`;

const ErrorList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const ErrorItem = styled.div`
    font-size: 13px;
    color: var(--error-text);
`;

export default BackendCard;
