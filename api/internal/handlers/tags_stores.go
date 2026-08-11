package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/models"
)

type ProfileTag struct {
	Slug      string `json:"slug"`
	Label     string `json:"label"`
	Color     string `json:"color"`
	SortOrder int    `json:"sortOrder"`
}

type TrustedStore struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	TagLabel    string  `json:"tagLabel"`
	TagColor    string  `json:"tagColor"`
	BannerURL   string  `json:"bannerUrl"`
	LinkURL     string  `json:"linkUrl"`
	Description string  `json:"description"`
	ForumID     *string `json:"forumId,omitempty"`
	ForumSlug   string  `json:"forumSlug,omitempty"`
	SortOrder   int     `json:"sortOrder"`
	IsActive    bool    `json:"isActive"`
	ThreadCount int     `json:"threadCount"`
	PostCount   int     `json:"postCount"`
	LastPostTitle string `json:"lastPostTitle,omitempty"`
	LastPostAt    *string `json:"lastPostAt,omitempty"`
}

var tagSlugRe = regexp.MustCompile(`^[a-z][a-z0-9_-]{1,23}$`)
var hexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func normalizeColor(c, fallback string) string {
	c = strings.TrimSpace(c)
	if hexColorRe.MatchString(c) {
		return strings.ToLower(c)
	}
	return fallback
}

