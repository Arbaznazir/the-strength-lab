package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/thestrengthlab/api/internal/auth"
)

type ctxKey string

const UserKey ctxKey = "user"
const SessionCookie = "tsl_session"

type SessionChecker func(userID string) (role string, banned bool, ok bool)

var sessionChecker SessionChecker
var staffChecker func(string) bool

func SetSessionChecker(fn SessionChecker) { sessionChecker = fn }
func SetStaffChecker(fn func(string) bool) { staffChecker = fn }

// NewSessionCheckerFromDB re-validates ban status and live role on every request.
func NewSessionCheckerFromDB(db *sql.DB) SessionChecker {
	return func(userID string) (role string, banned bool, ok bool) {
		var bannedAt sql.NullTime
		err := db.QueryRow(`SELECT role, banned_at FROM users WHERE id=$1`, userID).Scan(&role, &bannedAt)
		if err != nil {
			return "", false, false
		}
		return role, bannedAt.Valid, true
	}
}

func AuthOptional(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if claims := resolveClaims(secret, r); claims != nil {
				ctx := context.WithValue(r.Context(), UserKey, claims)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func AuthRequired(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := resolveClaims(secret, r)
			if claims == nil {
				writeJSONErr(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			ctx := context.WithValue(r.Context(), UserKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func StaffRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, _ := r.Context().Value(UserKey).(*auth.Claims)
		if claims == nil {
			writeJSONErr(w, http.StatusForbidden, "forbidden")
			return
		}
		staff := claims.Role == "moderator" || claims.Role == "admin"
		if !staff && staffChecker != nil {
			staff = staffChecker(claims.Role)
		}
		if !staff {
			writeJSONErr(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func AdminRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, _ := r.Context().Value(UserKey).(*auth.Claims)
		if claims == nil || claims.Role != "admin" {
			writeJSONErr(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ClaimsFrom(ctx context.Context) *auth.Claims {
	claims, _ := ctx.Value(UserKey).(*auth.Claims)
	return claims
}

func resolveClaims(secret string, r *http.Request) *auth.Claims {
	token := extractToken(r)
	if token == "" {
		return nil
	}
	claims, err := auth.ParseToken(secret, token)
	if err != nil {
		return nil
	}
	if sessionChecker != nil {
		role, banned, ok := sessionChecker(claims.UserID)
		if !ok || banned {
			return nil
		}
		claims.Role = role
	}
	return claims
}

func extractToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		t := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		if t != "" {
			return t
		}
	}
	if c, err := r.Cookie(SessionCookie); err == nil && c.Value != "" {
		return c.Value
	}
	// WS fallback only (prefer cookie). Avoid logging this query in proxies when possible.
	if t := r.URL.Query().Get("token"); t != "" {
		return t
	}
	return ""
}

func writeJSONErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + msg + `"}`))
}

type CookieOpts struct {
	Secure   bool
	SameSite http.SameSite
	TTL      time.Duration
}

func SetSessionCookie(w http.ResponseWriter, token string, opts CookieOpts) {
	maxAge := int(opts.TTL.Seconds())
	if maxAge <= 0 {
		maxAge = 7 * 24 * 3600
	}
	same := opts.SameSite
	if same == 0 {
		same = http.SameSiteLaxMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   opts.Secure,
		SameSite: same,
	})
}

func ClearSessionCookie(w http.ResponseWriter, opts CookieOpts) {
	same := opts.SameSite
	if same == 0 {
		same = http.SameSiteLaxMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   opts.Secure,
		SameSite: same,
	})
}

// AllowedOrigin returns true if origin matches an allowlist entry (exact).
func AllowedOrigin(origin string, allowed []string) bool {
	if origin == "" {
		return false
	}
	for _, a := range allowed {
		if a == "*" || strings.EqualFold(a, origin) {
			return true
		}
	}
	return false
}

// OriginAllowed parses Origin/Referer host against allowlist (for WebSocket).
func OriginAllowed(r *http.Request, allowed []string) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		// non-browser clients / same-host tools
		return true
	}
	if AllowedOrigin(origin, allowed) {
		return true
	}
	// also accept if origin host matches an allowed URL host
	ou, err := url.Parse(origin)
	if err != nil {
		return false
	}
	for _, a := range allowed {
		au, err := url.Parse(a)
		if err != nil {
			continue
		}
		if strings.EqualFold(au.Host, ou.Host) {
			return true
		}
	}
	return false
}
