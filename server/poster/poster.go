package poster

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
	"github.com/mattermost/mattermost-plugin-dataminr/server/formatter"
)

// PostAlert posts a formatted alert to a Mattermost channel.
// This is a stateless function that creates a post with a SlackAttachment.
//
// Parameters:
//   - api: The Mattermost plugin API
//   - botID: The bot user ID to post as
//   - alert: The normalized alert to post
//   - channelID: The target channel ID
//
// Returns an error if posting fails. Errors should be logged by the caller.
func PostAlert(api plugin.API, botID string, alert backend.Alert, channelID string) error {
	// Format alert to attachment
	attachment := formatter.FormatAlert(alert)

	// Create post with attachment
	post := &model.Post{
		UserId:    botID,
		ChannelId: channelID,
		Type:      model.PostTypeSlackAttachment,
		Props:     model.StringInterface{},
	}

	// Add attachment to post props
	model.ParseSlackAttachment(post, []*model.SlackAttachment{attachment})

	// Post to channel
	_, err := api.CreatePost(post)
	if err != nil {
		return err
	}

	return nil
}
