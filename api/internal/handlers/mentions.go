package handlers

import (
	"regexp"
	"strings"
)

var mentionRe = regexp.MustCompile(`@([a-zA-Z0-9_]{3,24})`)

func extractMentions(body string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, m := range mentionRe.FindAllStringSubmatch(body, -1) {
		if len(m) < 2 {
			continue
		}
		u := strings.ToLower(m[1])
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		out = append(out, m[1])
	}
	return out
}

func (a *API) notifyMentions(body, excludeUserID, actorUsername, alertTitle, link string) {
	for _, username := range extractMentions(body) {
		user, err := a.getUserByUsername(username)
		if err != nil || user.ID == excludeUserID {
			continue
		}
		a.createAlert(user.ID, "mention", "Mention", actorUsername+" mentioned you in "+alertTitle, link)
	}
}

func (a *API) notifyThreadWatchers(threadID, slug, title, excludeUserID, actorUsername, threadAuthorID string) {
	rows, err := a.DB.Query(`
		SELECT user_id::text FROM thread_watches
		WHERE thread_id=$1 AND user_id != $2 AND user_id != $3
	`, threadID, excludeUserID, threadAuthorID)
	if err != nil {
		return
	}
	defer rows.Close()
	link := "/threads/" + slug
	msg := actorUsername + " replied in watched thread \"" + title + "\""
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) == nil && uid != "" {
			a.createAlert(uid, "reply", "Watched thread", msg, link)
		}
	}
}

func (a *API) threadWatchStatus(userID, threadID string) bool {
	if userID == "" || threadID == "" {
		return false
	}
	var ok bool
	_ = a.DB.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM thread_watches WHERE user_id=$1 AND thread_id=$2)
	`, userID, threadID).Scan(&ok)
	return ok
}
