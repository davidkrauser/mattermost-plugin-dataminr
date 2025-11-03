// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import type {StylesConfig} from 'react-select';
import AsyncSelect from 'react-select/async';
import styled from 'styled-components';

import {LockIcon, GlobeIcon} from '@mattermost/compass-icons/components';
import type {ChannelType, ChannelWithTeamData} from '@mattermost/types/channels';

import {HelpText} from './form_fields';

import {searchAllChannels, getChannelById} from '../../../client';

type ChannelOption = {
    value: string;
    label: string;
    type: ChannelType;
    teamName: string;
};

type ChannelSelectorProps = {
    channelId: string;
    onChangeChannelId: (channelId: string) => void;
    onBlur?: () => void;
    hasError?: boolean;
    helptext?: string;
};

const LabelContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
`;

const ChannelName = styled.span`
    font-weight: 600;
`;

const TeamName = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: normal;
    margin-left: 5px;
`;

const ChannelIcon = styled.span`
    margin-right: 8px;
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const SelectContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

export const ChannelSelector = (props: ChannelSelectorProps) => {
    const [selectedOption, setSelectedOption] = useState<ChannelOption | null>(null);

    useEffect(() => {
        const loadSelectedOption = async () => {
            if (props.channelId) {
                try {
                    const channel = await getChannelById(props.channelId);
                    const option: ChannelOption = {
                        value: channel.id,
                        label: channel.display_name,
                        type: channel.type,
                        teamName: channel.team_display_name,
                    };
                    setSelectedOption(option);
                } catch (error) {
                    // If channel cannot be loaded (deleted, no access), clear selection
                    setSelectedOption(null);
                }
            } else {
                setSelectedOption(null);
            }
        };
        loadSelectedOption();
    }, [props.channelId]);

    const loadOptions = async (inputValue: string): Promise<ChannelOption[]> => {
        try {
            const channels = await searchAllChannels(inputValue);
            return channels.map((channel: ChannelWithTeamData) => ({
                value: channel.id,
                label: channel.display_name,
                type: channel.type,
                teamName: channel.team_display_name,
            }));
        } catch (error) {
            // Return empty array on error
            return [];
        }
    };

    const formatOptionLabel = (option: ChannelOption) => (
        <LabelContainer>
            <ChannelIcon>
                {option.type === 'O' ? <GlobeIcon size={16}/> : <LockIcon size={16}/>}
            </ChannelIcon>
            <ChannelName>{option.label}</ChannelName>
            {option.teamName && (
                <TeamName>
                    {'('}{option.teamName}{')'}
                </TeamName>
            )}
        </LabelContainer>
    );

    const selectStyles: StylesConfig<ChannelOption, false> = {
        control: (base, state) => {
            let borderColor = 'rgba(var(--center-channel-color-rgb), 0.16)';
            if (props.hasError) {
                borderColor = 'var(--error-text)';
            } else if (state.isFocused) {
                borderColor = '#66afe9';
            }

            let boxShadow = '0px 1px 1px rgba(0, 0, 0, 0.075) inset';
            if (props.hasError && state.isFocused) {
                boxShadow = 'inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(210, 75, 78, 0.5)';
            } else if (!props.hasError && state.isFocused) {
                boxShadow = 'inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(102, 175, 233, 0.75)';
            }

            return {
                ...base,
                borderRadius: '2px',
                borderColor,
                boxShadow,
                minHeight: '35px',
                '&:hover': {
                    borderColor,
                },
            };
        },
        valueContainer: (base) => ({
            ...base,
            padding: '2px 12px',
        }),
        input: (base) => ({
            ...base,
            margin: '0',
            padding: '0',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
    };

    const handleChange = (newValue: ChannelOption | null) => {
        props.onChangeChannelId(newValue?.value || '');
    };

    return (
        <SelectContainer>
            <AsyncSelect<ChannelOption, false>
                value={selectedOption}
                onChange={handleChange}
                onBlur={props.onBlur}
                loadOptions={loadOptions}
                formatOptionLabel={formatOptionLabel}
                placeholder='Search for a channel...'
                styles={selectStyles}
                defaultOptions={true}
                isClearable={false}
                isSearchable={true}
            />
            {props.helptext && <HelpText>{props.helptext}</HelpText>}
        </SelectContainer>
    );
};
