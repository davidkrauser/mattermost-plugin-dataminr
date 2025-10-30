package dataminr

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/plugin"
)

// StateStore manages backend state persistence in the Mattermost KV store
// All keys are scoped to the specific backend ID for isolation
type StateStore struct {
	api       plugin.API
	backendID string // UUID of the backend this state store manages
}

// NewStateStore creates a new state store for a specific backend
func NewStateStore(api plugin.API, backendID string) *StateStore {
	return &StateStore{
		api:       api,
		backendID: backendID,
	}
}

// AuthTokenState represents stored authentication token data
type AuthTokenState struct {
	Token  string    `json:"token"`
	Expiry time.Time `json:"expiry"`
}

// SaveAuthToken stores the authentication token and its expiry time
func (s *StateStore) SaveAuthToken(token string, expiry time.Time) error {
	state := AuthTokenState{
		Token:  token,
		Expiry: expiry,
	}

	data, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("failed to marshal auth token state: %w", err)
	}

	key := fmt.Sprintf("backend_%s_auth", s.backendID)
	if err := s.api.KVSet(key, data); err != nil {
		return fmt.Errorf("failed to save auth token: %w", err)
	}

	return nil
}

// GetAuthToken retrieves the stored authentication token and expiry time
// Returns empty string and zero time if no token is stored
func (s *StateStore) GetAuthToken() (string, time.Time, error) {
	key := fmt.Sprintf("backend_%s_auth", s.backendID)
	data, err := s.api.KVGet(key)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to get auth token: %w", err)
	}

	if data == nil {
		// No token stored yet
		return "", time.Time{}, nil
	}

	var state AuthTokenState
	if err := json.Unmarshal(data, &state); err != nil {
		return "", time.Time{}, fmt.Errorf("failed to unmarshal auth token state: %w", err)
	}

	return state.Token, state.Expiry, nil
}

// SaveCursor stores the pagination cursor for the next API request
func (s *StateStore) SaveCursor(cursor string) error {
	key := fmt.Sprintf("backend_%s_cursor", s.backendID)
	if err := s.api.KVSet(key, []byte(cursor)); err != nil {
		return fmt.Errorf("failed to save cursor: %w", err)
	}
	return nil
}

// GetCursor retrieves the stored pagination cursor
// Returns empty string if no cursor is stored
func (s *StateStore) GetCursor() (string, error) {
	key := fmt.Sprintf("backend_%s_cursor", s.backendID)
	data, err := s.api.KVGet(key)
	if err != nil {
		return "", fmt.Errorf("failed to get cursor: %w", err)
	}

	if data == nil {
		return "", nil
	}

	return string(data), nil
}

// SaveLastPoll stores the timestamp of the last poll attempt
func (s *StateStore) SaveLastPoll(t time.Time) error {
	key := fmt.Sprintf("backend_%s_last_poll", s.backendID)
	data, err := json.Marshal(t)
	if err != nil {
		return fmt.Errorf("failed to marshal last poll time: %w", err)
	}

	if err := s.api.KVSet(key, data); err != nil {
		return fmt.Errorf("failed to save last poll time: %w", err)
	}

	return nil
}

// GetLastPoll retrieves the timestamp of the last poll attempt
// Returns zero time if no poll time is stored
func (s *StateStore) GetLastPoll() (time.Time, error) {
	key := fmt.Sprintf("backend_%s_last_poll", s.backendID)
	data, err := s.api.KVGet(key)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to get last poll time: %w", err)
	}

	if data == nil {
		return time.Time{}, nil
	}

	var t time.Time
	if err := json.Unmarshal(data, &t); err != nil {
		return time.Time{}, fmt.Errorf("failed to unmarshal last poll time: %w", err)
	}

	return t, nil
}

