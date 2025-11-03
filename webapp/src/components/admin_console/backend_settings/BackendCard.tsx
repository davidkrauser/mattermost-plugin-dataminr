// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import styled from 'styled-components';

import {TrashCanOutlineIcon, ChevronDownIcon, ChevronUpIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';

import BackendForm from './BackendForm';
import {ButtonIcon} from './buttons';
import ConfirmationDialog from './ConfirmationDialog';
import {GrayPill, SuccessPill, WarningPill, DangerPill} from './pill';
import type {BackendConfig, BackendDisplay, StatusIndicator} from './types';
import {StatusIndicator as StatusIndicatorEnum} from './types';
import type {ValidationErrors} from './validation';

type Props = {
    backend: BackendDisplay;
    allBackends: BackendConfig[];
    onChange: (backend: BackendConfig) => void;
    onDelete: () => void;
    validationErrors?: ValidationErrors;
};

const StatusPill = ({indicator, status}: {indicator: StatusIndicator; status?: BackendDisplay['status']}) => {
    let tooltip: string | undefined;

    if (indicator === 'active' && status?.lastSuccessTime) {
        tooltip = `Last successful poll: ${new Date(status.lastSuccessTime).toLocaleString()}`;
    } else if ((indicator === 'warning' || indicator === 'error') && status?.lastError) {
        tooltip = status.lastError;
    }

    switch (indicator) {
    case 'active':
        return <SuccessPill title={tooltip}>{'ACTIVE'}</SuccessPill>;
    case 'warning':
        return <WarningPill title={tooltip}>{'WARNING'}</WarningPill>;
    case 'disabled':
        return <GrayPill>{'DISABLED'}</GrayPill>;
    case 'error':
        return <DangerPill title={tooltip}>{'ERROR'}</DangerPill>;
    case 'unknown':
    default:
        return <GrayPill>{'UNKNOWN'}</GrayPill>;
    }
};

const BackendCard = (props: Props) => {
    const [open, setOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [statusOverride, setStatusOverride] = useState<StatusIndicator | null>(null);

    const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        props.onDelete();
        setShowDeleteConfirm(false);
    };

    const handleChange = (backend: BackendConfig) => {
        // If backend was just re-enabled, override status to Unknown until next status poll
        if (backend.enabled && !props.backend.enabled) {
            setStatusOverride(StatusIndicatorEnum.Unknown);
        }
        props.onChange(backend);
    };

    // Clear status override when we get fresh status data showing backend is enabled
    // This means the server has processed the re-enable and we can trust the status
    useEffect(() => {
        if (statusOverride !== null && props.backend.status && props.backend.status.enabled) {
            setStatusOverride(null);
        }
    }, [statusOverride, props.backend.status]);

    const hasValidationErrors = props.validationErrors && Object.keys(props.validationErrors).length > 0;
    const displayIndicator = statusOverride ?? props.backend.statusIndicator;

    return (
        <>
            <BackendContainer>
                <HeaderContainer onClick={() => setOpen((o) => !o)}>
                    <Title>
                        <NameText>
                            {props.backend.name || '(Unnamed Backend)'}
                        </NameText>
                        <VerticalDivider/>
                        <TypeText>
                            {props.backend.type}
                        </TypeText>
                    </Title>
                    {hasValidationErrors && <StyledAlertIcon/>}
                    <Spacer/>
                    {displayIndicator !== StatusIndicatorEnum.Unknown && (
                        <StatusPill
                            indicator={displayIndicator}
                            status={props.backend.status}
                        />
                    )}
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
                        <BackendForm
                            backend={props.backend}
                            allBackends={props.allBackends}
                            onChange={handleChange}
                        />
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

const StyledAlertIcon = styled(AlertOutlineIcon)`
    width: 24px;
    height: 24px;
    color: var(--error-text);
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
