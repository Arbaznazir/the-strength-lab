package seed

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// ensureGenLabsPosts adds recent GenLabs discussion threads + replies on the
// official promo thread so the sponsor hub and Latest look active.
func ensureGenLabsPosts(db *sql.DB, forumIDs map[string]string, adminID string) error {
	const seedFlag = "seed_genlabs_posts_v1"
	var already bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, seedFlag,
	).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	fid := forumIDs["supplements"]
	if fid == "" {
		_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug='supplements'`).Scan(&fid)
	}
	if fid == "" {
		return nil
	}

	members, err := loadMembers(db)
	if err != nil || len(members) == 0 {
		return err
	}

	type topic struct {
		title, body string
		hoursAgo    int
		replies     int
	}
	topics := []topic{
		{
			title:    "GenLabs price drop — anyone ordering this weekend?",
			body:     "Saw the biggest price drop promo. Looking at Gentropin and Test E. Anyone ordered from GenLabs / Your Muscle Shop lately?\n\nShop: https://www.genlabs.st",
			hoursAgo: 3,
			replies:  4,
		},
		{
			title:    "GenLabs Retatrutide — shipping times?",
			body:     "Thinking about grabbing Retatrutide while the sale is on. What’s typical shipping time from GenLabs / YMS?",
			hoursAgo: 8,
			replies:  3,
		},
		{
			title:    "Anadrol 50 from GenLabs — batch notes",
			body:     "Picked up Anadrol during the price drop. Will update with first impressions once it lands. Shop: https://www.yourmuscleshop.com",
			hoursAgo: 14,
			replies:  2,
		},
		{
			title:    "HMG + HGH stack — GenLabs stock check",
			body:     "Anyone confirm HMG / Gentropin still in stock on the sale? Limited stock warning on the banner.",
			hoursAgo: 22,
			replies:  3,
		},
		{
			title:    "GenLabs WhatsApp support response time",
			body:     "Messaged +91 96917 10589 about an order question. How fast has support been for you?",
			hoursAgo: 30,
			replies:  2,
		},
		{
			title:    "Peptides on GenLabs sale — what’s worth grabbing?",
			body:     "Price drop covers peptides too. What’s actually worth stocking up on vs skipping?",
			hoursAgo: 40,
			replies:  5,
		},
		{
			title:    "GenLabs vs other labs — why I’m sticking with YMS",
			body:     "Been with Your Muscle Shop / GenLabs for a while. Sale is a good excuse to restock Test E and orals. Forum: https://www.yourmuscleshopforum.com/index.php",
			hoursAgo: 52,
			replies:  3,
		},
		{
			title:    "ONLY 2 DAYS — GenLabs limited stock heads-up",
			body:     "Banner says only 2 days to shop. If you’re on the fence about Gentropin or Retatrutide, don’t sleep on it.\n\nhttps://www.genlabs.st\nSupport: Support@genlabs.st",
			hoursAgo: 5,
			replies:  4,
		},
	}

	replySnippets := []string{
		"Just ordered — will update when tracking hits.",
		"Shipping was solid last time for me.",
		"Grabbed Test E + Anadrol. Prices are actually good right now.",
		"Support replied same day on WhatsApp.",
		"Stock was still showing for Gentropin earlier today.",
		"Thanks for the heads-up — placing an order tonight.",
		"Peptides sold out fast last drop — moving sooner this time.",
		"Good call. Limited stock isn’t a joke on these sales.",
	}

	rng := rand.New(rand.NewSource(20260826))
	now := time.Now().UTC()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for i, t := range topics {
		slug := fmt.Sprintf("genlabs-%s", slugify(t.title))
		var exists string
		err := tx.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, slug).Scan(&exists)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return err
		}

		author := members[rng.Intn(len(members))]
		if i%3 == 0 && adminID != "" {
			author.id = adminID
		}
		tid := uuid.New()
		created := now.Add(-time.Duration(t.hoursAgo) * time.Hour)
		views := 40 + rng.Intn(220)

		if _, err := tx.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured,
				view_count, reply_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,false,$6,$7,0,$8,$3,$8,$8)
		`, tid, fid, author.id, t.title, slug, i < 2, views, created); err != nil {
			return err
		}
		if _, err := tx.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,$5)
		`, uuid.New(), tid, author.id, t.body, created); err != nil {
			return err
		}

		lastAt := created
		lastPoster := author.id
		for r := 0; r < t.replies; r++ {
			replier := members[rng.Intn(len(members))]
			replyAt := created.Add(time.Duration(25+rng.Intn(90)*(r+1)) * time.Minute)
			if replyAt.After(now) {
				replyAt = now.Add(-time.Duration(10+rng.Intn(40)) * time.Minute)
			}
			body := replySnippets[rng.Intn(len(replySnippets))]
			if rng.Float32() < 0.3 && replier.id != author.id {
				var uname string
				_ = tx.QueryRow(`SELECT username FROM users WHERE id=$1`, author.id).Scan(&uname)
				if uname != "" {
					body = fmt.Sprintf("@%s %s", uname, body)
				}
			}
			if _, err := tx.Exec(`
				INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
				VALUES($1,$2,$3,$4,$5,$5)
			`, uuid.New(), tid, replier.id, body, replyAt); err != nil {
				return err
			}
			if replyAt.After(lastAt) {
				lastAt = replyAt
				lastPoster = replier.id
			}
		}
		if _, err := tx.Exec(`
			UPDATE threads SET reply_count=$2, last_post_at=$3, last_poster_id=$4, updated_at=$3 WHERE id=$1
		`, tid, t.replies, lastAt, lastPoster); err != nil {
			return err
		}
	}

	// Fresh replies on the official GenLabs thread
	var officialID string
	_ = tx.QueryRow(`SELECT id::text FROM threads WHERE slug='official-genlabs'`).Scan(&officialID)
	if officialID != "" {
		officialReplies := []string{
			"Price drop is live — Gentropin still showing in stock for me.",
			"Contacted Support@genlabs.st — quick reply.",
			"WhatsApp +91 96917 10589 confirmed shipping ETA.",
			"Stocked up on Test E and peptides. Don’t miss this one.",
			"Linked the shop for anyone new: https://www.genlabs.st",
		}
		for i, body := range officialReplies {
			replier := members[rng.Intn(len(members))]
			at := now.Add(-time.Duration(2+i*5) * time.Hour)
			if _, err := tx.Exec(`
				INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
				VALUES($1,$2,$3,$4,$5,$5)
			`, uuid.New(), officialID, replier.id, body, at); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(`
			UPDATE threads SET
				reply_count = (SELECT COUNT(*)-1 FROM posts WHERE thread_id=$1),
				last_post_at = (SELECT MAX(created_at) FROM posts WHERE thread_id=$1),
				last_poster_id = (
					SELECT author_id FROM posts WHERE thread_id=$1 ORDER BY created_at DESC LIMIT 1
				),
				updated_at = NOW()
			WHERE id=$1
		`, officialID); err != nil {
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
		WHERE f.id = $1
	`, fid); err != nil {
		return err
	}

	if _, err := tx.Exec(`INSERT INTO schema_migrations(filename) VALUES($1)`, seedFlag); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Println("GenLabs recent posts seeded (8 threads + official thread replies)")
	return nil
}
