package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Addr        string
	AppEnv      string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	JWTTTLHours int
	CORSOrigin  string
	SeedOnBoot  bool
}

func Load() Config {
	_ = godotenv.Load()
	_ = godotenv.Load(".env")

	return Config{
		Addr:        env("API_ADDR", ":8080"),
		AppEnv:      env("APP_ENV", "development"),
		DatabaseURL: env("DATABASE_URL", "postgres://strengthlab:strengthlab@localhost:5432/strengthlab?sslmode=disable"),
		RedisURL:    env("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:   env("JWT_SECRET", "dev-secret-change-me"),
		JWTTTLHours: envInt("JWT_TTL_HOURS", 168),
		CORSOrigin:  env("CORS_ORIGIN", "http://localhost:3000"),
		SeedOnBoot:  envBool("SEED_ON_BOOT", true),
	}
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
