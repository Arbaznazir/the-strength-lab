package config

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Addr           string
	AppEnv         string
	DatabaseURL    string
	RedisURL       string
	JWTSecret      string
	JWTTTLHours    int
	CORSOrigin     string
	CORSOrigins    []string
	SeedOnBoot     bool
	CookieSecure   bool
	CookieSameSite http.SameSite
}

func Load() Config {
	_ = godotenv.Load()
	_ = godotenv.Load(".env")

	appEnv := env("APP_ENV", "development")
	corsRaw := env("CORS_ORIGIN", "http://localhost:3000")
	origins := splitCSV(corsRaw)
	if !isProd(appEnv) {
		origins = uniqueStrings(append(origins,
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		))
	}

	secure := envBool("COOKIE_SECURE", isProd(appEnv) || strings.HasPrefix(origins[0], "https://"))
	sameSite := http.SameSiteLaxMode
	switch strings.ToLower(env("COOKIE_SAMESITE", "")) {
	case "none":
		sameSite = http.SameSiteNoneMode
		secure = true
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "lax":
		sameSite = http.SameSiteLaxMode
	default:
		// Cross-site SPA (different API host) needs None+Secure
		if secure && looksCrossSite(origins) {
			sameSite = http.SameSiteNoneMode
		}
	}

	ttl := envInt("JWT_TTL_HOURS", 24)
	if ttl <= 0 {
		ttl = 24
	}

	cfg := Config{
		Addr:           env("API_ADDR", ":8080"),
		AppEnv:         appEnv,
		DatabaseURL:    env("DATABASE_URL", "postgres://strengthlab:strengthlab@localhost:5432/strengthlab?sslmode=disable"),
		RedisURL:       env("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:      env("JWT_SECRET", "dev-secret-change-me"),
		JWTTTLHours:    ttl,
		CORSOrigin:     origins[0],
		CORSOrigins:    origins,
		SeedOnBoot:     envBool("SEED_ON_BOOT", true),
		CookieSecure:   secure,
		CookieSameSite: sameSite,
	}
	cfg.MustSecure()
	return cfg
}

func (c Config) IsProd() bool { return isProd(c.AppEnv) }

func (c Config) CookieTTL() time.Duration {
	return time.Duration(c.JWTTTLHours) * time.Hour
}

func (c Config) MustSecure() {
	weak := c.JWTSecret == "" ||
		len(c.JWTSecret) < 32 ||
		c.JWTSecret == "dev-secret-change-me" ||
		strings.Contains(strings.ToLower(c.JWTSecret), "change-me")

	if c.IsProd() && weak {
		log.Fatal("FATAL: JWT_SECRET is missing or too weak for production (min 32 chars, not a placeholder)")
	}
	if weak {
		log.Println("WARNING: JWT_SECRET is a weak development default — set a strong secret before production")
	}
	if c.IsProd() && c.SeedOnBoot {
		log.Println("WARNING: SEED_ON_BOOT=true in production — demo accounts/data will be seeded")
	}
}

func isProd(env string) bool {
	e := strings.ToLower(env)
	return e == "production" || e == "prod"
}

func looksCrossSite(origins []string) bool {
	// Heuristic: production HTTPS frontend URLs that aren't localhost
	for _, o := range origins {
		if strings.HasPrefix(o, "https://") && !strings.Contains(o, "localhost") && !strings.Contains(o, "127.0.0.1") {
			return true
		}
	}
	return false
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, strings.TrimRight(p, "/"))
		}
	}
	if len(out) == 0 {
		return []string{"http://localhost:3000"}
	}
	return out
}

func uniqueStrings(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return fallback
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}
