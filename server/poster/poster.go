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

// PostAlert posts a formatted alert to a Mattermost channel as two threaded posts.
// The first post contains the headline, event time, and location with color highlighting.
// The second post is a reply containing all detailed information and embedded media.
//
// Parameters:
//   - alert: The normalized alert to post
//   - channelID: The target channel ID
//
// Returns an error if the main post fails. If the reply post fails, the error is logged
// but not returned, ensuring the main alert is still delivered.
func (p *Poster) PostAlert(alert backend.Alert, channelID string) error {
	// Format main post attachment (headline, time, location, color)
	mainAttachment := formatter.FormatMainPost(alert)

	// Create main post with attachment
	mainPost := &model.Post{
		UserId:    p.botID,
		ChannelId: channelID,
		Type:      model.PostTypeSlackAttachment,
		Props:     model.StringInterface{},
	}

	// Add attachment to main post props
	model.ParseSlackAttachment(mainPost, []*model.SlackAttachment{mainAttachment})

	// Post main post to channel
	createdMainPost, err := p.api.CreatePost(mainPost)
	if err != nil {
		return err
	}

	// Format reply post attachment (detailed info, media)
	replyAttachment := formatter.FormatReplyPost(alert)

	// Create reply post threaded to main post
	replyPost := &model.Post{
		UserId:    p.botID,
		ChannelId: channelID,
		RootId:    createdMainPost.Id,
		Type:      model.PostTypeSlackAttachment,
		Props:     model.StringInterface{},
	}

	// Add attachment to reply post props
	model.ParseSlackAttachment(replyPost, []*model.SlackAttachment{replyAttachment})

	// Post reply to channel
	_, err = p.api.CreatePost(replyPost)
	if err != nil {
		// Log error but don't fail - main post was successful
		p.api.LogError("Failed to post alert reply", "error", err.Error(), "alertID", alert.AlertID)
		// Don't return error - main alert was delivered successfully
	}

	return nil
}
