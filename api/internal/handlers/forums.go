package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/models"
)

func chiURLParam(r *http.Request, key string) string {
	return chi.URLParam(r, key)
}

func (a *API) ListForumTree(w http.ResponseWriter, r *http.Request) {
	a.Guests.Hit(r.RemoteAddr)

	catRows, err := a.DB.Query(`SELECT id::text, name, slug, description, sort_order FROM categories ORDER BY sort_order, name`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer catRows.Close()

	cats := []models.Category{}
	catIndex := map[string]int{}
	for catRows.Next() {
		var c models.Category
		if err := catRows.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.SortOrder); err != nil {
			writeError(w, http.StatusInternalServerError, "scan failed")
			return
		}
		c.Forums = []models.Forum{}
		catIndex[c.ID] = len(cats)
		cats = append(cats, c)
	}

	forumRows, err := a.DB.Query(`
		SELECT f.id::text, f.category_id::text, f.name, f.slug, f.description, f.thread_count, f.post_count,
		       f.last_post_at, f.last_thread_id::text, t.title,
		       u.id::text, u.username, COALESCE(NULLIF(u.display_name,''), u.username), u.title, u.bio, u.avatar_url, u.banner_url,
		       u.role, u.message_count, u.reaction_score, u.trophy_points, u.last_seen_at, u.created_at
		FROM forums f
		LEFT JOIN threads t ON t.id = f.last_thread_id
		LEFT JOIN users u ON u.id = f.last_poster_id
		ORDER BY f.sort_order, f.name
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer forumRows.Close()

	for forumRows.Next() {
		var f models.Forum
		var lastPost sql.NullTime
		var lastThreadID, lastTitle sql.NullString
		var uid, uname, dname, title, bio, avatar, banner, role sql.NullString
		var msgCount, reactScore, points sql.NullInt64
		var lastSeen sql.NullTime
		var created sql.NullTime
		if err := forumRows.Scan(
			&f.ID, &f.CategoryID, &f.Name, &f.Slug, &f.Description, &f.ThreadCount, &f.PostCount,
			&lastPost, &lastThreadID, &lastTitle,
			&uid, &uname, &dname, &title, &bio, &avatar, &banner, &role, &msgCount, &reactScore, &points, &lastSeen, &created,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "scan failed")
			return
		}
		f.LastPostAt = nullTimePtr(lastPost)
		f.LastThreadID = nullStringPtr(lastThreadID)
		f.LastThreadTitle = nullStringPtr(lastTitle)
		if uid.Valid {
			u := models.UserPublic{
				ID: uid.String, Username: uname.String, DisplayName: dname.String, Title: title.String,
				Bio: bio.String, AvatarURL: avatar.String, BannerURL: banner.String, Role: role.String,
				MessageCount: int(msgCount.Int64), ReactionScore: int(reactScore.Int64), TrophyPoints: int(points.Int64),
			}
			if lastSeen.Valid {
				t := lastSeen.Time
				u.LastSeenAt = &t
			}
			if created.Valid {
				u.CreatedAt = created.Time
			}
			f.LastPoster = &u
		}
		if idx, ok := catIndex[f.CategoryID]; ok {
			cats[idx].Forums = append(cats[idx].Forums, f)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"categories": cats})
}

func (a *API) GetForum(w http.ResponseWriter, r *http.Request) {
	slug := chiURLParam(r, "slug")
	var f models.Forum
	var lastPost sql.NullTime
	err := a.DB.QueryRow(`
		SELECT id::text, category_id::text, name, slug, description, thread_count, post_count, last_post_at
		FROM forums WHERE slug=$1
	`, slug).Scan(&f.ID, &f.CategoryID, &f.Name, &f.Slug, &f.Description, &f.ThreadCount, &f.PostCount, &lastPost)
	if err != nil {
		writeError(w, http.StatusNotFound, "forum not found")
		return
	}
	f.LastPostAt = nullTimePtr(lastPost)

	sort := r.URL.Query().Get("sort")
	filter := r.URL.Query().Get("filter")
	orderBy := `t.is_pinned DESC, t.last_post_at DESC`
	switch sort {
	case "started":
		orderBy = `t.is_pinned DESC, t.created_at DESC`
	case "title":
		orderBy = `t.is_pinned DESC, lower(t.title) ASC`
	case "replies":
		orderBy = `t.is_pinned DESC, t.reply_count DESC, t.last_post_at DESC`
	case "views":
		orderBy = `t.is_pinned DESC, t.view_count DESC, t.last_post_at DESC`
	case "last_activity", "":
		orderBy = `t.is_pinned DESC, t.last_post_at DESC`
	}

	where := `t.forum_id=$1`
	switch filter {
	case "open":
		where += ` AND t.is_locked=false`
	case "locked":
		where += ` AND t.is_locked=true`
	case "featured":
		where += ` AND t.is_featured=true`
	case "pinned":
		where += ` AND t.is_pinned=true`
	}

	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	perPage := 25
	offset := (page - 1) * perPage

	var total int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM threads t WHERE `+where, f.ID).Scan(&total)

	rows, err := a.DB.Query(`
		SELECT t.id::text, t.forum_id::text, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       `+userSelectPrefix("a")+`,
		       lp.id::text, lp.username, COALESCE(NULLIF(lp.display_name,''), lp.username), lp.title, lp.bio, lp.avatar_url, lp.banner_url,
		       lp.role, lp.message_count, lp.reaction_score, lp.trophy_points, lp.last_seen_at, lp.created_at,
		       COALESCE((
		         SELECT left(p.body, 280) FROM posts p
		         WHERE p.thread_id=t.id
		         ORDER BY p.created_at ASC LIMIT 1
		       ), '')
		FROM threads t
		JOIN users a ON a.id = t.author_id
		LEFT JOIN users lp ON lp.id = t.last_poster_id
		WHERE `+where+`
		ORDER BY `+orderBy+`
		LIMIT $2 OFFSET $3
	`, f.ID, perPage, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	threads := []models.Thread{}
	for rows.Next() {
		th, err := scanThreadRowWithPreview(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "scan failed")
			return
		}
		th.ForumSlug = f.Slug
		th.ForumName = f.Name
		threads = append(threads, th)
	}

	pages := total / perPage
	if total%perPage != 0 {
		pages++
	}
	if pages == 0 {
		pages = 1
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"forum":   f,
		"threads": threads,
		"page":    page,
		"pages":   pages,
		"total":   total,
		"sort":    sort,
		"filter":  filter,
	})
}

