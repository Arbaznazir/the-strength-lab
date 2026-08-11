package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// SecurityHeaders adds baseline browser hardening headers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		h.Set("X-XSS-Protection", "0")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cross-Origin-Resource-Policy", "cross-origin")
		if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		}
		// API responses are JSON — tight CSP for any HTML mistake pages
		if h.Get("Content-Security-Policy") == "" {
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		}
		next.ServeHTTP(w, r)
	})
}

// MaxBody limits request body size (DoS protection).
func MaxBody(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, n)
			}
			next.ServeHTTP(w, r)
		})
	}
}

type visitor struct {
	count    int
	resetAt  time.Time
	mu       sync.Mutex
}

// RateLimiter is a simple per-key fixed window limiter (per-process).
type RateLimiter struct {
	limit  int
	window time.Duration
	mu     sync.Mutex
	vis    map[string]*visitor
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{limit: limit, window: window, vis: map[string]*visitor{}}
	go func() {
		t := time.NewTicker(time.Minute)
		defer t.Stop()
		for range t.C {
			rl.cleanup()
		}
	}()
	return rl
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for k, v := range rl.vis {
		v.mu.Lock()
		expired := now.After(v.resetAt)
		v.mu.Unlock()
		if expired {
			delete(rl.vis, k)
		}
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	v, ok := rl.vis[key]
	if !ok {
		v = &visitor{resetAt: time.Now().Add(rl.window)}
		rl.vis[key] = v
	}
	rl.mu.Unlock()

	v.mu.Lock()
	defer v.mu.Unlock()
	now := time.Now()
	if now.After(v.resetAt) {
		v.count = 0
		v.resetAt = now.Add(rl.window)
	}
	if v.count >= rl.limit {
		return false
	}
	v.count++
	return true
}

func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func RateLimit(rl *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := ClientIP(r)
			if !rl.Allow(ip) {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"rate limit exceeded"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RateLimitKey(rl *RateLimiter, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			if key == "" {
				key = ClientIP(r)
			}
			if !rl.Allow(key) {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"rate limit exceeded"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
