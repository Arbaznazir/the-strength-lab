package seed

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// ensureAdminPosts adds fresh threads authored by coach (admin) across forums.
func ensureAdminPosts(db *sql.DB, forumIDs map[string]string, adminID string) error {
	const seedFlag = "seed_admin_posts_v1"
	var already bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, seedFlag,
	).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}
	if adminID == "" {
		return nil
	}

	type topic struct {
		forum, title, body string
		hoursAgo           int
	}
	topics := []topic{
		{
			forum:    "supplements",
			title:    "Lab note: GenLabs price drop is live — read before you order",
			body:     "Head Coach check-in.\n\nGenLabs / Your Muscle Shop has a limited-time price drop. Keep sourcing talk in-bounds, verify stock before you buy, and use official links only.\n\nShop: https://www.genlabs.st\nForum partner: https://www.yourmuscleshop.com\nSupport: Support@genlabs.st · WhatsApp +91 96917 10589",
			hoursAgo: 1,
		},
		{
			forum:    "general",
			title:    "Weekly lab reminder — form checks over ego",
			body:     "Quick admin note: post videos with side + front angles when you ask for cues. Ego lifting gets roasted; clean progress gets respect.",
			hoursAgo: 4,
		},
		{
			forum:    "introductions",
			title:    "New here? Start with an intro + your current block",
			body:     "Coach here. Drop your training age, main lifts, and what you want from the lab. We’ll point you to the right forums.",
			hoursAgo: 7,
		},
		{
			forum:    "programs",
			title:    "Admin FAQ: how long before you change a program?",
			body:     "Minimum trial is usually one full block (4–6 weeks) unless pain or recovery tanks. Post tonnage if you want a real answer.",
			hoursAgo: 11,
		},
		{
			forum:    "technique",
			title:    "Bar path checklist before you ask for a form check",
			body:     "Post: (1) side angle, (2) working weight, (3) what cue you’re already using. Makes staff feedback 10x sharper.",
			hoursAgo: 16,
		},
		{
			forum:    "nutrition",
			title:    "Coach tip: carbs around heavy lower days",
			body:     "Practical note — most lifters under-eat carbs before long lower sessions. Fix food before you chase accessories.",
			hoursAgo: 20,
		},
		{
			forum:    "recovery",
			title:    "Tendon niggle protocol — admin guidelines",
			body:     "If it’s nagging (not acute tear): reduce intensity, keep frequency, add slow eccentrics. Stop guessing and log symptoms for 7 days.",
			hoursAgo: 28,
		},
		{
			forum:    "hormone-health",
			title:    "Keep hormone threads evidence-first",
			body:     "Staff reminder: bloodwork talk welcome. Source shopping and dosing-for-others is not. Stay in-bounds.",
			hoursAgo: 36,
		},
		{
			forum:    "powerlifting-training",
			title:    "Meet prep openers — coach’s rule of thumb",
			body:     "Open light enough that you’d hit it half-asleep. Second attempt builds the total. Third is only if you’re hot.",
			hoursAgo: 44,
		},
		{
			forum:    "supplements",
			title:    "Trusted stores only — GenLabs & lab partners",
			body:     "Use the Sponsors hub for official threads. GenLabs sale details live here: https://www.genlabs.st — and in the GenLabs sponsor page.",
			hoursAgo: 2,
		},
	}

	now := time.Now().UTC()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var created int
	for _, t := range topics {
		fid := forumIDs[t.forum]
		if fid == "" {
			_ = tx.QueryRow(`SELECT id::text FROM forums WHERE slug=$1`, t.forum).Scan(&fid)
		}
		if fid == "" {
			continue
		}
		slug := fmt.Sprintf("admin-%s", slugify(t.title))
		var exists string
		err := tx.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, slug).Scan(&exists)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return err
		}

		tid := uuid.New()
		at := now.Add(-time.Duration(t.hoursAgo) * time.Hour)
		if _, err := tx.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured,
				view_count, reply_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,false,true,$6,0,$7,$3,$7,$7)
		`, tid, fid, adminID, t.title, slug, 60+t.hoursAgo*3, at); err != nil {
			return err
		}
		if _, err := tx.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,$5)
		`, uuid.New(), tid, adminID, t.body, at); err != nil {
			return err
		}
		created++
	}

	if _, err := tx.Exec(`
		UPDATE forums f SET
			thread_count = (SELECT COUNT(*) FROM threads t WHERE t.forum_id = f.id),
			post_count = COALESCE((
				SELECT COUNT(*) FROM posts p
				JOIN threads t ON t.id = p.thread_id
				WHERE t.forum_id = f.id
			), 0),
			last_thread_id = (
				SELECT t.id FROM threads t WHERE t.forum_id = f.id ORDER BY t.last_post_at DESC NULLS LAST LIMIT 1
			),
			last_post_at = (
				SELECT t.last_post_at FROM threads t WHERE t.forum_id = f.id ORDER BY t.last_post_at DESC NULLS LAST LIMIT 1
			),
			last_poster_id = (
				SELECT t.last_poster_id FROM threads t WHERE t.forum_id = f.id ORDER BY t.last_post_at DESC NULLS LAST LIMIT 1
			)
	`); err != nil {
		return err
	}

	if _, err := tx.Exec(`INSERT INTO schema_migrations(filename) VALUES($1)`, seedFlag); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("admin posts seeded: %d threads by coach", created)
	return nil
}
