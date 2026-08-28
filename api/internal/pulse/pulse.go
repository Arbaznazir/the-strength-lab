package pulse

import (
	"database/sql"
	"log"
	"time"
)

// Start keeps forum activity timestamps feeling live (recent replies, fresh forums).
func Start(db *sql.DB) {
	go func() {
		time.Sleep(8 * time.Second)
		refresh(db)
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			refresh(db)
		}
	}()
}

func refresh(db *sql.DB) {
	if err := refreshHotThreads(db); err != nil {
		log.Printf("pulse: hot threads: %v", err)
	}
	if err := syncForumActivity(db); err != nil {
		log.Printf("pulse: forums: %v", err)
	}
	if err := bumpViews(db); err != nil {
		log.Printf("pulse: views: %v", err)
	}
}

// Stagger last_post_at across the last hour so lists show "5 min ago", "22 min ago", etc.
func refreshHotThreads(db *sql.DB) error {
	if _, err := db.Exec(`
		UPDATE threads AS t
		SET
			last_post_at = NOW() - ((1 + floor(random() * 4))::int || ' minutes')::interval,
			updated_at = NOW()
		WHERE t.id IN (
			SELECT id FROM threads
			WHERE NOT is_locked
			ORDER BY random()
			LIMIT 5
		)
	`); err != nil {
		return err
	}

	_, err := db.Exec(`
		UPDATE threads AS t
		SET
			last_post_at = NOW() - ((4 + floor(random() * 52))::int || ' minutes')::interval,
			updated_at = NOW()
		WHERE t.id IN (
			SELECT id FROM threads
			WHERE NOT is_locked
			ORDER BY
				CASE WHEN is_pinned THEN 0 WHEN is_featured THEN 1 ELSE 2 END,
				random()
			LIMIT 32
		)
	`)
	return err
}

func syncForumActivity(db *sql.DB) error {
	_, err := db.Exec(`
		UPDATE forums f
		SET
			last_post_at = x.last_post_at,
			last_thread_id = x.thread_id,
			last_poster_id = x.last_poster_id
		FROM (
			SELECT DISTINCT ON (t.forum_id)
				t.forum_id,
				t.id AS thread_id,
				t.last_post_at,
				t.last_poster_id
			FROM threads t
			ORDER BY t.forum_id, t.last_post_at DESC NULLS LAST
		) x
		WHERE f.id = x.forum_id
	`)
	return err
}

func bumpViews(db *sql.DB) error {
	_, err := db.Exec(`
		UPDATE threads
		SET view_count = view_count + 1 + floor(random() * 5)::int
		WHERE id IN (
			SELECT id FROM threads ORDER BY random() LIMIT 14
		)
	`)
	return err
}
