package handlers

import (
	"net/http"
	"regexp"
	"strings"
	"sync/atomic"
)

type Role struct {
	Slug        string `json:"slug"`
	Label       string `json:"label"`
	IsStaff     bool   `json:"isStaff"`
	IsProtected bool   `json:"isProtected"`
}

var staffRoles atomic.Value // map[string]struct{}

func (a *API) LoadStaffRoles() {
	m := map[string]struct{}{
		"admin":     {},
		"moderator": {},
	}
	rows, err := a.DB.Query(`SELECT slug FROM roles WHERE is_staff = true`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var slug string
			if rows.Scan(&slug) == nil {
				m[slug] = struct{}{}
			}
		}
	}
	staffRoles.Store(m)
}

func (a *API) IsStaffRole(role string) bool {
	m, ok := staffRoles.Load().(map[string]struct{})
	if !ok {
		return role == "admin" || role == "moderator"
	}
	_, ok = m[role]
	return ok
}

func (a *API) roleIsProtected(slug string) bool {
	var protected bool
	err := a.DB.QueryRow(`SELECT is_protected FROM roles WHERE slug=$1`, slug).Scan(&protected)
	return err == nil && protected
}

var roleSlugRe = regexp.MustCompile(`^[a-z][a-z0-9_-]{1,23}$`)

func (a *API) ListRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`
		SELECT slug, label, is_staff, is_protected
		FROM roles
		ORDER BY is_protected DESC, is_staff DESC, label ASC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	list := []Role{}
	for rows.Next() {
		var role Role
		if rows.Scan(&role.Slug, &role.Label, &role.IsStaff, &role.IsProtected) == nil {
			list = append(list, role)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"roles": list})
}

func (a *API) CreateRole(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil || claims.Role != "admin" {
		writeError(w, http.StatusForbidden, "admin only")
		return
	}

	var req struct {
		Slug    string `json:"slug"`
		Label   string `json:"label"`
		IsStaff bool   `json:"isStaff"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	label := strings.TrimSpace(req.Label)
	if !roleSlugRe.MatchString(slug) {
		writeError(w, http.StatusBadRequest, "slug must be 2-24 chars: lowercase letters, digits, _ or -")
		return
	}
	if label == "" {
		label = slug
	}
	if slug == "admin" {
		writeError(w, http.StatusBadRequest, "cannot create admin role")
		return
	}

	res, err := a.DB.Exec(`
		INSERT INTO roles(slug, label, is_staff, is_protected)
		VALUES($1, $2, $3, false)
		ON CONFLICT (slug) DO NOTHING
	`, slug, label, req.IsStaff)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create failed")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusConflict, "role already exists")
		return
	}

	a.LoadStaffRoles()
	a.logModeration(claims.UserID, "role.create", "role", slug, label)

	writeJSON(w, http.StatusCreated, map[string]any{
		"role": Role{Slug: slug, Label: label, IsStaff: req.IsStaff},
	})
}
