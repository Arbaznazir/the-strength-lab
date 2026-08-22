package handlers

import (
	"net/http"
	"time"
)

type sitemapEntry struct {
	Slug      string     `json:"slug"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
}

type sitemapMember struct {
	Username  string     `json:"username"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
}

type sitemapPayload struct {
	Forums  []sitemapEntry  `json:"forums"`
	Threads []sitemapEntry  `json:"threads"`
	Stores  []sitemapEntry  `json:"stores"`
	Members []sitemapMember `json:"members"`
}

// SitemapData returns public URL slugs for search-engine sitemaps (no auth required).
func (a *API) SitemapData(w http.ResponseWriter, r *http.Request) {
	out := sitemapPayload{
		Forums:  []sitemapEntry{},
		Threads: []sitemapEntry{},
		Stores:  []sitemapEntry{},
		Members: []sitemapMember{},
	}

	forumRows, err := a.DB.Query(`
		SELECT slug, COALESCE(last_post_at, NOW()) AS updated_at
		FROM forums
		WHERE slug NOT IN ('weekly-challenges', 'raffles')
		ORDER BY sort_order, name
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	for forumRows.Next() {
		var e sitemapEntry
		var updated time.Time
		if forumRows.Scan(&e.Slug, &updated) == nil {
			e.UpdatedAt = &updated
			out.Forums = append(out.Forums, e)
		}
	}
	forumRows.Close()

	threadRows, err := a.DB.Query(`
		SELECT slug, COALESCE(last_post_at, created_at) AS updated_at
		FROM threads
		ORDER BY last_post_at DESC NULLS LAST
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	for threadRows.Next() {
		var e sitemapEntry
		var updated time.Time
		if threadRows.Scan(&e.Slug, &updated) == nil {
			e.UpdatedAt = &updated
			out.Threads = append(out.Threads, e)
		}
	}
	threadRows.Close()

	storeRows, err := a.DB.Query(`
		SELECT slug, NOW() AS updated_at
		FROM trusted_stores
		WHERE is_active = true
		ORDER BY sort_order, name
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	for storeRows.Next() {
		var e sitemapEntry
		var updated time.Time
		if storeRows.Scan(&e.Slug, &updated) == nil {
			e.UpdatedAt = &updated
			out.Stores = append(out.Stores, e)
		}
	}
	storeRows.Close()

	memberRows, err := a.DB.Query(`
		SELECT username, COALESCE(last_seen_at, created_at) AS updated_at
		FROM users
		WHERE banned_at IS NULL
		ORDER BY
			CASE WHEN role IN ('admin', 'moderator') THEN 0 ELSE 1 END,
			message_count DESC,
			username ASC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	for memberRows.Next() {
		var m sitemapMember
		var updated time.Time
		if memberRows.Scan(&m.Username, &updated) == nil {
			m.UpdatedAt = &updated
			out.Members = append(out.Members, m)
		}
	}
	memberRows.Close()

	writeJSON(w, http.StatusOK, out)
}