func userSelectPrefix(alias string) string {
	return alias + `.id::text, ` + alias + `.username, COALESCE(NULLIF(` + alias + `.display_name,''), ` + alias + `.username), ` +
		alias + `.title, ` + alias + `.bio, ` + alias + `.avatar_url, ` + alias + `.banner_url, ` + alias + `.role, ` +
		alias + `.message_count, ` + alias + `.reaction_score, ` + alias + `.trophy_points, ` + alias + `.last_seen_at, ` + alias + `.created_at`
}

func scanThreadRow(rows *sql.Rows) (models.Thread, error) {
	return scanThreadFields(rows, false)
}

func scanThreadRowWithPreview(rows *sql.Rows) (models.Thread, error) {
	return scanThreadFields(rows, true)
}

func scanThreadFields(rows *sql.Rows, withPreview bool) (models.Thread, error) {
	var t models.Thread
	var lpID, lpUser, lpDisplay, lpTitle, lpBio, lpAvatar, lpBanner, lpRole sql.NullString
	var lpMsg, lpReact, lpPoints sql.NullInt64
	var lpSeen, lpCreated sql.NullTime
	var preview string

	dest := []any{
		&t.ID, &t.ForumID, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
		&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
		&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
		&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
		&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
		&lpID, &lpUser, &lpDisplay, &lpTitle, &lpBio, &lpAvatar, &lpBanner, &lpRole, &lpMsg, &lpReact, &lpPoints, &lpSeen, &lpCreated,
	}
	if withPreview {
		dest = append(dest, &preview)
	}

	if err := rows.Scan(dest...); err != nil {
		return t, err
	}
	t.Preview = preview
	if lpID.Valid {
		u := models.UserPublic{
			ID: lpID.String, Username: lpUser.String, DisplayName: lpDisplay.String, Title: lpTitle.String,
			Bio: lpBio.String, AvatarURL: lpAvatar.String, BannerURL: lpBanner.String, Role: lpRole.String,
			MessageCount: int(lpMsg.Int64), ReactionScore: int(lpReact.Int64), TrophyPoints: int(lpPoints.Int64),
		}
		if lpSeen.Valid {
			tt := lpSeen.Time
			u.LastSeenAt = &tt
		}
		if lpCreated.Valid {
			u.CreatedAt = lpCreated.Time
		}
		t.LastPoster = &u
	}
	return t, nil
}

