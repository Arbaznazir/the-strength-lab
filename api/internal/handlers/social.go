package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/thestrengthlab/api/internal/auth"
	"github.com/thestrengthlab/api/internal/middleware"
	"github.com/thestrengthlab/api/internal/models"
	"github.com/thestrengthlab/api/internal/realtime"
)

func (a *API) WhatsNew(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`
		SELECT t.id::text, t.forum_id::text, f.slug, f.name, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       `+userSelectPrefix("a")+`
		FROM threads t
		JOIN forums f ON f.id=t.forum_id
		JOIN users a ON a.id=t.author_id
		ORDER BY t.last_post_at DESC
		LIMIT 30
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	threads := []models.Thread{}
	for rows.Next() {
		var t models.Thread
		if err := rows.Scan(
			&t.ID, &t.ForumID, &t.ForumSlug, &t.ForumName, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
			&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
			&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
			&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
			&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "scan failed")
			return
		}
		threads = append(threads, t)
	}

	ppRows, err := a.DB.Query(`
		SELECT `+profilePostSelectSQL()+`
		FROM profile_posts pp
		JOIN users u ON u.id=pp.author_id
		JOIN users pu ON pu.id=pp.profile_user_id
		ORDER BY pp.created_at DESC LIMIT 20
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer ppRows.Close()
	profilePosts := []models.ProfilePost{}
	for ppRows.Next() {
		p, err := scanProfilePost(ppRows)
		if err == nil {
			profilePosts = append(profilePosts, p)
		}
	}

	featRows, err := a.DB.Query(`
		SELECT t.id::text, t.forum_id::text, f.slug, f.name, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       `+userSelectPrefix("a")+`
		FROM threads t
		JOIN forums f ON f.id=t.forum_id
		JOIN users a ON a.id=t.author_id
		WHERE t.is_featured=true
		ORDER BY t.last_post_at DESC LIMIT 10
	`)
	featured := []models.Thread{}
	if err == nil {
		defer featRows.Close()
		for featRows.Next() {
			var t models.Thread
			if err := featRows.Scan(
				&t.ID, &t.ForumID, &t.ForumSlug, &t.ForumName, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
				&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
				&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
				&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
				&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
			); err == nil {
				featured = append(featured, t)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"latestThreads": threads,
		"profilePosts":  profilePosts,
		"featured":      featured,
	})
}

func (a *API) Trending(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`
		SELECT t.id::text, t.forum_id::text, f.slug, f.name, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       `+userSelectPrefix("a")+`
		FROM threads t
		JOIN forums f ON f.id=t.forum_id
		JOIN users a ON a.id=t.author_id
		ORDER BY (t.reply_count * 3 + t.view_count) DESC, t.last_post_at DESC
		LIMIT 10
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []models.Thread{}
	for rows.Next() {
		var t models.Thread
		if err := rows.Scan(
			&t.ID, &t.ForumID, &t.ForumSlug, &t.ForumName, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
			&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
			&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
			&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
			&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
		); err == nil {
			list = append(list, t)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"trending": list})
}

func (a *API) Stats(w http.ResponseWriter, r *http.Request) {
	var s models.ForumStats
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM threads`).Scan(&s.Threads)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM posts`).Scan(&s.Messages)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&s.Members)
	var latestID sql.NullString
	_ = a.DB.QueryRow(`SELECT id::text FROM users ORDER BY created_at DESC LIMIT 1`).Scan(&latestID)
	if latestID.Valid {
		u, err := a.getUserByID(latestID.String)
		if err == nil {
			s.LatestMember = &u
		}
	}

	memberOnline, guestOnline := simulatedPresence(s.Members, time.Now())
	realGuests := a.Guests.Count()
	if realGuests > guestOnline {
		guestOnline = realGuests
	}
	online := models.OnlineStats{Members: memberOnline, Guests: guestOnline, Total: memberOnline + guestOnline}

	staff := []models.UserPublic{}
	rows, err := a.DB.Query(`SELECT ` + userSelect + ` FROM users WHERE role IN ('moderator','admin') AND last_seen_at > NOW() - INTERVAL '15 minutes'`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			u, err := scanUser(rows)
			if err == nil {
				staff = append(staff, u)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"forum":  s,
		"online": online,
		"staff":  staff,
	})
}

func (a *API) Online(w http.ResponseWriter, r *http.Request) {
	var totalMembers int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&totalMembers)
	memberOnline, guestOnline := simulatedPresence(totalMembers, time.Now())
	realGuests := a.Guests.Count()
	if realGuests > guestOnline {
		guestOnline = realGuests
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"members":     []models.UserPublic{},
		"guests":      guestOnline,
		"total":       memberOnline + guestOnline,
		"memberCount": memberOnline,
	})
}

func (a *API) ListAlerts(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	rows, err := a.DB.Query(`
		SELECT id::text, kind, title, body, link, is_read, created_at
		FROM alerts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50
	`, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []models.Alert{}
	for rows.Next() {
		var al models.Alert
		if err := rows.Scan(&al.ID, &al.Kind, &al.Title, &al.Body, &al.Link, &al.IsRead, &al.CreatedAt); err == nil {
			list = append(list, al)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"alerts": list})
}

func (a *API) MarkAlertsRead(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	_, _ = a.DB.Exec(`UPDATE alerts SET is_read=true WHERE user_id=$1`, claims.UserID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) ListProfilePosts(w http.ResponseWriter, r *http.Request) {
	username := chiURLParam(r, "username")
	user, err := a.getUserByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	page := parsePage(r)
	perPage := DefaultPageSize
	var total int
	if err := a.DB.QueryRow(`SELECT COUNT(*) FROM profile_posts WHERE profile_user_id=$1`, user.ID).Scan(&total); err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	pages, offset, page := paginate(total, page, perPage)
	rows, err := a.DB.Query(`
		SELECT `+profilePostSelectSQL()+`
		FROM profile_posts pp
		JOIN users u ON u.id=pp.author_id
		JOIN users pu ON pu.id=pp.profile_user_id
		WHERE pp.profile_user_id=$1 ORDER BY pp.created_at DESC LIMIT $2 OFFSET $3
	`, user.ID, perPage, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []models.ProfilePost{}
	for rows.Next() {
		p, err := scanProfilePost(rows)
		if err == nil {
			list = append(list, p)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"posts":       list,
		"profileUser": user,
		"page":        page,
		"pages":       pages,
		"total":       total,
	})
}

func (a *API) CreateProfilePost(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	username := chiURLParam(r, "username")
	user, err := a.getUserByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	var req struct {
		Body string `json:"body"`
	}
	if err := decodeJSON(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		writeError(w, http.StatusBadRequest, "body required")
		return
	}
	id := uuid.New()
	_, err = a.DB.Exec(`INSERT INTO profile_posts(id, profile_user_id, author_id, body) VALUES($1,$2,$3,$4)`, id, user.ID, claims.UserID, strings.TrimSpace(req.Body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create failed")
		return
	}
	if user.ID != claims.UserID {
		a.createAlert(user.ID, "profile", "Profile post", claims.Username+" posted on your profile", "/members/"+user.Username)
	}
	a.notifyMentions(req.Body, claims.UserID, claims.Username, user.DisplayName+"'s profile", "/members/"+user.Username)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id.String()})
}

func (a *API) ListConversations(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	rows, err := a.DB.Query(`
		SELECT c.id::text, c.subject, c.last_message_at,
		       (cp.last_read_at IS NULL OR cp.last_read_at < c.last_message_at) AS unread,
		       COALESCE((
		         SELECT pm.body FROM private_messages pm
		         WHERE pm.conversation_id = c.id
		         ORDER BY pm.created_at DESC LIMIT 1
		       ), '') AS last_preview,
		       COALESCE((
		         SELECT pm.author_id::text FROM private_messages pm
		         WHERE pm.conversation_id = c.id
		         ORDER BY pm.created_at DESC LIMIT 1
		       ), '') AS last_author_id
		FROM conversations c
		JOIN conversation_participants cp ON cp.conversation_id=c.id
		WHERE cp.user_id=$1
		ORDER BY c.last_message_at DESC
	`, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []models.Conversation{}
	for rows.Next() {
		var c models.Conversation
		if err := rows.Scan(&c.ID, &c.Subject, &c.LastMessageAt, &c.Unread, &c.LastMessagePreview, &c.LastMessageAuthorID); err != nil {
			continue
		}
		prows, _ := a.DB.Query(`
			SELECT `+userSelect+` FROM users u
			JOIN conversation_participants cp ON cp.user_id=u.id
			WHERE cp.conversation_id=$1
		`, c.ID)
		parts := []models.UserPublic{}
		if prows != nil {
			for prows.Next() {
				u, err := scanUser(prows)
				if err == nil {
					parts = append(parts, u)
				}
			}
			prows.Close()
		}
		c.Participants = parts
		list = append(list, c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": list})
}

func (a *API) CreateConversation(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	var req struct {
		Username string `json:"username"`
		Subject  string `json:"subject"`
		Body     string `json:"body"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	other, err := a.getUserByUsername(strings.TrimSpace(req.Username))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if other.ID == claims.UserID {
		writeError(w, http.StatusBadRequest, "cannot message yourself")
		return
	}
	cid := uuid.New()
	mid := uuid.New()
	tx, err := a.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`INSERT INTO conversations(id, subject, created_by) VALUES($1,$2,$3)`, cid, strings.TrimSpace(req.Subject), claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "create failed")
		return
	}
	if _, err := tx.Exec(`INSERT INTO conversation_participants(conversation_id, user_id, last_read_at) VALUES($1,$2,NOW()),($1,$3,NULL)`, cid, claims.UserID, other.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "participants failed")
		return
	}
	if _, err := tx.Exec(`INSERT INTO private_messages(id, conversation_id, author_id, body) VALUES($1,$2,$3,$4)`, mid, cid, claims.UserID, strings.TrimSpace(req.Body)); err != nil {
		writeError(w, http.StatusInternalServerError, "message failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}
	a.createAlert(other.ID, "dm", "New message", claims.Username+" sent you a message", "/messages/"+cid.String())
	a.notifyPrivateMessage(cid.String(), mid.String())
	writeJSON(w, http.StatusCreated, map[string]any{"id": cid.String()})
}

func (a *API) GetConversation(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	id := chiURLParam(r, "id")
	var ok bool
	_ = a.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2)`, id, claims.UserID).Scan(&ok)
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	_, _ = a.DB.Exec(`UPDATE conversation_participants SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2`, id, claims.UserID)

	var conv models.Conversation
	err := a.DB.QueryRow(`
		SELECT c.id::text, c.subject, c.last_message_at,
		       COALESCE((
		         SELECT pm.body FROM private_messages pm
		         WHERE pm.conversation_id = c.id
		         ORDER BY pm.created_at DESC LIMIT 1
		       ), '') AS last_preview,
		       false
		FROM conversations c WHERE c.id=$1
	`, id).Scan(&conv.ID, &conv.Subject, &conv.LastMessageAt, &conv.LastMessagePreview, &conv.Unread)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	prows, _ := a.DB.Query(`
		SELECT `+userSelect+` FROM users u
		JOIN conversation_participants cp ON cp.user_id=u.id
		WHERE cp.conversation_id=$1
	`, id)
	if prows != nil {
		for prows.Next() {
			u, err := scanUser(prows)
			if err == nil {
				conv.Participants = append(conv.Participants, u)
			}
		}
		prows.Close()
	}

	rows, err := a.DB.Query(`
		SELECT m.id::text, m.body, m.created_at, `+userSelectPrefix("u")+`
		FROM private_messages m JOIN users u ON u.id=m.author_id
		WHERE m.conversation_id=$1 ORDER BY m.created_at ASC
	`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	msgs := []models.PrivateMessage{}
	for rows.Next() {
		var m models.PrivateMessage
		if err := rows.Scan(&m.ID, &m.Body, &m.CreatedAt,
			&m.Author.ID, &m.Author.Username, &m.Author.DisplayName, &m.Author.Title, &m.Author.Bio,
			&m.Author.AvatarURL, &m.Author.BannerURL, &m.Author.Role, &m.Author.MessageCount,
			&m.Author.ReactionScore, &m.Author.TrophyPoints, &m.Author.LastSeenAt, &m.Author.CreatedAt,
		); err == nil {
			msgs = append(msgs, m)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conv, "messages": msgs})
}

func (a *API) ReplyConversation(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	id := chiURLParam(r, "id")
	var req struct {
		Body string `json:"body"`
	}
	if err := decodeJSON(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		writeError(w, http.StatusBadRequest, "body required")
		return
	}
	var ok bool
	_ = a.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2)`, id, claims.UserID).Scan(&ok)
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	mid := uuid.New()
	_, err := a.DB.Exec(`INSERT INTO private_messages(id, conversation_id, author_id, body) VALUES($1,$2,$3,$4)`, mid, id, claims.UserID, strings.TrimSpace(req.Body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create failed")
		return
	}
	_, _ = a.DB.Exec(`UPDATE conversations SET last_message_at=NOW() WHERE id=$1`, id)
	_, _ = a.DB.Exec(`UPDATE conversation_participants SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2`, id, claims.UserID)
	rows, _ := a.DB.Query(`SELECT user_id::text FROM conversation_participants WHERE conversation_id=$1 AND user_id<>$2`, id, claims.UserID)
	if rows != nil {
		for rows.Next() {
			var uid string
			if rows.Scan(&uid) == nil {
				a.createAlert(uid, "dm", "New message", claims.Username+" replied in a conversation", "/messages/"+id)
			}
		}
		rows.Close()
	}
	a.notifyPrivateMessage(id, mid.String())
	a.notifyMentions(req.Body, claims.UserID, claims.Username, "a conversation", "/messages/"+id)
	writeJSON(w, http.StatusCreated, map[string]any{"id": mid.String()})
}

