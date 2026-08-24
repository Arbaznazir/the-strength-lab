package seed

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

const recentThreadTarget = 75

// ensureRecentActivity adds ~75 threads with replies dated across the last 8 days
// so "Latest" / What's new feels active. Idempotent via schema_migrations flag.
func ensureRecentActivity(db *sql.DB, forumIDs map[string]string) error {
	const seedFlag = "seed_recent_8d_threads_v1"
	var already bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, seedFlag,
	).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	members, err := loadMembers(db)
	if err != nil {
		return err
	}
	if len(members) == 0 {
		return nil
	}

	forumSlugs := make([]string, 0, len(forumIDs))
	for slug := range forumIDs {
		forumSlugs = append(forumSlugs, slug)
	}
	if len(forumSlugs) == 0 {
		return nil
	}

	log.Printf("seeding %d recent threads (past 8 days)…", recentThreadTarget)
	rng := rand.New(rand.NewSource(20260824))
	now := time.Now().UTC()
	windowStart := now.Add(-8 * 24 * time.Hour)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	threadStmt, err := tx.Prepare(`
		INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured,
			view_count, reply_count, last_post_at, last_poster_id, created_at, updated_at)
		VALUES($1,$2,$3,$4,$5,false,$6,$7,$8,$9,$10,$11,$9)
	`)
	if err != nil {
		return err
	}
	defer threadStmt.Close()

	postStmt, err := tx.Prepare(`
		INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
		VALUES($1,$2,$3,$4,$5,$5)
	`)
	if err != nil {
		return err
	}
	defer postStmt.Close()

	for i := 0; i < recentThreadTarget; i++ {
		author := members[rng.Intn(len(members))]
		forumSlug := forumSlugs[rng.Intn(len(forumSlugs))]
		fid := forumIDs[forumSlug]
		tpl := threadTemplates[rng.Intn(len(threadTemplates))]
		title := tpl.title
		if rng.Float32() < 0.4 {
			suffix := []string{"update", "this week", "lab notes", "check-in", "quick Q", "results"}[rng.Intn(6)]
			title = fmt.Sprintf("%s — %s", title, suffix)
		}
		body := tpl.body
		tid := uuid.New()
		createdAt := randomTimeBetween(rng, windowStart, now.Add(-30*time.Minute))
		slug := fmt.Sprintf("fresh-%s-%s", slugify(title), tid.String()[:8])
		featured := rng.Float32() < 0.04
		views := 12 + rng.Intn(420)

		replyCount := 1 + rng.Intn(5) // 1–5 replies after OP
		lastAt := createdAt
		lastPoster := author.id

		if _, err := threadStmt.Exec(
			tid, fid, author.id, title, slug, featured, views, replyCount,
			createdAt, author.id, createdAt,
		); err != nil {
			return err
		}
		if _, err := postStmt.Exec(uuid.New(), tid, author.id, body, createdAt); err != nil {
			return err
		}

		for r := 0; r < replyCount; r++ {
			replier := members[rng.Intn(len(members))]
			replyAt := createdAt.Add(time.Duration(20+rng.Intn(60*(r+1))) * time.Minute)
			if replyAt.After(now) {
				replyAt = now.Add(-time.Duration(rng.Intn(90)) * time.Minute)
			}
			if replyAt.Before(createdAt) {
				replyAt = createdAt.Add(time.Duration(15+r*10) * time.Minute)
			}
			rb := replyBodies[rng.Intn(len(replyBodies))]
			if rng.Float32() < 0.25 && replier.username != author.username {
				rb = fmt.Sprintf("@%s %s", author.username, rb)
			}
			if _, err := postStmt.Exec(uuid.New(), tid, replier.id, rb, replyAt); err != nil {
				return err
			}
			if replyAt.After(lastAt) {
				lastAt = replyAt
				lastPoster = replier.id
			}
		}

		if _, err := tx.Exec(`
			UPDATE threads SET reply_count=$2, last_post_at=$3, last_poster_id=$4, updated_at=$3
			WHERE id=$1
		`, tid, replyCount, lastAt, lastPoster); err != nil {
			return err
		}
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
	log.Printf("recent activity seeded: %d threads over the last 8 days", recentThreadTarget)
	return nil
}