func (a *API) CreateThread(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	slug := chiURLParam(r, "slug")
	var req struct {
		Title          string   `json:"title"`
		Body           string   `json:"body"`
		AttachmentIDs  []string `json:"attachmentIds"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Title) < 3 || len(req.Body) < 2 {
		writeError(w, http.StatusBadRequest, "title and body required")
		return
	}

	var forumID string
	if err := a.DB.QueryRow(`SELECT id::text FROM forums WHERE slug=$1`, slug).Scan(&forumID); err != nil {
		writeError(w, http.StatusNotFound, "forum not found")
		return
	}

	threadID := uuid.New()
	postID := uuid.New()
	threadSlug := slugify(req.Title) + "-" + threadID.String()[:8]

	tx, err := a.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback()

	now := time.Now()
	if _, err := tx.Exec(`
		INSERT INTO threads(id, forum_id, author_id, title, slug, last_post_at, last_poster_id)
		VALUES($1,$2,$3,$4,$5,$6,$3)
	`, threadID, forumID, claims.UserID, req.Title, threadSlug, now); err != nil {
		writeError(w, http.StatusInternalServerError, "create thread failed")
		return
	}
	if _, err := tx.Exec(`
		INSERT INTO posts(id, thread_id, author_id, body) VALUES($1,$2,$3,$4)
	`, postID, threadID, claims.UserID, req.Body); err != nil {
		writeError(w, http.StatusInternalServerError, "create post failed")
		return
	}
	if err := a.attachToPost(tx, postID.String(), claims.UserID, req.AttachmentIDs); err != nil {
		writeError(w, http.StatusBadRequest, "invalid attachment")
		return
	}
	if _, err := tx.Exec(`
		UPDATE forums SET thread_count=thread_count+1, post_count=post_count+1,
		last_thread_id=$2, last_post_at=$3, last_poster_id=$4 WHERE id=$1
	`, forumID, threadID, now, claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "update forum failed")
		return
	}
	if _, err := tx.Exec(`UPDATE users SET message_count=message_count+1, trophy_points=trophy_points+1 WHERE id=$1`, claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "update user failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}

	a.notifyMentions(req.Body, claims.UserID, claims.Username, "\""+req.Title+"\"", "/threads/"+threadSlug)

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":   threadID.String(),
		"slug": threadSlug,
	})
}

func (a *API) GetThread(w http.ResponseWriter, r *http.Request) {
	slug := chiURLParam(r, "slug")
	var t models.Thread
	err := a.DB.QueryRow(`
		SELECT t.id::text, t.forum_id::text, f.slug, f.name, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       `+userSelectPrefix("a")+`
		FROM threads t
		JOIN forums f ON f.id=t.forum_id
		JOIN users a ON a.id=t.author_id
		WHERE t.slug=$1 OR t.id::text=$1
	`, slug).Scan(
		&t.ID, &t.ForumID, &t.ForumSlug, &t.ForumName, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
		&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
		&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
		&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
		&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	_, _ = a.DB.Exec(`UPDATE threads SET view_count=view_count+1 WHERE id=$1`, t.ID)

	claims := a.requireUser(r)
	userID := ""
	if claims != nil {
		userID = claims.UserID
	}

	perPage := 20
	var totalPosts int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM posts WHERE thread_id=$1`, t.ID).Scan(&totalPosts)

	page := 1
	if highlight := r.URL.Query().Get("postId"); highlight != "" {
		var pos int
		err := a.DB.QueryRow(`
			SELECT COUNT(*) FROM posts
			WHERE thread_id=$1 AND created_at <= (
			  SELECT created_at FROM posts WHERE id=$2 AND thread_id=$1
			)
		`, t.ID, highlight).Scan(&pos)
		if err == nil && pos > 0 {
			page = (pos-1)/perPage + 1
		}
	} else if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}

	pages := totalPosts / perPage
	if totalPosts%perPage != 0 {
		pages++
	}
	if pages == 0 {
		pages = 1
	}
	if page > pages {
		page = pages
	}
	offset := (page - 1) * perPage

	watched := a.threadWatchStatus(userID, t.ID)

	rows, err := a.DB.Query(`
		SELECT p.id::text, p.thread_id::text, p.body, p.reaction_count, p.created_at, p.updated_at,
		       `+userSelectPrefix("u")+`,
		       EXISTS(SELECT 1 FROM reactions r WHERE r.post_id=p.id AND r.user_id=$2),
		       qp.id::text, qp.body,
		       qu.id::text, qu.username, COALESCE(NULLIF(qu.display_name,''), qu.username), qu.title, qu.bio, qu.avatar_url, qu.banner_url,
		       qu.role, qu.message_count, qu.reaction_score, qu.trophy_points, qu.last_seen_at, qu.created_at
		FROM posts p
		JOIN users u ON u.id=p.author_id
		LEFT JOIN posts qp ON qp.id = p.quoted_post_id
	 LEFT JOIN users qu ON qu.id = qp.author_id
		WHERE p.thread_id=$1
		ORDER BY p.created_at ASC
		LIMIT $3 OFFSET $4
	`, t.ID, nullableUUID(userID), perPage, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	posts := []models.Post{}
	postIDs := []string{}
	for rows.Next() {
		p, err := scanPostRow(rows, true)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "scan failed")
			return
		}
		p.Attachments = []models.Attachment{}
		posts = append(posts, p)
		postIDs = append(postIDs, p.ID)
	}
	if atts, err := a.attachmentsForPosts(postIDs); err == nil {
		for i := range posts {
			if list, ok := atts[posts[i].ID]; ok {
				posts[i].Attachments = list
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"thread":     t,
		"posts":      posts,
		"page":       page,
		"pages":      pages,
		"totalPosts": totalPosts,
		"watched":    watched,
	})
}

