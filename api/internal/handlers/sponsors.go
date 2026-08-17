package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

type SponsorBanner struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	ImageURL    string  `json:"imageUrl"`
	LinkURL     string  `json:"linkUrl"`
	ForumID     *string `json:"forumId,omitempty"`
	ForumSlug   string  `json:"forumSlug,omitempty"`
	ForumName   string  `json:"forumName,omitempty"`
	ThreadSlug  string  `json:"threadSlug,omitempty"`
	ThreadTitle string  `json:"threadTitle,omitempty"`
	SortOrder   int     `json:"sortOrder"`
	IsActive    bool    `json:"isActive"`
}

func sanitizeSponsorMediaURL(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.Contains(s, "..") || strings.Contains(s, "\\") {
		return ""
	}
	if strings.HasPrefix(s, "/uploads/") || strings.HasPrefix(s, "/sponsors/") {
		return s
	}
	if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
		return s
	}
	return ""
}

func (a *API) ListSponsorBanners(w http.ResponseWriter, r *http.Request) {
	adminView := r.URL.Query().Get("all") == "1"
	q := `
		SELECT s.id::text, s.name, s.image_url, s.link_url,
		       s.forum_id::text, COALESCE(f.slug,''), COALESCE(f.name,''),
		       s.sort_order, s.is_active,
		       COALESCE(th.slug,''), COALESCE(th.title,'')
		FROM sponsor_banners s
		LEFT JOIN forums f ON f.id = s.forum_id
		LEFT JOIN threads th ON th.id = s.thread_id
	`
	if !adminView {
		q += ` WHERE s.is_active = true `
	}
	q += ` ORDER BY s.sort_order ASC, s.created_at ASC`

	rows, err := a.DB.Query(q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	list := []SponsorBanner{}
	for rows.Next() {
		var s SponsorBanner
		var forumID sql.NullString
		if err := rows.Scan(
			&s.ID, &s.Name, &s.ImageURL, &s.LinkURL,
			&forumID, &s.ForumSlug, &s.ForumName,
			&s.SortOrder, &s.IsActive,
			&s.ThreadSlug, &s.ThreadTitle,
		); err != nil {
			continue
		}
		if forumID.Valid {
			id := forumID.String
			s.ForumID = &id
		}
		list = append(list, s)
	}
	writeJSON(w, http.StatusOK, map[string]any{"banners": list})
}

func (a *API) CreateSponsorBanner(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	var req struct {
		Name      string `json:"name"`
		ImageURL  string `json:"imageUrl"`
		LinkURL   string `json:"linkUrl"`
		ForumID   string `json:"forumId"`
		SortOrder int    `json:"sortOrder"`
		IsActive  *bool  `json:"isActive"`
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
	imageURL := sanitizeSponsorMediaURL(req.ImageURL)
	if imageURL == "" {
		writeError(w, http.StatusBadRequest, "imageUrl required (upload or /sponsors/…)")
		return
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	var forum any
	if strings.TrimSpace(req.ForumID) != "" {
		forum = strings.TrimSpace(req.ForumID)
	} else {
		forum = nil
	}
	id := uuid.New()
	if _, err := a.DB.Exec(`
		INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
		VALUES($1,$2,$3,$4,$5,$6,$7)
	`, id, name, imageURL, strings.TrimSpace(req.LinkURL), forum, req.SortOrder, active); err != nil {
		writeError(w, http.StatusConflict, "could not create sponsor banner")
		return
	}
	a.logModeration(claims.UserID, "sponsor.create", "sponsor", id.String(), name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id.String()})
}

func (a *API) PatchSponsorBanner(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	id := chiURLParam(r, "id")
	var req struct {
		Name      *string `json:"name"`
		ImageURL  *string `json:"imageUrl"`
		LinkURL   *string `json:"linkUrl"`
		ForumID   *string `json:"forumId"`
		SortOrder *int    `json:"sortOrder"`
		IsActive  *bool   `json:"isActive"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	var cur SponsorBanner
	var forumID sql.NullString
	err := a.DB.QueryRow(`
		SELECT id::text, name, image_url, link_url, forum_id::text, sort_order, is_active
		FROM sponsor_banners WHERE id=$1
	`, id).Scan(&cur.ID, &cur.Name, &cur.ImageURL, &cur.LinkURL, &forumID, &cur.SortOrder, &cur.IsActive)
	if err != nil {
		writeError(w, http.StatusNotFound, "sponsor not found")
		return
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		cur.Name = strings.TrimSpace(*req.Name)
	}
	if req.ImageURL != nil {
		if b := sanitizeSponsorMediaURL(*req.ImageURL); b != "" {
			cur.ImageURL = b
		} else if strings.TrimSpace(*req.ImageURL) == "" {
			writeError(w, http.StatusBadRequest, "imageUrl cannot be empty")
			return
		}
	}
	if req.LinkURL != nil {
		cur.LinkURL = strings.TrimSpace(*req.LinkURL)
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
		UPDATE sponsor_banners SET name=$2, image_url=$3, link_url=$4, forum_id=$5,
			sort_order=$6, is_active=$7, updated_at=NOW()
		WHERE id=$1
	`, id, cur.Name, cur.ImageURL, cur.LinkURL, forum, cur.SortOrder, cur.IsActive); err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) DeleteSponsorBanner(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}
	id := chiURLParam(r, "id")

	var imageURL string
	_ = a.DB.QueryRow(`SELECT image_url FROM sponsor_banners WHERE id=$1`, id).Scan(&imageURL)

	res, err := a.DB.Exec(`DELETE FROM sponsor_banners WHERE id=$1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "sponsor not found")
		return
	}

	// Remove uploaded files only (keep /sponsors/* demo assets in the repo)
	if strings.HasPrefix(imageURL, "/uploads/") && !strings.Contains(imageURL, "..") {
		name := filepath.Base(imageURL)
		if name != "" && name != "." && name != "/" {
			_ = os.Remove(filepath.Join(a.UploadDir, name))
		}
	}

	a.logModeration(claims.UserID, "sponsor.delete", "sponsor", id, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