func (a *API) loadUserTags(userID string) []models.UserTag {
	rows, err := a.DB.Query(`
		SELECT t.slug, t.label, t.color
		FROM user_tags ut
		JOIN profile_tags t ON t.slug = ut.tag_slug
		WHERE ut.user_id = $1
		ORDER BY t.sort_order ASC, t.label ASC
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := []models.UserTag{}
	for rows.Next() {
		var t models.UserTag
		if rows.Scan(&t.Slug, &t.Label, &t.Color) == nil {
			out = append(out, t)
		}
	}
	return out
}

func (a *API) attachUserTags(u *models.UserPublic) {
	if u == nil || u.ID == "" {
		return
	}
	u.Tags = a.loadUserTags(u.ID)
}

func (a *API) attachUserTagsMany(users []models.UserPublic) {
	for i := range users {
		users[i].Tags = a.loadUserTags(users[i].ID)
	}
}

func (a *API) ListProfileTags(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`
		SELECT slug, label, color, sort_order FROM profile_tags
		ORDER BY sort_order ASC, label ASC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []ProfileTag{}
	for rows.Next() {
		var t ProfileTag
		if rows.Scan(&t.Slug, &t.Label, &t.Color, &t.SortOrder) == nil {
			list = append(list, t)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": list})
}

func (a *API) CreateProfileTag(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	var req struct {
		Slug      string `json:"slug"`
		Label     string `json:"label"`
		Color     string `json:"color"`
		SortOrder int    `json:"sortOrder"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	label := strings.TrimSpace(req.Label)
	if !tagSlugRe.MatchString(slug) {
		writeError(w, http.StatusBadRequest, "invalid slug")
		return
	}
	if label == "" {
		label = slug
	}
	color := normalizeColor(req.Color, "#d4ff3a")
	_, err := a.DB.Exec(`
		INSERT INTO profile_tags(slug, label, color, sort_order) VALUES($1,$2,$3,$4)
	`, slug, label, color, req.SortOrder)
	if err != nil {
		writeError(w, http.StatusConflict, "tag already exists")
		return
	}
	a.logModeration(claims.UserID, "tag.create", "tag", slug, label)
	writeJSON(w, http.StatusCreated, map[string]any{
		"tag": ProfileTag{Slug: slug, Label: label, Color: color, SortOrder: req.SortOrder},
	})
}

func (a *API) PatchProfileTag(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	slug := chiURLParam(r, "slug")
	var req struct {
		Label     *string `json:"label"`
		Color     *string `json:"color"`
		SortOrder *int    `json:"sortOrder"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	var cur ProfileTag
	err := a.DB.QueryRow(`SELECT slug, label, color, sort_order FROM profile_tags WHERE slug=$1`, slug).
		Scan(&cur.Slug, &cur.Label, &cur.Color, &cur.SortOrder)
	if err != nil {
		writeError(w, http.StatusNotFound, "tag not found")
		return
	}
	if req.Label != nil && strings.TrimSpace(*req.Label) != "" {
		cur.Label = strings.TrimSpace(*req.Label)
	}
	if req.Color != nil {
		cur.Color = normalizeColor(*req.Color, cur.Color)
	}
	if req.SortOrder != nil {
		cur.SortOrder = *req.SortOrder
	}
	if _, err := a.DB.Exec(`UPDATE profile_tags SET label=$2, color=$3, sort_order=$4 WHERE slug=$1`,
		slug, cur.Label, cur.Color, cur.SortOrder); err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tag": cur})
}

func (a *API) DeleteProfileTag(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	slug := chiURLParam(r, "slug")
	res, err := a.DB.Exec(`DELETE FROM profile_tags WHERE slug=$1`, slug)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "tag not found")
		return
	}
	a.logModeration(claims.UserID, "tag.delete", "tag", slug, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) SetUserTags(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || (claims.Role != "admin" && claims.Role != "moderator") {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	userID := chiURLParam(r, "id")
	var req struct {
		Tags []string `json:"tags"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	var exists int
	if err := a.DB.QueryRow(`SELECT 1 FROM users WHERE id=$1`, userID).Scan(&exists); err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	tx, err := a.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.Exec(`DELETE FROM user_tags WHERE user_id=$1`, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "clear failed")
		return
	}
	seen := map[string]struct{}{}
	for _, s := range req.Tags {
		s = strings.ToLower(strings.TrimSpace(s))
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		if _, err := tx.Exec(`INSERT INTO user_tags(user_id, tag_slug)
			SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM profile_tags WHERE slug=$2)`, userID, s); err != nil {
			writeError(w, http.StatusBadRequest, "invalid tag: "+s)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "commit failed")
		return
	}
	a.logModeration(claims.UserID, "user.tags", "user", userID, strings.Join(req.Tags, ","))
	user, _ := a.getUserByID(userID)
	a.attachUserTags(&user)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (a *API) ListTrustedStores(w http.ResponseWriter, r *http.Request) {
	adminView := r.URL.Query().Get("all") == "1"
	q := `
		SELECT s.id::text, s.name, s.slug, s.tag_label, s.tag_color, s.banner_url, s.link_url, s.description,
		       s.forum_id::text, COALESCE(f.slug,''), s.sort_order, s.is_active,
		       COALESCE(f.thread_count, 0), COALESCE(f.post_count, 0),
		       COALESCE((SELECT t.title FROM threads t WHERE t.forum_id=s.forum_id ORDER BY t.last_post_at DESC NULLS LAST LIMIT 1), ''),
		       f.last_post_at
		FROM trusted_stores s
		LEFT JOIN forums f ON f.id = s.forum_id
	`
	if !adminView {
		q += ` WHERE s.is_active = true `
	}
	q += ` ORDER BY s.sort_order ASC, s.name ASC`

	rows, err := a.DB.Query(q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	list := []TrustedStore{}
	for rows.Next() {
		var s TrustedStore
		var forumID sql.NullString
		var lastAt sql.NullTime
		var lastTitle string
		if err := rows.Scan(
			&s.ID, &s.Name, &s.Slug, &s.TagLabel, &s.TagColor, &s.BannerURL, &s.LinkURL, &s.Description,
			&forumID, &s.ForumSlug, &s.SortOrder, &s.IsActive,
			&s.ThreadCount, &s.PostCount, &lastTitle, &lastAt,
		); err != nil {
			continue
		}
		if forumID.Valid {
			id := forumID.String
			s.ForumID = &id
		}
		s.LastPostTitle = lastTitle
		if lastAt.Valid {
			t := lastAt.Time.UTC().Format(timeRFC3339)
			s.LastPostAt = &t
		}
		list = append(list, s)
	}
	writeJSON(w, http.StatusOK, map[string]any{"stores": list})
}

const timeRFC3339 = "2006-01-02T15:04:05Z07:00"

func (a *API) CreateTrustedStore(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		TagLabel    string `json:"tagLabel"`
		TagColor    string `json:"tagColor"`
		BannerURL   string `json:"bannerUrl"`
		LinkURL     string `json:"linkUrl"`
		Description string `json:"description"`
		ForumID     string `json:"forumId"`
		SortOrder   int    `json:"sortOrder"`
		IsActive    *bool  `json:"isActive"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name required")
		return
	}
	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	if slug == "" {
		slug = slugify(name)
	}
	if !tagSlugRe.MatchString(slug) && len(slug) > 24 {
		slug = slug[:24]
	}
	tagLabel := strings.TrimSpace(req.TagLabel)
	if tagLabel == "" {
		tagLabel = "Trusted Source"
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	id := uuid.New()
	var forum any
	if strings.TrimSpace(req.ForumID) != "" {
		forum = req.ForumID
	} else {
		forum = nil
	}
	banner := sanitizeMediaURL(req.BannerURL)
	if banner == "" && strings.HasPrefix(strings.TrimSpace(req.BannerURL), "http") {
		banner = strings.TrimSpace(req.BannerURL) // allow absolute CDN/banner URLs for stores
	}
	_, err := a.DB.Exec(`
		INSERT INTO trusted_stores(id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, id, name, slug, tagLabel, normalizeColor(req.TagColor, "#d4ff3a"), banner,
		strings.TrimSpace(req.LinkURL), strings.TrimSpace(req.Description), forum, req.SortOrder, active)
	if err != nil {
		writeError(w, http.StatusConflict, "could not create store")
		return
	}
	a.logModeration(claims.UserID, "store.create", "store", id.String(), name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id.String(), "slug": slug})
}

func (a *API) PatchTrustedStore(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	id := chiURLParam(r, "id")
	var req struct {
		Name        *string `json:"name"`
		TagLabel    *string `json:"tagLabel"`
		TagColor    *string `json:"tagColor"`
		BannerURL   *string `json:"bannerUrl"`
		LinkURL     *string `json:"linkUrl"`
		Description *string `json:"description"`
		ForumID     *string `json:"forumId"`
		SortOrder   *int    `json:"sortOrder"`
		IsActive    *bool   `json:"isActive"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	var cur TrustedStore
	var forumID sql.NullString
	err := a.DB.QueryRow(`
		SELECT id::text, name, slug, tag_label, tag_color, banner_url, link_url, description,
		       forum_id::text, sort_order, is_active
		FROM trusted_stores WHERE id=$1
	`, id).Scan(&cur.ID, &cur.Name, &cur.Slug, &cur.TagLabel, &cur.TagColor, &cur.BannerURL, &cur.LinkURL,
		&cur.Description, &forumID, &cur.SortOrder, &cur.IsActive)
	if err != nil {
		writeError(w, http.StatusNotFound, "store not found")
		return
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		cur.Name = strings.TrimSpace(*req.Name)
	}
	if req.TagLabel != nil && strings.TrimSpace(*req.TagLabel) != "" {
		cur.TagLabel = strings.TrimSpace(*req.TagLabel)
	}
	if req.TagColor != nil {
		cur.TagColor = normalizeColor(*req.TagColor, cur.TagColor)
	}
	if req.BannerURL != nil {
		b := strings.TrimSpace(*req.BannerURL)
		if b == "" || strings.HasPrefix(b, "/uploads/") || strings.HasPrefix(b, "http://") || strings.HasPrefix(b, "https://") {
			cur.BannerURL = b
		}
	}
	if req.LinkURL != nil {
		cur.LinkURL = strings.TrimSpace(*req.LinkURL)
	}
	if req.Description != nil {
		cur.Description = strings.TrimSpace(*req.Description)
	}
	if req.SortOrder != nil {
		cur.SortOrder = *req.SortOrder
	}
	if req.IsActive != nil {
		cur.IsActive = *req.IsActive
	}

	var forum any
	if req.ForumID != nil {
		if strings.TrimSpace(*req.ForumID) == "" {
			forum = nil
		} else {
			forum = strings.TrimSpace(*req.ForumID)
		}
	} else if forumID.Valid {
		forum = forumID.String
	} else {
		forum = nil
	}

	if _, err := a.DB.Exec(`
		UPDATE trusted_stores SET name=$2, tag_label=$3, tag_color=$4, banner_url=$5, link_url=$6,
			description=$7, forum_id=$8, sort_order=$9, is_active=$10, updated_at=NOW()
		WHERE id=$1
	`, id, cur.Name, cur.TagLabel, cur.TagColor, cur.BannerURL, cur.LinkURL, cur.Description, forum, cur.SortOrder, cur.IsActive); err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) DeleteTrustedStore(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	id := chiURLParam(r, "id")
	res, err := a.DB.Exec(`DELETE FROM trusted_stores WHERE id=$1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "store not found")
		return
	}
	a.logModeration(claims.UserID, "store.delete", "store", id, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
