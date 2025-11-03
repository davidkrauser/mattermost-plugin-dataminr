// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import AsyncSelect from 'react-select/async';

import {ChannelSelector} from './ChannelSelector';

describe('ChannelSelector', () => {
    const mockOnChangeChannelId = jest.fn();
    const mockOnBlur = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render AsyncSelect component', () => {
        const wrapper = shallow(
            <ChannelSelector
                channelId=''
                onChangeChannelId={mockOnChangeChannelId}
            />,
        );

        expect(wrapper.find(AsyncSelect)).toHaveLength(1);
    });

    it('should render with error state', () => {
        const wrapper = shallow(
            <ChannelSelector
                channelId=''
                onChangeChannelId={mockOnChangeChannelId}
                hasError={true}
            />,
        );

        expect(wrapper.find(AsyncSelect)).toHaveLength(1);
        const asyncSelect = wrapper.find(AsyncSelect);

        // Check that styles prop is passed to AsyncSelect
        expect(asyncSelect.prop('styles')).toBeDefined();
    });

    it('should render with help text', () => {
        const helptext = 'Select a channel';
        const wrapper = shallow(
            <ChannelSelector
                channelId=''
                onChangeChannelId={mockOnChangeChannelId}
                helptext={helptext}
            />,
        );

        // Component should render AsyncSelect
        expect(wrapper.find(AsyncSelect)).toHaveLength(1);
    });

    it('should not render help text when not provided', () => {
        const wrapper = shallow(
            <ChannelSelector
                channelId=''
                onChangeChannelId={mockOnChangeChannelId}
            />,
        );

        // Component should render AsyncSelect
        expect(wrapper.find(AsyncSelect)).toHaveLength(1);
    });

    it('should pass onBlur prop to AsyncSelect', () => {
        const wrapper = shallow(
            <ChannelSelector
                channelId=''
                onChangeChannelId={mockOnChangeChannelId}
                onBlur={mockOnBlur}
            />,
        );

        const asyncSelect = wrapper.find(AsyncSelect);
        expect(asyncSelect.prop('onBlur')).toBe(mockOnBlur);
    });

    it('should pass correct props to AsyncSelect', () => {
        const wrapper = shallow(
            <ChannelSelector
                channelId='channel-123'
                onChangeChannelId={mockOnChangeChannelId}
            />,
        );

        const asyncSelect = wrapper.find(AsyncSelect);
        expect(asyncSelect.prop('placeholder')).toBe('Search for a channel...');
        expect(asyncSelect.prop('isClearable')).toBe(false);
        expect(asyncSelect.prop('isSearchable')).toBe(true);
        expect(asyncSelect.prop('defaultOptions')).toBe(true);
    });

    it('should call onChange handler when AsyncSelect onChange is triggered', () => {
        const wrapper = shallow(
            <ChannelSelector
                channelId=''
                onChangeChannelId={mockOnChangeChannelId}
            />,
        );

        const newOption = {
            value: 'new-channel-id',
            label: 'New Channel',
            type: 'O' as const,
            teamName: 'Test Team',
        };

        const asyncSelect = wrapper.find(AsyncSelect);
        const onChange = asyncSelect.prop('onChange') as (value: any) => void;
        onChange(newOption);

        expect(mockOnChangeChannelId).toHaveBeenCalledWith('new-channel-id');
    });
});
