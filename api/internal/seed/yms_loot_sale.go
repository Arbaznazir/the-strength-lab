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
	ymsLootSaleBanner = "YMS Loot Sale"
	ymsLootSaleImage  = "/sponsors/yms-loot-sale.jpg"
	ymsLootSaleLink   = "https://www.yourmuscleshop.com"
	ymsLootSaleSlug   = "yms-loot-sale"
	ymsLootSaleThread = "official-yms-loot-sale"
)

// ensureYMSLootSale adds the Your Muscle Shop LOOT SALE banner, trusted store,
// official thread, and starter replies (idempotent).
func ensureYMSLootSale(db *sql.DB, forumIDs map[string]string, adminID string) error {
	if err := ensureYMSLootSaleAssets(db, forumIDs, adminID); err != nil {
		return err
	}
	if err := ensureYMSLootSaleReplies(db, adminID); err != nil {
		return err
	}
	if err := ensureYMSLootSaleThreads(db, forumIDs, adminID); err != nil {
		return err
	}
	return nil
}

func ensureYMSLootSaleAssets(db *sql.DB, forumIDs map[string]string, adminID string) error {
	fid := forumIDs["introductions"]
	if fid == "" {
		_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug='introductions'`).Scan(&fid)
	}

	var storeCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM trusted_stores WHERE slug=$1`, ymsLootSaleSlug).Scan(&storeCount); err != nil {
		return err
	}
	if storeCount == 0 {
		var forum any
		if fid != "" {
			forum = fid
		}
		if _, err := db.Exec(`
			INSERT INTO trusted_stores(id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active)
			VALUES($1,$2,$3,'Trusted Source','#e85d5d',$4,$5,$6,$7,1,true)
		`, uuid.New(), ymsLootSaleBanner, ymsLootSaleSlug, ymsLootSaleImage, ymsLootSaleLink,
			"LOOT SALE — prices just dropped on GenLabs injectables, peptides, orals, HGH/HMG, and more. Only 24 hours left!",
			forum); err != nil {
			return err
		}
		log.Println("YMS Loot Sale trusted store added")
	} else {
		if _, err := db.Exec(`
			UPDATE trusted_stores
			SET name=$2, banner_url=$3, link_url=$4,
			    description=$5, is_active=true
			WHERE slug=$1
		`, ymsLootSaleSlug, ymsLootSaleBanner, ymsLootSaleImage, ymsLootSaleLink,
			"LOOT SALE — prices just dropped on GenLabs injectables, peptides, orals, HGH/HMG, and more. Only 24 hours left!"); err != nil {
			return err
		}
	}

	var bannerCount int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name=$1 OR image_url=$2
	`, ymsLootSaleBanner, ymsLootSaleImage).Scan(&bannerCount); err != nil {
		return err
	}
	if bannerCount == 0 {
		var forum any
		if fid != "" {
			forum = fid
		}
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
			VALUES($1,$2,$3,$4,$5,1,true)
		`, uuid.New(), ymsLootSaleBanner, ymsLootSaleImage, ymsLootSaleLink, forum); err != nil {
			return err
		}
		log.Println("YMS Loot Sale sponsor banner added")
	} else {
		if fid != "" {
			if _, err := db.Exec(`
				UPDATE sponsor_banners
				SET name=$1, image_url=$2, link_url=$3, forum_id=$4, sort_order=1, is_active=true
				WHERE name=$1 OR image_url=$2
			`, ymsLootSaleBanner, ymsLootSaleImage, ymsLootSaleLink, fid); err != nil {
				return err
			}
		}
	}

	title := "LOOT SALE | PRICES JUST DROPPED | YOUR MUSCLE SHOP — ONLY 24 HOURS LEFT"
	body := `Official Your Muscle Shop LOOT SALE thread — prices just dropped to help the community afford more!

We've lowered our prices across GenLabs injectables, peptides, orals, HGH/HMG, and more.

ONLY 24 HOURS LEFT — Limited Time Sale. Don't miss out!

Visit: https://www.yourmuscleshop.com
Email: wholesale@yourmuscleshop.com

DISCREET SHIPPING | UNBEATABLE PRICES | 100% AUTHENTIC`

	var threadID string
	err := db.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, ymsLootSaleThread).Scan(&threadID)
	if err == sql.ErrNoRows {
		if fid == "" {
			return nil
		}
		tid := uuid.New()
		pid := uuid.New()
		threadID = tid.String()
		if _, err := db.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured, reply_count, view_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,true,true,0,120,NOW() - INTERVAL '2 hours',$3,NOW() - INTERVAL '2 hours',NOW() - INTERVAL '2 hours')
		`, tid, fid, adminID, title, ymsLootSaleThread); err != nil {
			return err
		}
		if _, err := db.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,NOW() - INTERVAL '2 hours',NOW() - INTERVAL '2 hours')
		`, pid, tid, adminID, body); err != nil {
			return err
		}
		if _, err := db.Exec(`UPDATE forums SET thread_count=thread_count+1, post_count=post_count+1 WHERE id=$1`, fid); err != nil {
			return err
		}
		log.Println("YMS Loot Sale official thread created")
	} else if err != nil {
		return err
	}

	if _, err := db.Exec(`UPDATE sponsor_banners SET thread_id=$1 WHERE name=$2 OR image_url=$3`, threadID, ymsLootSaleBanner, ymsLootSaleImage); err != nil {
		return err
	}
	if _, err := db.Exec(`UPDATE trusted_stores SET thread_id=$1 WHERE slug=$2`, threadID, ymsLootSaleSlug); err != nil {
		return err
	}
	return nil
}

