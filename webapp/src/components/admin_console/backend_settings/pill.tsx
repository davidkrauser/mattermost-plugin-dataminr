// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export const Pill = styled.div`
    background: var(--button-bg, #1c58d9);
    color: white;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
`;

export const DangerPill = styled(Pill)`
    background: var(--error-text, #d24b4e);
`;

export const WarningPill = styled(Pill)`
    background: var(--away-indicator, #ffbc1f);
`;

export const SuccessPill = styled(Pill)`
    background: var(--online-indicator, #06d6a0);
`;

export const GrayPill = styled(Pill)`
    color: var(--center-channel-color, #3d3c40);
    background: rgba(var(--center-channel-color-rgb), 0.08);
`;
