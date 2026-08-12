package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/thestrengthlab/api/internal/config"
	"github.com/thestrengthlab/api/internal/db"
	"github.com/thestrengthlab/api/internal/handlers"
	"github.com/thestrengthlab/api/internal/middleware"
	"github.com/thestrengthlab/api/internal/realtime"
	"github.com/thestrengthlab/api/internal/seed"
)

func main() {
	cfg := config.Load()

	sqlDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer sqlDB.Close()

	migDir := os.Getenv("MIGRATIONS_DIR")
	if migDir == "" {
		migDir = findMigrations()
	}
	if err := db.Migrate(sqlDB, migDir); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if cfg.SeedOnBoot {
		if err := seed.Run(sqlDB); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}

	api := &handlers.API{
		DB:             sqlDB,
		JWTSecret:      cfg.JWTSecret,
		JWTTTL:         cfg.JWTTTLHours,
		Hub:            realtime.NewHub(),
		Typing:         realtime.NewTypingTracker(),
		Guests:         handlers.NewGuestTracker(),
		UploadDir:      envOr("UPLOAD_DIR", "uploads"),
		CookieSecure:   cfg.CookieSecure,
		CookieSameSite: cfg.CookieSameSite,
		AllowedOrigins: cfg.CORSOrigins,
	}
	_ = os.MkdirAll(api.UploadDir, 0o755)

	api.LoadStaffRoles()
	middleware.SetStaffChecker(api.IsStaffRole)
	middleware.SetSessionChecker(middleware.NewSessionCheckerFromDB(sqlDB))

	globalRL := middleware.NewRateLimiter(180, time.Minute)
	authRL := middleware.NewRateLimiter(12, time.Minute)
	writeRL := middleware.NewRateLimiter(60, time.Minute)
	searchRL := middleware.NewRateLimiter(45, time.Minute)
	uploadRL := middleware.NewRateLimiter(20, time.Minute)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.SecurityHeaders)
	// Allow image/video banner uploads (handler still enforces its own 8MB cap)
	r.Use(middleware.MaxBody(10 << 20))
	r.Use(middleware.RateLimit(globalRL))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(middleware.AuthOptional(cfg.JWTSecret))

	fileServer := http.StripPrefix("/uploads/", http.FileServer(http.Dir(api.UploadDir)))
	r.Handle("/uploads/*", fileServer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"service":"the-strength-lab-api"}`))
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"name":"The Strength Lab","version":"0.1.0"}`))
		})

		r.With(middleware.RateLimit(authRL)).Post("/auth/register", api.Register)
		r.With(middleware.RateLimit(authRL)).Post("/auth/login", api.Login)
		r.Post("/auth/logout", api.Logout)

		r.Get("/forums", api.ListForumTree)
		r.Get("/forums/{slug}", api.GetForum)
		r.Get("/threads/{slug}", api.GetThread)
		r.Get("/whats-new", api.WhatsNew)
		r.Get("/trending", api.Trending)
		r.With(middleware.RateLimit(searchRL)).Get("/search", api.Search)
		r.Get("/stats", api.Stats)
		r.Get("/online", api.Online)
		r.Get("/members/overview", api.MembersOverview)
		r.Get("/members", api.ListMembers)
		r.Get("/members/{username}", api.GetMember)
		r.Get("/members/{username}/profile-posts", api.ListProfilePosts)
		r.Get("/chat", api.ListChat)
		r.Get("/trusted-stores", api.ListTrustedStores)
		r.Get("/sponsor-banners", api.ListSponsorBanners)
		r.Get("/profile-tags", api.ListProfileTags)

		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthRequired(cfg.JWTSecret))
			r.Get("/me", api.Me)
			r.With(middleware.RateLimit(writeRL)).Patch("/me", api.UpdateProfile)
			r.With(middleware.MaxBody(10<<20), middleware.RateLimit(uploadRL)).Post("/uploads", api.Upload)
			r.With(middleware.RateLimit(writeRL)).Post("/forums/{slug}/threads", api.CreateThread)
			r.With(middleware.RateLimit(writeRL)).Post("/threads/{slug}/replies", api.ReplyThread)
			r.Post("/threads/{slug}/watch", api.WatchThread)
			r.Delete("/threads/{slug}/watch", api.UnwatchThread)
			r.With(middleware.RateLimit(writeRL)).Post("/posts/{id}/reactions", api.ReactPost)
			r.Get("/alerts", api.ListAlerts)
			r.Post("/alerts/read", api.MarkAlertsRead)
			r.With(middleware.RateLimit(writeRL)).Post("/members/{username}/profile-posts", api.CreateProfilePost)
			r.Get("/messages", api.ListConversations)
			r.With(middleware.RateLimit(writeRL)).Post("/messages", api.CreateConversation)
			r.Get("/messages/{id}", api.GetConversation)
			r.With(middleware.RateLimit(writeRL)).Post("/messages/{id}", api.ReplyConversation)
			r.With(middleware.RateLimit(writeRL)).Post("/chat", api.PostChat)
			r.Get("/ws/chat", api.ChatWS)
			r.Get("/ws/messages", api.MessagesWS)
			r.With(middleware.RateLimit(writeRL)).Post("/reports", api.Report)
			r.Group(func(r chi.Router) {
				r.Use(middleware.StaffRequired)
				r.Get("/admin/dashboard", api.AdminDashboard)
				r.Get("/admin/reports", api.ListReports)
				r.Post("/admin/reports/{id}/resolve", api.ResolveReport)
				r.Patch("/admin/threads/{slug}", api.ModThread)
				r.Delete("/admin/threads/{slug}", api.DeleteThread)
				r.Delete("/admin/posts/{id}", api.DeletePost)
				r.Get("/admin/users", api.ListAdminUsers)
				r.Patch("/admin/users/{id}", api.PatchAdminUser)
				r.Put("/admin/users/{id}/tags", api.SetUserTags)
				r.Get("/admin/log", api.ListModerationLog)
				r.Get("/admin/roles", api.ListRoles)
				r.With(middleware.AdminRequired).Post("/admin/roles", api.CreateRole)
				r.Get("/admin/tags", api.ListProfileTags)
				r.With(middleware.AdminRequired).Post("/admin/tags", api.CreateProfileTag)
				r.With(middleware.AdminRequired).Patch("/admin/tags/{slug}", api.PatchProfileTag)
				r.With(middleware.AdminRequired).Delete("/admin/tags/{slug}", api.DeleteProfileTag)
				r.Get("/admin/stores", func(w http.ResponseWriter, r *http.Request) {
					q := r.URL.Query()
					q.Set("all", "1")
					r.URL.RawQuery = q.Encode()
					api.ListTrustedStores(w, r)
				})
				r.With(middleware.AdminRequired).Post("/admin/stores", api.CreateTrustedStore)
				r.With(middleware.AdminRequired).Patch("/admin/stores/{id}", api.PatchTrustedStore)
				r.With(middleware.AdminRequired).Delete("/admin/stores/{id}", api.DeleteTrustedStore)
				r.Get("/admin/sponsors", func(w http.ResponseWriter, r *http.Request) {
					q := r.URL.Query()
					q.Set("all", "1")
					r.URL.RawQuery = q.Encode()
					api.ListSponsorBanners(w, r)
				})
				r.With(middleware.AdminRequired).Post("/admin/sponsors", api.CreateSponsorBanner)
				r.With(middleware.AdminRequired).Patch("/admin/sponsors/{id}", api.PatchSponsorBanner)
				r.With(middleware.AdminRequired).Delete("/admin/sponsors/{id}", api.DeleteSponsorBanner)
			})
		})
	})

	log.Printf("The Strength Lab API on %s (env=%s, cors=%v)", cfg.Addr, cfg.AppEnv, cfg.CORSOrigins)
	if err := http.ListenAndServe(cfg.Addr, r); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func findMigrations() string {
	candidates := []string{"migrations", "./migrations", "/app/migrations"}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && st.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	return "migrations"
}
