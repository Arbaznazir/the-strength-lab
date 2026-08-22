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

// SitemapData returns a small set of high-value public URLs for search engines.
// Bulk seeded threads/members are intentionally omitted so Google focuses on hubs.
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

	// Staff / demo accounts only — not the ~18k seeded members.
	memberRows, err := a.DB.Query(`
		SELECT username, COALESCE(last_seen_at, created_at) AS updated_at
		FROM users
		WHERE banned_at IS NULL
		  AND (
			role IN ('admin', 'moderator')
			OR lower(username) IN ('coach', 'spotter', 'lifter')
		  )
		ORDER BY
			CASE WHEN role = 'admin' THEN 0 WHEN role = 'moderator' THEN 1 ELSE 2 END,
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
