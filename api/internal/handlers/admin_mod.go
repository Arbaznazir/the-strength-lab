package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (a *API) AdminDashboard(w http.ResponseWriter, r *http.Request) {
	var openReports, members, threads, posts int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM reports WHERE status='open'`).Scan(&openReports)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&members)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM threads`).Scan(&threads)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM posts`).Scan(&posts)
	var banned int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE banned_at IS NOT NULL`).Scan(&banned)

	type logRow struct {
		ID         string    `json:"id"`
		Action     string    `json:"action"`
		TargetType string    `json:"targetType"`
		TargetID   string    `json:"targetId"`
		Reason     string    `json:"reason"`
		Actor      string    `json:"actor"`
		CreatedAt  time.Time `json:"createdAt"`
	}
	recent := []logRow{}
	rows, err := a.DB.Query(`
		SELECT m.id::text, m.action, m.target_type, m.target_id::text, COALESCE(m.reason,''), u.username, m.created_at
		FROM moderation_actions m
		JOIN users u ON u.id = m.actor_id
		ORDER BY m.created_at DESC
		LIMIT 15
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var row logRow
			if rows.Scan(&row.ID, &row.Action, &row.TargetType, &row.TargetID, &row.Reason, &row.Actor, &row.CreatedAt) == nil {
				recent = append(recent, row)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"openReports": openReports,
		"members":     members,
		"threads":     threads,
		"posts":       posts,
		"banned":      banned,
		"recent":      recent,
	})
}

func (a *API) logModeration(actorID, action, targetType, targetID, reason string) {
	_, _ = a.DB.Exec(
		`INSERT INTO moderation_actions(actor_id, action, target_type, target_id, reason) VALUES($1,$2,$3,$4,$5)`,
		actorID, action, targetType, targetID, nullIfEmpty(reason),
	)
}

func nullIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.TrimSpace(s)
}

func (a *API) ModThread(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	slug := chiURLParam(r, "slug")
	var req struct {
		IsLocked   *bool `json:"isLocked"`
		IsPinned   *bool `json:"isPinned"`
		IsFeatured *bool `json:"isFeatured"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.IsLocked == nil && req.IsPinned == nil && req.IsFeatured == nil {
		writeError(w, http.StatusBadRequest, "no changes")
		return
	}

	var threadID string
	err := a.DB.QueryRow(`SELECT id::text FROM threads WHERE slug=$1 OR id::text=$1`, slug).Scan(&threadID)
	if err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}

	sets := []string{}
	args := []any{}
	i := 1
	if req.IsLocked != nil {
		sets = append(sets, "is_locked=$"+strconv.Itoa(i))
		args = append(args, *req.IsLocked)
		i++
	}
	if req.IsPinned != nil {
		sets = append(sets, "is_pinned=$"+strconv.Itoa(i))
		args = append(args, *req.IsPinned)
		i++
	}
	if req.IsFeatured != nil {
		sets = append(sets, "is_featured=$"+strconv.Itoa(i))
		args = append(args, *req.IsFeatured)
		i++
	}
	args = append(args, threadID)
	q := `UPDATE threads SET ` + strings.Join(sets, ", ") + `, updated_at=NOW() WHERE id=$` + strconv.Itoa(i)
	if _, err := a.DB.Exec(q, args...); err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}

	action := "thread.update"
	if req.IsLocked != nil {
		if *req.IsLocked {
			action = "thread.lock"
		} else {
			action = "thread.unlock"
		}
	}
	a.logModeration(claims.UserID, action, "thread", threadID, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) DeleteThread(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	slug := chiURLParam(r, "slug")
	var threadID, forumID string
	var replyCount int
	err := a.DB.QueryRow(`
		SELECT id::text, forum_id::text, reply_count FROM threads WHERE slug=$1 OR id::text=$1
	`, slug).Scan(&threadID, &forumID, &replyCount)
	if err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}

	tx, err := a.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM threads WHERE id=$1`, threadID); err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	postsRemoved := replyCount + 1
	_, _ = tx.Exec(`
		UPDATE forums SET
			thread_count=GREATEST(thread_count-1,0),
			post_count=GREATEST(post_count-$2,0)
		WHERE id=$1
	`, forumID, postsRemoved)

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}
	a.logModeration(claims.UserID, "thread.delete", "thread", threadID, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) DeletePost(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	postID := chiURLParam(r, "id")
	var threadID, forumID string
	err := a.DB.QueryRow(`
		SELECT p.thread_id::text, t.forum_id::text
		FROM posts p JOIN threads t ON t.id=p.thread_id
		WHERE p.id=$1
	`, postID).Scan(&threadID, &forumID)
	if err != nil {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}

	tx, err := a.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM posts WHERE id=$1`, postID); err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	_, _ = tx.Exec(`UPDATE threads SET reply_count=GREATEST(reply_count-1,0) WHERE id=$1`, threadID)
	_, _ = tx.Exec(`UPDATE forums SET post_count=GREATEST(post_count-1,0) WHERE id=$1`, forumID)

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}
	a.logModeration(claims.UserID, "post.delete", "post", postID, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) enrichReportTarget(targetType, targetID string) (preview, link, threadSlug, threadTitle string) {
	switch targetType {
	case "post":
		var body sql.NullString
		_ = a.DB.QueryRow(`
			SELECT LEFT(p.body, 200), t.slug, t.title
			FROM posts p JOIN threads t ON t.id=p.thread_id
			WHERE p.id=$1
		`, targetID).Scan(&body, &threadSlug, &threadTitle)
		if body.Valid {
			preview = body.String
		}
		if threadSlug != "" {
			link = "/threads/" + threadSlug + "#post-" + targetID
		}
	case "thread":
		_ = a.DB.QueryRow(`SELECT slug, title FROM threads WHERE id=$1`, targetID).Scan(&threadSlug, &threadTitle)
		if threadSlug != "" {
			link = "/threads/" + threadSlug
			preview = threadTitle
		}
	case "user":
		var uname sql.NullString
		_ = a.DB.QueryRow(`SELECT username FROM users WHERE id=$1`, targetID).Scan(&uname)
		if uname.Valid {
			link = "/members/" + uname.String
			preview = "@" + uname.String
		}
	}
	return
}