func nullableUUID(id string) any {
	if id == "" {
		return nil
	}
	return id
}

func (a *API) ReplyThread(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	slug := chiURLParam(r, "slug")
	var req struct {
		Body          string   `json:"body"`
		AttachmentIDs []string `json:"attachmentIds"`
		QuotedPostID  string   `json:"quotedPostId"`
	}
	if err := decodeJSON(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		writeError(w, http.StatusBadRequest, "body required")
		return
	}
	var threadID, forumID, authorID string
	var locked bool
	var title string
	err := a.DB.QueryRow(`
		SELECT t.id::text, t.forum_id::text, t.author_id::text, t.is_locked, t.title
		FROM threads t WHERE t.slug=$1 OR t.id::text=$1
	`, slug).Scan(&threadID, &forumID, &authorID, &locked, &title)
	if err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	if locked && claims.Role != "moderator" && claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "thread is locked")
		return
	}

	postID := uuid.New()
	now := time.Now()
	tx, err := a.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback()

	quotedID := sql.NullString{}
	if q := strings.TrimSpace(req.QuotedPostID); q != "" {
		var ok bool
		_ = a.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM posts WHERE id=$1 AND thread_id=$2)`, q, threadID).Scan(&ok)
		if ok {
			quotedID = sql.NullString{String: q, Valid: true}
		}
	}

	if _, err := tx.Exec(`INSERT INTO posts(id, thread_id, author_id, body, quoted_post_id) VALUES($1,$2,$3,$4,$5)`, postID, threadID, claims.UserID, strings.TrimSpace(req.Body), quotedID); err != nil {
		writeError(w, http.StatusInternalServerError, "create failed")
		return
	}
	if err := a.attachToPost(tx, postID.String(), claims.UserID, req.AttachmentIDs); err != nil {
		writeError(w, http.StatusBadRequest, "invalid attachment")
		return
	}
	if _, err := tx.Exec(`UPDATE threads SET reply_count=reply_count+1, last_post_at=$2, last_poster_id=$3, updated_at=NOW() WHERE id=$1`, threadID, now, claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "update thread failed")
		return
	}
	if _, err := tx.Exec(`UPDATE forums SET post_count=post_count+1, last_thread_id=$2, last_post_at=$3, last_poster_id=$4 WHERE id=$1`, forumID, threadID, now, claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "update forum failed")
		return
	}
	if _, err := tx.Exec(`UPDATE users SET message_count=message_count+1, trophy_points=trophy_points+1 WHERE id=$1`, claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "update user failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}

	if authorID != claims.UserID {
		a.createAlert(authorID, "reply", "New reply", claims.Username+" replied to \""+title+"\"", "/threads/"+slug)
	}
	a.notifyThreadWatchers(threadID, slug, title, claims.UserID, claims.Username, authorID)
	a.notifyMentions(req.Body, claims.UserID, claims.Username, "\""+title+"\"", "/threads/"+slug)
	writeJSON(w, http.StatusCreated, map[string]any{"id": postID.String()})
}

func (a *API) ReactPost(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	postID := chiURLParam(r, "id")

	var exists bool
	_ = a.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM reactions WHERE post_id=$1 AND user_id=$2)`, postID, claims.UserID).Scan(&exists)

	var threadSlug string
	_ = a.DB.QueryRow(`
		SELECT t.slug FROM posts p JOIN threads t ON t.id=p.thread_id WHERE p.id=$1
	`, postID).Scan(&threadSlug)
	postLink := "/threads/" + threadSlug + "#post-" + postID

	if exists {
		res, err := a.DB.Exec(`DELETE FROM reactions WHERE post_id=$1 AND user_id=$2`, postID, claims.UserID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "unreact failed")
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			_, _ = a.DB.Exec(`UPDATE posts SET reaction_count=GREATEST(reaction_count-1,0) WHERE id=$1`, postID)
			var authorID string
			_ = a.DB.QueryRow(`SELECT author_id::text FROM posts WHERE id=$1`, postID).Scan(&authorID)
			if authorID != "" && authorID != claims.UserID {
				_, _ = a.DB.Exec(`UPDATE users SET reaction_score=GREATEST(reaction_score-1,0) WHERE id=$1`, authorID)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "reacted": false})
		return
	}

	res, err := a.DB.Exec(`INSERT INTO reactions(post_id, user_id, kind) VALUES($1,$2,'like') ON CONFLICT DO NOTHING`, postID, claims.UserID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "react failed")
		return
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		_, _ = a.DB.Exec(`UPDATE posts SET reaction_count=reaction_count+1 WHERE id=$1`, postID)
		var authorID string
		_ = a.DB.QueryRow(`SELECT author_id::text FROM posts WHERE id=$1`, postID).Scan(&authorID)
		if authorID != "" && authorID != claims.UserID {
			_, _ = a.DB.Exec(`UPDATE users SET reaction_score=reaction_score+1, trophy_points=trophy_points+1 WHERE id=$1`, authorID)
			a.createAlert(authorID, "reaction", "New reaction", claims.Username+" liked your post", postLink)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "reacted": true})
}