func ensureYMSLootSaleReplies(db *sql.DB, adminID string) error {
	const seedFlag = "seed_yms_loot_sale_replies_v1"
	var already bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, seedFlag,
	).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	var threadID string
	if err := db.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, ymsLootSaleThread).Scan(&threadID); err != nil {
		return nil
	}

	members, err := loadMembers(db)
	if err != nil || len(members) == 0 {
		return err
	}

	replies := []string{
		"Loot sale banner is live — Test Cyp and Accutane prices are stupid low right now.",
		"Grabbed HMG and NAD+ before the 24h window closes. Shop: https://www.yourmuscleshop.com",
		"Anyone tried Retatrutide from this drop? Thinking of stocking up.",
		"Emailed wholesale@yourmuscleshop.com — got a reply in under an hour.",
	}
	rng := rand.New(rand.NewSource(42))
	for i, body := range replies {
		author := members[rng.Intn(len(members))]
		pid := uuid.New()
		created := fmt.Sprintf("NOW() - INTERVAL '%d minutes'", 90-i*18)
		if _, err := db.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,`+created+`,`+created+`)
		`, pid, threadID, author.id, body); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`
		UPDATE threads SET reply_count=reply_count+$1, last_post_at=NOW() - INTERVAL '12 minutes', last_poster_id=$2
		WHERE id=$3
	`, len(replies), members[0].id, threadID); err != nil {
		return err
	}

	var forumID string
	_ = db.QueryRow(`SELECT forum_id::text FROM threads WHERE id=$1`, threadID).Scan(&forumID)
	if forumID != "" {
		if _, err := db.Exec(`UPDATE forums SET post_count=post_count+$1 WHERE id=$2`, len(replies), forumID); err != nil {
			return err
		}
	}

	if _, err := db.Exec(`INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING`, seedFlag); err != nil {
		return err
	}
	log.Printf("YMS Loot Sale thread replies seeded (%d)", len(replies))
	return nil
}

// ensureYMSLootSaleThreads adds recent loot-sale discussion threads so the
// sponsor hub and Latest feed look active.
func ensureYMSLootSaleThreads(db *sql.DB, forumIDs map[string]string, adminID string) error {
	const seedFlag = "seed_yms_loot_sale_threads_v1"
	var already bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, seedFlag,
	).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	fid := forumIDs["introductions"]
	if fid == "" {
		_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug='introductions'`).Scan(&fid)
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
			title:    "YMS loot sale — Test Cyp pricing anyone?",
			body:     "The LOOT SALE banner just dropped. Test Cyp 200mg/ml looks way cheaper than last month. Anyone ordering from Your Muscle Shop today?\n\nhttps://www.yourmuscleshop.com",
			hoursAgo: 2,
			replies:  5,
		},
		{
			title:    "Accutane on the loot sale — worth it?",
			body:     "Saw Accutane 30mg on the YMS promo graphic. Never ordered orals from them — legit batches?",
			hoursAgo: 4,
			replies:  4,
		},
		{
			title:    "ONLY 24 HOURS — loot sale stock check",
			body:     "Banner says only 24 hours left on the Your Muscle Shop drop. HMG and NAD+ still showing for anyone else?\n\nEmail: wholesale@yourmuscleshop.com",
			hoursAgo: 6,
			replies:  3,
		},
		{
			title:    "Retatrutide pen from YMS loot sale",
			body:     "Thinking about the Retatrutide 20mg pen while prices are down. Shipping speed from YMS / GenLabs lately?",
			hoursAgo: 9,
			replies:  4,
		},
		{
			title:    "HMG + NAD+ bundle during loot sale",
			body:     "Grabbed HMG 75iu and NAD+ 1000mg from the sale. Will post bloodwork notes when it lands.",
			hoursAgo: 12,
			replies:  3,
		},
		{
			title:    "wholesale@yourmuscleshop.com response time?",
			body:     "Emailed wholesale about a bulk order during the loot sale. How fast has their team been getting back?",
			hoursAgo: 16,
			replies:  2,
		},
		{
			title:    "GenLabs products on YMS — loot sale haul",
			body:     "Restocked Test E, Accutane, and peptides from the Your Muscle Shop LOOT SALE. Prices actually dropped like the banner says.",
			hoursAgo: 20,
			replies:  4,
		},
		{
			title:    "Discreet shipping from Your Muscle Shop — loot sale order",
			body:     "First order during the loot sale. Packaging and tracking were clean last time — hoping same again.\n\nShop: https://www.yourmuscleshop.com",
			hoursAgo: 28,
			replies:  3,
		},
	}

	replySnippets := []string{
		"Just placed an order — loot sale prices are real.",
		"Test Cyp landed in 5 days for me last order.",
		"Accutane batch looked on point — no issues.",
		"HMG still in stock when I checked an hour ago.",
		"wholesale@ replied same day for me.",
		"Don't sleep on it — 24h window goes fast.",
		"Retatrutide pen was legit, no complaints.",
		"NAD+ pricing on this drop is the best I've seen.",
		"Grabbed peptides before stock thins out.",
		"YMS / GenLabs combo has been solid for me.",
	}

	rng := rand.New(rand.NewSource(20260828))
	now := time.Now().UTC()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for i, t := range topics {
		slug := fmt.Sprintf("yms-loot-%s", slugify(t.title))
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
		views := 55 + rng.Intn(280)

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
			replyAt := created.Add(time.Duration(20+rng.Intn(75)*(r+1)) * time.Minute)
			if replyAt.After(now) {
				replyAt = now.Add(-time.Duration(8+rng.Intn(35)) * time.Minute)
			}
			body := replySnippets[rng.Intn(len(replySnippets))]
			if rng.Float32() < 0.28 && replier.id != author.id {
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

	var officialID string
	_ = tx.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, ymsLootSaleThread).Scan(&officialID)
	if officialID != "" {
		officialReplies := []string{
			"Loot sale is live — Test Cyp and Accutane prices are stupid low.",
			"24 hours left per the banner. Don't wait.",
			"https://www.yourmuscleshop.com — link for anyone new.",
			"wholesale@yourmuscleshop.com answered my stock question fast.",
			"Grabbed HMG + Retatrutide before the window closes.",
		}
		for i, body := range officialReplies {
			replier := members[rng.Intn(len(members))]
			at := now.Add(-time.Duration(1+i*3) * time.Hour)
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
	log.Println("YMS Loot Sale recent threads seeded (8 threads + official thread replies)")
	return nil
}
