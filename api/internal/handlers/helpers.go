package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/auth"
	"github.com/thestrengthlab/api/internal/middleware"
	"github.com/thestrengthlab/api/internal/models"
	"github.com/thestrengthlab/api/internal/realtime"
)

type API struct {
	DB             *sql.DB
	JWTSecret      string
	JWTTTL         int
	Hub            *realtime.Hub
	Typing         *realtime.TypingTracker
	Guests         *GuestTracker
	UploadDir      string
	CookieSecure   bool
	CookieSameSite http.SameSite
	AllowedOrigins []string
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

const maxJSONBody = 1 << 20 // 1MB

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	r.Body = http.MaxBytesReader(nil, r.Body, maxJSONBody)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func (a *API) cookieOpts() middleware.CookieOpts {
	return middleware.CookieOpts{
		Secure:   a.CookieSecure,
		SameSite: a.CookieSameSite,
		TTL:      time.Duration(a.JWTTTL) * time.Hour,
	}
}

func (a *API) setAuthCookie(w http.ResponseWriter, token string) {
	middleware.SetSessionCookie(w, token, a.cookieOpts())
}

func (a *API) clearAuthCookie(w http.ResponseWriter) {
	middleware.ClearSessionCookie(w, a.cookieOpts())
}

// sanitizeMediaURL only allows same-origin upload paths (blocks arbitrary remote URLs).
func sanitizeMediaURL(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.HasPrefix(s, "/uploads/") && !strings.Contains(s, "..") && !strings.Contains(s, "\\") {
		return s
	}
	return ""
}

func clampBody(s string, max int) (string, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", false
	}
	if len(s) > max {
		return "", false
	}
	return s, true
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "thread"
	}
	if len(s) > 80 {
		s = s[:80]
	}
	return s
}

func touchLastSeen(db *sql.DB, userID string) {
	_, _ = db.Exec(`UPDATE users SET last_seen_at=NOW(), updated_at=NOW() WHERE id=$1`, userID)
}

func scanUser(scanner interface {
	Scan(dest ...any) error
}) (models.UserPublic, error) {
	var u models.UserPublic
	var lastSeen sql.NullTime
	err := scanner.Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.Title, &u.Bio, &u.AvatarURL, &u.BannerURL,
		&u.Role, &u.MessageCount, &u.ReactionScore, &u.TrophyPoints, &u.FollowerCount, &lastSeen, &u.CreatedAt,
	)
	if err != nil {
		return u, err
	}
	if lastSeen.Valid {
		t := lastSeen.Time
		u.LastSeenAt = &t
	}
	if u.DisplayName == "" {
		u.DisplayName = u.Username
	}
	return u, nil
}

const userSelect = `id::text, username, COALESCE(NULLIF(display_name,''), username), title, bio, avatar_url, banner_url, role, message_count, reaction_score, trophy_points, follower_count, last_seen_at, created_at`

func (a *API) getUserByID(id string) (models.UserPublic, error) {
	row := a.DB.QueryRow(`SELECT `+userSelect+` FROM users WHERE id=$1`, id)
	u, err := scanUser(row)
	if err != nil {
		return u, err
	}
	a.attachUserTags(&u)
	return u, nil
}

func (a *API) getUserByUsername(username string) (models.UserPublic, error) {
	row := a.DB.QueryRow(`SELECT `+userSelect+` FROM users WHERE lower(username)=lower($1)`, username)
	u, err := scanUser(row)
	if err != nil {
		return u, err
	}
	a.attachUserTags(&u)
	return u, nil
}

func validUsername(s string) bool {
	if len(s) < 3 || len(s) > 24 {
		return false
	}
	for _, r := range s {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-') {
			return false
		}
	}
	return true
}

func (a *API) requireUser(r *http.Request) *auth.Claims {
	return middleware.ClaimsFrom(r.Context())
}

func (a *API) createAlert(userID, kind, title, body, link string) {
	_, _ = a.DB.Exec(
		`INSERT INTO alerts(user_id, kind, title, body, link) VALUES($1,$2,$3,$4,$5)`,
		userID, kind, title, body, link,
	)
}

func nullStringPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	return &s
}

func nullTimePtr(nt sql.NullTime) *time.Time {
	if !nt.Valid {
		return nil
	}
	t := nt.Time
	return &t
}

func uuidOrNew() string {
	return uuid.NewString()
}

// DefaultPageSize is the standard list page size across forum threads, posts, members, etc.
const DefaultPageSize = 10

func parsePage(r *http.Request) int {
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	return page
}

func parseLimit(r *http.Request, fallback, max int) int {
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= max {
		return n
	}
	return fallback
}

func paginate(total, page, perPage int) (pages, offset, clampedPage int) {
	if perPage <= 0 {
		perPage = DefaultPageSize
	}
	pages = total / perPage
	if total%perPage != 0 {
		pages++
	}
	if pages == 0 {
		pages = 1
	}
	if page > pages {
		page = pages
	}
	if page < 1 {
		page = 1
	}
	offset = (page - 1) * perPage
	return pages, offset, page
}
