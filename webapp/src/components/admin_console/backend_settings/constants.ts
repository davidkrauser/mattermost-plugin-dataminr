// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Minimum allowed poll interval in seconds.
 * Matches server/backend/constants.go MinPollIntervalSeconds
 */
export const MinPollIntervalSeconds = 10;

/**
 * Default recommended poll interval in seconds.
 * Matches server/backend/constants.go DefaultPollIntervalSeconds
 */
export const DefaultPollIntervalSeconds = 30;

/**
 * Supported backend types.
 * Currently only 'dataminr' is supported.
 */
export const SupportedBackendTypes = ['dataminr'] as const;

/**
 * Default Dataminr API URL
 */
export const DefaultDataminrURL = 'https://firstalert-api.dataminr.com';
