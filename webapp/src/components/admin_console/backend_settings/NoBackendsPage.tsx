// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlusIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';

import {PrimaryButton} from './buttons';

type Props = {
    onAddBackendPressed: () => void;
};

const NoBackendsPage = (props: Props) => {
    return (
        <Container>
            <StyledAlertIcon/>
            <Title>{'No backends configured yet'}</Title>
            <Subtitle>{'Add a Dataminr backend to start receiving real-time alerts in Mattermost'}</Subtitle>
            <PrimaryButton onClick={props.onAddBackendPressed}>
                <StyledPlusIcon/>
                {'Add Backend'}
            </PrimaryButton>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 56px 24px;
`;

const StyledAlertIcon = styled(AlertOutlineIcon)`
    width: 64px;
    height: 64px;
    color: rgba(var(--center-channel-color-rgb), 0.32);
`;

const StyledPlusIcon = styled(PlusIcon)`
    width: 18px;
    height: 18px;
`;

const Title = styled.div`
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    text-align: center;
`;

const Subtitle = styled.div`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    text-align: center;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    max-width: 480px;
`;

export default NoBackendsPage;