func (a *API) ListChat(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`
		SELECT c.id::text, c.body, c.created_at, `+userSelectPrefix("u")+`
		FROM chat_messages c JOIN users u ON u.id=c.author_id
		ORDER BY c.created_at DESC LIMIT 100
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []models.ChatMessage{}
	for rows.Next() {
		var m models.ChatMessage
		if err := rows.Scan(&m.ID, &m.Body, &m.CreatedAt,
			&m.Author.ID, &m.Author.Username, &m.Author.DisplayName, &m.Author.Title, &m.Author.Bio,
			&m.Author.AvatarURL, &m.Author.BannerURL, &m.Author.Role, &m.Author.MessageCount,
			&m.Author.ReactionScore, &m.Author.TrophyPoints, &m.Author.LastSeenAt, &m.Author.CreatedAt,
		); err == nil {
			list = append(list, m)
		}
	}
	// reverse to chronological
	for i, j := 0, len(list)-1; i < j; i, j = i+1, j-1 {
		list[i], list[j] = list[j], list[i]
	}
	writeJSON(w, http.StatusOK, map[string]any{"messages": list})
}

func (a *API) PostChat(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	var req struct {
		Body string `json:"body"`
	}
	if err := decodeJSON(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		writeError(w, http.StatusBadRequest, "body required")
		return
	}
	id := uuid.New()
	body := strings.TrimSpace(req.Body)
	_, err := a.DB.Exec(`INSERT INTO chat_messages(id, author_id, body) VALUES($1,$2,$3)`, id, claims.UserID, body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create failed")
		return
	}
	user, _ := a.getUserByID(claims.UserID)
	msg := models.ChatMessage{ID: id.String(), Body: body, CreatedAt: time.Now().UTC(), Author: user}
	a.Hub.Broadcast(map[string]any{"type": "chat", "message": msg})
	writeJSON(w, http.StatusCreated, msg)
}

func (a *API) wsUpgrader() *websocket.Upgrader {
	allowed := a.AllowedOrigins
	return &websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return middleware.OriginAllowed(r, allowed)
		},
	}
}

func (a *API) ChatWS(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	a.serveUserWS(w, r, claims)
}

func (a *API) MessagesWS(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	conn, err := a.wsUpgrader().Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &realtime.Client{
		UserID:   claims.UserID,
		Username: claims.Username,
		Conn:     conn,
		Send:     make(chan []byte, 16),
	}
	a.Hub.Register(client)
	defer func() {
		for _, convID := range a.Typing.ClearUser(claims.UserID) {
			a.broadcastTyping(convID, claims.UserID, claims.Username, false)
		}
		a.Hub.Unregister(client)
		_ = conn.Close()
	}()

	go func() {
		for msg := range client.Send {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		touchLastSeen(a.DB, claims.UserID)

		var evt struct {
			Type           string `json:"type"`
			ConversationID string `json:"conversationId"`
			Active         *bool  `json:"active"`
		}
		if json.Unmarshal(data, &evt) != nil || evt.Type != "typing" {
			continue
		}
		a.handleTypingEvent(claims, evt.ConversationID, evt.Active)
	}
}

func (a *API) serveUserWS(w http.ResponseWriter, r *http.Request, claims *auth.Claims) {
	conn, err := a.wsUpgrader().Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &realtime.Client{
		UserID:   claims.UserID,
		Username: claims.Username,
		Conn:     conn,
		Send:     make(chan []byte, 16),
	}
	a.Hub.Register(client)
	defer func() {
		a.Hub.Unregister(client)
		_ = conn.Close()
	}()

	go func() {
		for msg := range client.Send {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}()

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
		touchLastSeen(a.DB, claims.UserID)
	}
}

func (a *API) conversationParticipantIDs(conversationID string) []string {
	rows, err := a.DB.Query(`SELECT user_id::text FROM conversation_participants WHERE conversation_id=$1`, conversationID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func (a *API) getPrivateMessage(id string) (models.PrivateMessage, error) {
	var m models.PrivateMessage
	row := a.DB.QueryRow(`
		SELECT m.id::text, m.body, m.created_at, `+userSelectPrefix("u")+`
		FROM private_messages m JOIN users u ON u.id=m.author_id
		WHERE m.id=$1
	`, id)
	err := row.Scan(&m.ID, &m.Body, &m.CreatedAt,
		&m.Author.ID, &m.Author.Username, &m.Author.DisplayName, &m.Author.Title, &m.Author.Bio,
		&m.Author.AvatarURL, &m.Author.BannerURL, &m.Author.Role, &m.Author.MessageCount,
		&m.Author.ReactionScore, &m.Author.TrophyPoints, &m.Author.LastSeenAt, &m.Author.CreatedAt,
	)
	return m, err
}

func (a *API) notifyPrivateMessage(conversationID, messageID string) {
	participants := a.conversationParticipantIDs(conversationID)
	msg, err := a.getPrivateMessage(messageID)
	if err != nil {
		return
	}
	a.Hub.SendToUsers(participants, map[string]any{
		"type":           "dm",
		"conversationId": conversationID,
		"message":        msg,
	})
}

func (a *API) handleTypingEvent(claims *auth.Claims, conversationID string, active *bool) {
	if conversationID == "" || claims == nil {
		return
	}
	var ok bool
	_ = a.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2)`,
		conversationID, claims.UserID,
	).Scan(&ok)
	if !ok {
		return
	}

	isActive := active == nil || *active
	if !isActive {
		a.Typing.Clear(conversationID, claims.UserID)
		a.broadcastTyping(conversationID, claims.UserID, claims.Username, false)
		return
	}

	shouldNotify := a.Typing.Touch(conversationID, claims.UserID, 500*time.Millisecond, func(convID, userID string) {
		user, err := a.getUserByID(userID)
		username := user.Username
		if err != nil {
			username = ""
		}
		a.broadcastTyping(convID, userID, username, false)
	})
	if shouldNotify {
		a.broadcastTyping(conversationID, claims.UserID, claims.Username, true)
	}
}

