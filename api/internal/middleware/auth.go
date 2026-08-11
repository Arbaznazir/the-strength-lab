package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/thestrengthlab/api/internal/auth"
)

type ctxKey string

const UserKey ctxKey = "user"

func AuthOptional(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if claims := bearerClaims(secret, r); claims != nil {
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
			claims := bearerClaims(secret, r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
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
		if claims == nil || (claims.Role != "moderator" && claims.Role != "admin") {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ClaimsFrom(ctx context.Context) *auth.Claims {
	claims, _ := ctx.Value(UserKey).(*auth.Claims)
	return claims
}

func bearerClaims(secret string, r *http.Request) *auth.Claims {
	token := ""
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		token = strings.TrimPrefix(h, "Bearer ")
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		return nil
	}
	claims, err := auth.ParseToken(secret, token)
	if err != nil {
		return nil
	}
	return claims
}
