package seed

import (
	"database/sql"
	"log"

	"github.com/google/uuid"
)

const (
	ymsPriceDropAlertBanner = "YMS Price Drop Alert"
	ymsPriceDropAlertImage  = "/sponsors/yms-price-drop-alert.png"
	ymsPriceDropAlertLink   = "https://www.yourmuscleshop.com"
	ymsPriceDropAlertSlug   = "yms-price-drop-alert"
	ymsPriceDropAlertThread = "official-yms-price-drop-alert"
	ymsPriceDropAlertTitle  = "PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS"
	ymsPriceDropAlertBody   = `PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS

Your cart just got cheaper — loot sale picks while stock lasts.

Visit us:
https://www.yourmuscleshop.com
https://www.genlabs.st

Contact us:
Email: support@yourmuscleshop.com
Support@genlabs.st
WhatsApp: +91 96917 10589`
)

func ensureYMSPriceDropAlert(db *sql.DB, forumIDs map[string]string, adminID string) error {
	fid := forumIDs["introductions"]
	if fid == "" {
		_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug='introductions'`).Scan(&fid)
	}

	var storeCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM trusted_stores WHERE slug=$1`, ymsPriceDropAlertSlug).Scan(&storeCount); err != nil {
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
		`, uuid.New(), ymsPriceDropAlertBanner, ymsPriceDropAlertSlug, ymsPriceDropAlertImage, ymsPriceDropAlertLink,
			"PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS",
			forum); err != nil {
			return err
		}
		log.Println("YMS Price Drop Alert trusted store added")
	} else {
		if _, err := db.Exec(`
			UPDATE trusted_stores
			SET name=$2, banner_url=$3, link_url=$4,
			    description=$5, sort_order=0, is_active=true
			WHERE slug=$1
		`, ymsPriceDropAlertSlug, ymsPriceDropAlertBanner, ymsPriceDropAlertImage, ymsPriceDropAlertLink,
			"PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS"); err != nil {
			return err
		}
	}

	var bannerCount int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name = $1 OR image_url LIKE '%yms-price-drop-alert%'
	`, ymsPriceDropAlertBanner).Scan(&bannerCount); err != nil {
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
		`, uuid.New(), ymsPriceDropAlertBanner, ymsPriceDropAlertImage, ymsPriceDropAlertLink, forum); err != nil {
			return err
		}
		log.Println("YMS Price Drop Alert sponsor banner added")
	} else {
		if _, err := db.Exec(`
			UPDATE sponsor_banners
			SET name=$1, image_url=$2, link_url=$3, sort_order=0, is_active=true
			WHERE name = $1 OR image_url LIKE '%yms-price-drop-alert%'
		`, ymsPriceDropAlertBanner, ymsPriceDropAlertImage, ymsPriceDropAlertLink); err != nil {
			return err
		}
	}

	var threadID string
	err := db.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, ymsPriceDropAlertThread).Scan(&threadID)
	if err == sql.ErrNoRows {
		if fid == "" {
			return nil
		}
		tid := uuid.New()
		threadID = tid.String()
		if _, err := db.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured, reply_count, view_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,true,true,0,0,NOW(),$3,NOW(),NOW())
		`, tid, fid, adminID, ymsPriceDropAlertTitle, ymsPriceDropAlertThread); err != nil {
			return err
		}
		if _, err := db.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,NOW(),NOW())
		`, uuid.New(), tid, adminID, ymsPriceDropAlertBody); err != nil {
			return err
		}
		log.Println("YMS Price Drop Alert official thread created")
	} else if err != nil {
		return err
	}

	if threadID != "" {
		if _, err := db.Exec(`UPDATE sponsor_banners SET thread_id=$1 WHERE name=$2 OR image_url=$3`,
			threadID, ymsPriceDropAlertBanner, ymsPriceDropAlertImage); err != nil {
			return err
		}
		if _, err := db.Exec(`UPDATE trusted_stores SET thread_id=$1 WHERE slug=$2`, threadID, ymsPriceDropAlertSlug); err != nil {
			return err
		}
	}

	return nil
}
