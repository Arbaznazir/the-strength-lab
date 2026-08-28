package seed

import (
	"database/sql"
	"log"

	"github.com/google/uuid"
)

const (
	genlabsLootSaleBanner = "GenLabs Loot Sale"
	genlabsLootSaleImage  = "/sponsors/genlabs-loot-sale.png"
	genlabsLootSaleLink   = "https://www.genlabs.st"
	genlabsLootSaleSlug   = "genlabs-loot-sale"
	genlabsLootSaleThread = "official-genlabs-loot-sale"
	genlabsLootSaleTitle  = "THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM"
	genlabsLootSaleBody   = `THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM

VISIT US:

https://www.genlabs.st
https://www.yourmuscleshop.com

Contact Us:

Email: Support@genlabs.st
WhatsApp: +91 96917 10589`
)

// ensureGenLabsLootSale adds the GenLabs Loot Sale banner, trusted store, and official thread.
func ensureGenLabsLootSale(db *sql.DB, forumIDs map[string]string, adminID string) error {
	return ensureGenLabsLootSaleAssets(db, forumIDs, adminID)
}

func ensureGenLabsLootSaleAssets(db *sql.DB, forumIDs map[string]string, adminID string) error {
	fid := forumIDs["supplements"]
	if fid == "" {
		_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug='supplements'`).Scan(&fid)
	}

	var storeCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM trusted_stores WHERE slug=$1`, genlabsLootSaleSlug).Scan(&storeCount); err != nil {
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
		`, uuid.New(), genlabsLootSaleBanner, genlabsLootSaleSlug, genlabsLootSaleImage, genlabsLootSaleLink,
			"THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM",
			forum); err != nil {
			return err
		}
		log.Println("GenLabs Loot Sale trusted store added")
	} else {
		if _, err := db.Exec(`
			UPDATE trusted_stores
			SET name=$2, banner_url=$3, link_url=$4,
			    description=$5, sort_order=0, is_active=true
			WHERE slug=$1
		`, genlabsLootSaleSlug, genlabsLootSaleBanner, genlabsLootSaleImage, genlabsLootSaleLink,
			"THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM"); err != nil {
			return err
		}
	}

	var bannerCount int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name ILIKE '%genlabs loot%' OR image_url LIKE '%genlabs-loot-sale%'
	`).Scan(&bannerCount); err != nil {
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
		`, uuid.New(), genlabsLootSaleBanner, genlabsLootSaleImage, genlabsLootSaleLink, forum); err != nil {
			return err
		}
		log.Println("GenLabs Loot Sale sponsor banner added")
	} else {
		if _, err := db.Exec(`
			UPDATE sponsor_banners
			SET name=$1, image_url=$2, link_url=$3, sort_order=0, is_active=true
			WHERE name ILIKE '%genlabs loot%' OR image_url LIKE '%genlabs-loot-sale%'
		`, genlabsLootSaleBanner, genlabsLootSaleImage, genlabsLootSaleLink); err != nil {
			return err
		}
	}

	var threadID string
	err := db.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, genlabsLootSaleThread).Scan(&threadID)
	if err == sql.ErrNoRows {
		if fid == "" {
			return nil
		}
		tid := uuid.New()
		threadID = tid.String()
		if _, err := db.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured, reply_count, view_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,true,true,0,0,NOW(),$3,NOW(),NOW())
		`, tid, fid, adminID, genlabsLootSaleTitle, genlabsLootSaleThread); err != nil {
			return err
		}
		if _, err := db.Exec(`
			INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
			VALUES($1,$2,$3,$4,NOW(),NOW())
		`, uuid.New(), tid, adminID, genlabsLootSaleBody); err != nil {
			return err
		}
		log.Println("GenLabs Loot Sale official thread created")
	} else if err != nil {
		return err
	}

	if threadID != "" {
		if _, err := db.Exec(`UPDATE sponsor_banners SET thread_id=$1 WHERE name=$2 OR image_url=$3`,
			threadID, genlabsLootSaleBanner, genlabsLootSaleImage); err != nil {
			return err
		}
		if _, err := db.Exec(`UPDATE trusted_stores SET thread_id=$1 WHERE slug=$2`, threadID, genlabsLootSaleSlug); err != nil {
			return err
		}
	}

	return nil
}
