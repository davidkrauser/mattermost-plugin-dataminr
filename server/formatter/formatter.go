package formatter

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-dataminr/server/backend"
)

// Alert type colors
const (
	ColorFlash   = "#FF0000" // Red 🔴
	ColorUrgent  = "#FF9900" // Orange 🟠
	ColorAlert   = "#FFFF00" // Yellow 🟡
	ColorUnknown = "#808080" // Gray ⚪
)

// Alert type emojis
const (
	EmojiFlash   = "🔴"
	EmojiUrgent  = "🟠"
	EmojiAlert   = "🟡"
	EmojiUnknown = "⚪"
)

// FormatAlert converts a normalized backend.Alert into a Mattermost SlackAttachment
// with rich formatting including color coding, embedded media, and structured fields.
func FormatAlert(alert backend.Alert) *model.SlackAttachment {
	attachment := &model.SlackAttachment{}

	// Set pretext: Emoji + Alert Type (uppercase)
	emoji := getAlertEmoji(alert.AlertType)
	attachment.Pretext = fmt.Sprintf("%s %s", emoji, strings.ToUpper(alert.AlertType))

	// Set title with optional link
	attachment.Title = alert.Headline
	if alert.AlertURL != "" {
		attachment.TitleLink = alert.AlertURL
	}

	// Set color based on alert type
	attachment.Color = getAlertColor(alert.AlertType)

	// Build fields in order
	var fields []*model.SlackAttachmentField

	// 1. Alert Type + Event Time (side by side)
	fields = append(fields,
		&model.SlackAttachmentField{
			Title: "Alert Type",
			Value: alert.AlertType,
			Short: true,
		},
		&model.SlackAttachmentField{
			Title: "Event Time",
			Value: formatTime(alert.EventTime),
			Short: true,
		},
	)

	// 2. Additional Context (sub-headline if available)
	if alert.SubHeadline != "" {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Additional Context",
			Value: alert.SubHeadline,
			Short: false,
		})
	}

	// 3. Location (address, coordinates, confidence radius)
	if alert.Location != nil && alert.Location.Address != "" {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Location",
			Value: formatLocation(alert.Location),
			Short: false,
		})
	}

	// 4. Topics (bulleted list, short field)
	if len(alert.Topics) > 0 {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Topics",
			Value: formatBulletList(alert.Topics),
			Short: true,
		})
	}

	// 5. Alert Lists (bulleted list, short field)
	if len(alert.AlertLists) > 0 {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Alert Lists",
			Value: formatBulletList(alert.AlertLists),
			Short: true,
		})
	}

	// 6. Related Alerts count (if linked alerts exist)
	if len(alert.LinkedAlerts) > 0 {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Related Alerts",
			Value: fmt.Sprintf("%d linked alert(s)", len(alert.LinkedAlerts)),
			Short: false,
		})
	}

	// 7. Public Source link
	if alert.PublicSourceURL != "" {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Public Source",
			Value: fmt.Sprintf("[View Source](%s)", alert.PublicSourceURL),
			Short: false,
		})
	}

	// 8. Original Source Text (truncate at 500 chars)
	if alert.SourceText != "" {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Original Source Text",
			Value: truncateText(alert.SourceText, 500),
			Short: false,
		})
	}

	// 9. Translated Text (truncate at 500 chars)
	if alert.TranslatedText != "" {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Translated Text",
			Value: truncateText(alert.TranslatedText, 500),
			Short: false,
		})
	}

	// 10. Additional Media (links to media 2-4)
	if len(alert.MediaURLs) > 1 {
		additionalMedia := alert.MediaURLs[1:]
		if len(additionalMedia) > 3 {
			additionalMedia = additionalMedia[:3] // Limit to 3 additional media
		}
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Additional Media",
			Value: formatMediaLinks(additionalMedia),
			Short: false,
		})
	}

	attachment.Fields = fields

	// Set image URL: First media item embedded
	if len(alert.MediaURLs) > 0 {
		attachment.ImageURL = alert.MediaURLs[0]
	}

	// Set footer: Backend name + Alert ID
	attachment.Footer = fmt.Sprintf("%s | Alert ID: %s", alert.BackendName, alert.AlertID)

	return attachment
}

// getAlertColor returns the color code for an alert type
func getAlertColor(alertType string) string {
	switch strings.ToLower(alertType) {
	case "flash":
		return ColorFlash
	case "urgent":
		return ColorUrgent
	case "alert":
		return ColorAlert
	default:
		return ColorUnknown
	}
}

// getAlertEmoji returns the emoji for an alert type
func getAlertEmoji(alertType string) string {
	switch strings.ToLower(alertType) {
	case "flash":
		return EmojiFlash
	case "urgent":
		return EmojiUrgent
	case "alert":
		return EmojiAlert
	default:
		return EmojiUnknown
	}
}

// formatTime formats a time.Time to a readable string
func formatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05 MST")
}

// formatLocation formats a Location struct to a readable string
func formatLocation(loc *backend.Location) string {
	parts := []string{}

	if loc.Address != "" {
		parts = append(parts, loc.Address)
	}

	if loc.Latitude != 0 || loc.Longitude != 0 {
		parts = append(parts, fmt.Sprintf("(%.6f, %.6f)", loc.Latitude, loc.Longitude))
	}

	if loc.ConfidenceRadius > 0 {
		parts = append(parts, fmt.Sprintf("±%.0fm", loc.ConfidenceRadius))
	}

	return strings.Join(parts, " ")
}

// formatBulletList formats a slice of strings as a bulleted list
func formatBulletList(items []string) string {
	bullets := make([]string, len(items))
	for i, item := range items {
		bullets[i] = fmt.Sprintf("• %s", item)
	}
	return strings.Join(bullets, "\n")
}

// truncateText truncates text to maxLen characters, adding "..." if truncated
func truncateText(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen] + "..."
}

// formatMediaLinks formats media URLs as markdown links
func formatMediaLinks(urls []string) string {
	links := make([]string, len(urls))
	for i, url := range urls {
		links[i] = fmt.Sprintf("[Media %d](%s)", i+2, url) // Start at 2 since first media is embedded
	}
	return strings.Join(links, " | ")
}
