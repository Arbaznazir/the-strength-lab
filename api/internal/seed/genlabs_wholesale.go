package seed

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

const (
	genlabsWholesaleBanner = "GenLabs Wholesale"
	genlabsWholesaleImage  = "/sponsors/genlabs-wholesale.png"
	genlabsWholesaleLink   = "https://www.yourmuscleshop.com"
	genlabsWholesaleSlug   = "genlabs-wholesale"
	genlabsWholesaleThread = "official-genlabs-wholesale"
	genlabsWholesaleTitle  = "THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON'T MISS OUT"
	genlabsWholesaleBody   = `THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON'T MISS OUT

GENLABS WHOLESALE IS NOW OPEN — bulk orders, better margins, bigger savings.

Visit us:
https://www.yourmuscleshop.com
https://www.genlabs.st

Contact us:
Email: support@yourmuscleshop.com
Support@genlabs.st
WhatsApp: +91 96917 10589`
)

func ensureGenLabsWholesale(db *sql.DB, forumIDs map[string]string, adminID string) error {
	if err := ensureGenLabsWholesaleAssets(db, forumIDs, adminID); err != nil {
		return err
	}
	return ensureGenLabsWholesaleThreads(db, forumIDs, adminID)
}

func ensureGenLabsWholesaleAssets(db *sql.DB, forumIDs map[string]string, adminID string) error {
	fid := forumIDs["supplements"]
	if fid == "" {
		_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug='supplements'`).Scan(&fid)
	}

	var storeCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM trusted_stores WHERE slug=$1`, genlabsWholesaleSlug).Scan(&storeCount); err != nil {
		return err
	}
	if storeCount == 0 {
		var forum any
		if fid != "" {
			forum = fid
		}
		if _, err := db.Exec(`
			INSERT INTO trusted_stores(id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active)
			VALUES($1,$2,$3,'Trusted Source','#e85d5d',$4,$5,$6,$7,0,true)
		`, uuid.New(), genlabsWholesaleBanner, genlabsWholesaleSlug, genlabsWholesaleImage, genlabsWholesaleLink,
			genlabsWholesaleTitle, forum); err != nil {
			return err
		}
		log.Println("GenLabs Wholesale trusted store added")
	} else {
		if _, err := db.Exec(`
			UPDATE trusted_stores
			SET name=$2, banner_url=$3, link_url=$4,
			    description=$5, sort_order=0, is_active=true
			WHERE slug=$1
		`, genlabsWholesaleSlug, genlabsWholesaleBanner, genlabsWholesaleImage, genlabsWholesaleLink,
			genlabsWholesaleTitle); err != nil {
			return err
		}
	}

	var bannerCount int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name = $1 OR image_url LIKE '%genlabs-wholesale%'
	`, genlabsWholesaleBanner).Scan(&bannerCount); err != nil {
		return err
	}
	if bannerCount == 0 {
		var forum any
		if fid != "" {
			forum = fid
		}
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
			VALUES($1,$2,$3,$4,$5,0,true)
		`, uuid.New(), genlabsWholesaleBanner, genlabsWholesaleImage, genlabsWholesaleLink, forum); err != nil {
			return err
		}
		log.Println("GenLabs Wholesale sponsor banner added")
	} else {
		if _, err := db.Exec(`
			UPDATE sponsor_banners
			SET name=$1, image_url=$2, link_url=$3, sort_order=0, is_active=true
			WHERE name = $1 OR image_url LIKE '%genlabs-wholesale%'
		`, genlabsWholesaleBanner, genlabsWholesaleImage, genlabsWholesaleLink); err != nil {
			return err
		}
	}

	var threadID string
	err := db.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, genlabsWholesaleThread).Scan(&threadID)
	if err == sql.ErrNoRows {
		if fid == "" {
			return nil
		}
		tid := uuid.New()
		threadID = tid.String()
		if _, err := db.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured, reply_count, view_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,true,true,0,0,NOW(),$3,NOW(),NOW())
		`, tid, fid, adminID, genlabsWholesaleTitle, genlabsWholesaleThread); err != nil {
			return err
		}
		if _, err := db.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,NOW(),NOW())
		`, uuid.New(), tid, adminID, genlabsWholesaleBody); err != nil {
			return err
		}
		log.Println("GenLabs Wholesale official thread created")
	} else if err != nil {
		return err
	}

	if threadID != "" {
		if _, err := db.Exec(`UPDATE sponsor_banners SET thread_id=$1 WHERE name=$2 OR image_url=$3`,
			threadID, genlabsWholesaleBanner, genlabsWholesaleImage); err != nil {
			return err
		}
		if _, err := db.Exec(`UPDATE trusted_stores SET thread_id=$1 WHERE slug=$2`, threadID, genlabsWholesaleSlug); err != nil {
			return err
		}
	}

	return nil
}

func ensureGenLabsWholesaleThreads(db *sql.DB, forumIDs map[string]string, adminID string) error {
	const seedFlag = "seed_genlabs_wholesale_threads_v1"
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
			title:    "GenLabs wholesale — anyone placed a bulk order?",
			body:     "Wholesale is open via Your Muscle Shop. Looking at bulk orals and vials. Margins look better than retail.\n\nhttps://www.yourmuscleshop.com",
			hoursAgo: 4,
			replies:  3,
		},
		{
			title:    "Wholesale pricing on Gentropin / NAD+",
			body:     "Banner shows Gentropin and NAD+ in the wholesale lineup. Anyone got exclusive pricing notes?",
			hoursAgo: 9,
			replies:  2,
		},
		{
			title:    "support@yourmuscleshop.com wholesale response time",
			body:     "Emailed about a bulk order. How fast has wholesale support been getting back?",
			hoursAgo: 16,
			replies:  2,
		},
	}

	replySnippets := []string{
		"Just emailed support about bulk — waiting on a quote.",
		"Wholesale margins are better than the last retail drop.",
		"Gentropin still showing on the wholesale board.",
		"support@ replied same day for me.",
		"YMS / GenLabs wholesale looks solid.",
		"Don't sleep on bigger savings for bulk.",
	}

	rng := rand.New(rand.NewSource(20260907))
	now := time.Now().UTC()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for i, t := range topics {
		slug := fmt.Sprintf("genlabs-wholesale-%s", slugify(t.title))
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
		views := 40 + rng.Intn(180)

		if _, err := tx.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured,
				view_count, reply_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,false,$6,$7,0,$8,$3,$8,$8)
		`, tid, fid, author.id, t.title, slug, i == 0, views, created); err != nil {
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
			replyAt := created.Add(time.Duration(20+rng.Intn(60)*(r+1)) * time.Minute)
			if replyAt.After(now) {
				replyAt = now.Add(-time.Duration(8+rng.Intn(30)) * time.Minute)
			}
			body := replySnippets[rng.Intn(len(replySnippets))]
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

	if _, err := tx.Exec(`
		UPDATE forums f SET
			thread_count = (SELECT COUNT(*) FROM threads t WHERE t.forum_id = f.id),
			post_count = COALESCE((
				SELECT COUNT(*) FROM posts p
				JOIN threads t ON t.id = p.thread_id
				WHERE t.forum_id = f.id
			), 0)
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
	log.Println("GenLabs Wholesale discussion threads seeded (3)")
	return nil
}