// IncrementFailures increments the consecutive failures counter and returns the new count
func (s *StateStore) IncrementFailures() (int, error) {
	count, err := s.GetFailures()
	if err != nil {
		return 0, err
	}

	count++

	key := fmt.Sprintf("backend_%s_failures", s.backendID)
	data, err := json.Marshal(count)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal failures count: %w", err)
	}

	if err := s.api.KVSet(key, data); err != nil {
		return 0, fmt.Errorf("failed to save failures count: %w", err)
	}

	return count, nil
}

// ResetFailures resets the consecutive failures counter to zero
func (s *StateStore) ResetFailures() error {
	key := fmt.Sprintf("backend_%s_failures", s.backendID)
	data, err := json.Marshal(0)
	if err != nil {
		return fmt.Errorf("failed to marshal failures count: %w", err)
	}

	if err := s.api.KVSet(key, data); err != nil {
		return fmt.Errorf("failed to reset failures count: %w", err)
	}

	return nil
}

// GetFailures retrieves the current consecutive failures count
// Returns 0 if no count is stored
func (s *StateStore) GetFailures() (int, error) {
	key := fmt.Sprintf("backend_%s_failures", s.backendID)
	data, err := s.api.KVGet(key)
	if err != nil {
		return 0, fmt.Errorf("failed to get failures count: %w", err)
	}

	if data == nil {
		return 0, nil
	}

	var count int
	if err := json.Unmarshal(data, &count); err != nil {
		return 0, fmt.Errorf("failed to unmarshal failures count: %w", err)
	}

	return count, nil
}

// SaveLastSuccess stores the timestamp of the last successful poll
func (s *StateStore) SaveLastSuccess(t time.Time) error {
	key := fmt.Sprintf("backend_%s_last_success", s.backendID)
	data, err := json.Marshal(t)
	if err != nil {
		return fmt.Errorf("failed to marshal last success time: %w", err)
	}

	if err := s.api.KVSet(key, data); err != nil {
		return fmt.Errorf("failed to save last success time: %w", err)
	}

	return nil
}

// GetLastSuccess retrieves the timestamp of the last successful poll
// Returns zero time if no success time is stored
func (s *StateStore) GetLastSuccess() (time.Time, error) {
	key := fmt.Sprintf("backend_%s_last_success", s.backendID)
	data, err := s.api.KVGet(key)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to get last success time: %w", err)
	}

	if data == nil {
		return time.Time{}, nil
	}

	var t time.Time
	if err := json.Unmarshal(data, &t); err != nil {
		return time.Time{}, fmt.Errorf("failed to unmarshal last success time: %w", err)
	}

	return t, nil
}

// SaveLastError stores the error message from the most recent failure
func (s *StateStore) SaveLastError(errMsg string) error {
	key := fmt.Sprintf("backend_%s_last_error", s.backendID)
	if err := s.api.KVSet(key, []byte(errMsg)); err != nil {
		return fmt.Errorf("failed to save last error: %w", err)
	}
	return nil
}

// GetLastError retrieves the error message from the most recent failure
// Returns empty string if no error is stored
func (s *StateStore) GetLastError() (string, error) {
	key := fmt.Sprintf("backend_%s_last_error", s.backendID)
	data, err := s.api.KVGet(key)
	if err != nil {
		return "", fmt.Errorf("failed to get last error: %w", err)
	}

	if data == nil {
		return "", nil
	}

	return string(data), nil
}

// ClearAll removes all state for this backend from the KV store
// Useful when a backend is being removed
func (s *StateStore) ClearAll() error {
	keys := []string{
		fmt.Sprintf("backend_%s_auth", s.backendID),
		fmt.Sprintf("backend_%s_cursor", s.backendID),
		fmt.Sprintf("backend_%s_last_poll", s.backendID),
		fmt.Sprintf("backend_%s_last_success", s.backendID),
		fmt.Sprintf("backend_%s_failures", s.backendID),
		fmt.Sprintf("backend_%s_last_error", s.backendID),
	}

	for _, key := range keys {
		if err := s.api.KVDelete(key); err != nil {
			return fmt.Errorf("failed to delete key %s: %w", key, err)
		}
	}

	return nil
}