func (a *API) broadcastTyping(conversationID, userID, username string, active bool) {
	participants := a.conversationParticipantIDs(conversationID)
	recipients := make([]string, 0, len(participants))
	for _, id := range participants {
		if id != userID {
			recipients = append(recipients, id)
		}
	}
	if len(recipients) == 0 {
		return
	}
	a.Hub.SendToUsers(recipients, map[string]any{
		"type":           "typing",
		"conversationId": conversationID,
		"userId":         userID,
		"username":       username,
		"active":         active,
	})
}

func (a *API) Report(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	var req struct {
		TargetType string `json:"targetType"`
		TargetID   string `json:"targetId"`
		Reason     string `json:"reason"`
	}
	if err := decodeJSON(r, &req); err != nil || req.TargetType == "" || req.TargetID == "" || strings.TrimSpace(req.Reason) == "" {
		writeError(w, http.StatusBadRequest, "invalid report")
		return
	}
	_, err := a.DB.Exec(`INSERT INTO reports(reporter_id, target_type, target_id, reason) VALUES($1,$2,$3,$4)`,
		claims.UserID, req.TargetType, req.TargetID, strings.TrimSpace(req.Reason))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "report failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true})
}

func (a *API) WatchThread(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	slug := chiURLParam(r, "slug")
	var threadID string
	if err := a.DB.QueryRow(`SELECT id::text FROM threads WHERE slug=$1 OR id::text=$1`, slug).Scan(&threadID); err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	_, _ = a.DB.Exec(`INSERT INTO thread_watches(user_id, thread_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, claims.UserID, threadID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "watched": true})
}

func (a *API) UnwatchThread(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	slug := chiURLParam(r, "slug")
	var threadID string
	if err := a.DB.QueryRow(`SELECT id::text FROM threads WHERE slug=$1 OR id::text=$1`, slug).Scan(&threadID); err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	_, _ = a.DB.Exec(`DELETE FROM thread_watches WHERE user_id=$1 AND thread_id=$2`, claims.UserID, threadID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "watched": false})
}
