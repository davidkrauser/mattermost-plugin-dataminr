package poster

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
	"github.com/mattermost/mattermost-plugin-dataminr/server/formatter"
)

// Poster posts alerts to Mattermost channels.
// This struct is stateless - it only holds immutable configuration (API and botID).
type Poster struct {
	api   plugin.API
	botID string
}

// New creates a new Poster instance.
func New(api plugin.API, botID string) *Poster {
	return &Poster{
		api:   api,
		botID: botID,
	}
}

// PostAlert posts a formatted alert to a Mattermost channel.
// Creates a post with a SlackAttachment containing the alert data.
//
// Parameters:
//   - alert: The normalized alert to post
//   - channelID: The target channel ID
//
// Returns an error if posting fails. Errors should be logged by the caller.
func (p *Poster) PostAlert(alert backend.Alert, channelID string) error {
	// Format alert to attachment
	attachment := formatter.FormatAlert(alert)

	// Create post with attachment
	post := &model.Post{
		UserId:    p.botID,
		ChannelId: channelID,
		Type:      model.PostTypeSlackAttachment,
		Props:     model.StringInterface{},
	}

	// Add attachment to post props
	model.ParseSlackAttachment(post, []*model.SlackAttachment{attachment})

	// Post to channel
	_, err := p.api.CreatePost(post)
	if err != nil {
		return err
	}

	return nil
}
