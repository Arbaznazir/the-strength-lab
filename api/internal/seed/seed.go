package seed

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/auth"
)

// Run seeds base forum structure + demo accounts, then optional bulk community data.
func Run(db *sql.DB) error {
	if err := ensureRoles(db); err != nil {
		return err
	}

	adminID, modID, lifterID, err := ensureDemoUsers(db)
	if err != nil {
		return err
	}

	forumIDs, createdForums, err := ensureCategories(db)
	if err != nil {
		return err
	}

	if createdForums {
		if err := seedStarterThreads(db, forumIDs, adminID, modID, lifterID); err != nil {
			return err
		}
		if _, err := db.Exec(`INSERT INTO chat_messages(author_id, body) VALUES($1,$2),($3,$4)`,
			adminID, "Welcome to The Strength Lab chat — keep it sharp and respectful.",
			modID, "Form checks welcome. Ego lifting gets roasted."); err != nil {
			return err
		}
		if _, err := db.Exec(`INSERT INTO trophies(name, description, points) VALUES
			('First Post', 'Created your first thread or reply', 5),
			('Iron Regular', 'Reached 25 messages', 25),
			('Lab Leader', 'Staff recognition', 50)
			ON CONFLICT DO NOTHING`); err != nil {
			return err
		}
		log.Println("base seed complete (coach/spotter/lifter — password: password123)")
	}

	if seedBulkEnabled() {
		if err := RunBulk(db, forumIDs, adminID, modID, lifterID); err != nil {
			return fmt.Errorf("bulk seed: %w", err)
		}
	}

	if err := ensureTrustedStores(db, forumIDs); err != nil {
		return fmt.Errorf("trusted stores seed: %w", err)
	}
	if err := ensureSponsorBanners(db); err != nil {
		return fmt.Errorf("sponsor banners seed: %w", err)
	}
	if err := syncSponsorBannerLinks(db); err != nil {
		return fmt.Errorf("sponsor banner links: %w", err)
	}
	if err := ensureSponsorPosts(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("sponsor posts seed: %w", err)
	}
	if err := ensureGenLabsPosts(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("genlabs posts seed: %w", err)
	}
	if err := ensureYMSLootSale(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("yms loot sale seed: %w", err)
	}
	if err := ensureGenLabsLootSale(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("genlabs loot sale seed: %w", err)
	}
	if err := ensureNADPlusDeals(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("nad plus deals seed: %w", err)
	}
	if err := ensureYMSPriceDropAlert(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("yms price drop alert seed: %w", err)
	}
	if err := ensureYMSPainOSoma(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("yms pain-o-soma seed: %w", err)
	}
	if err := ensureYMSViagraPriceDrop(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("yms viagra price drop seed: %w", err)
	}
	if err := ensureGenLabsWholesale(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("genlabs wholesale seed: %w", err)
	}
	if err := ensureAdminPosts(db, forumIDs, adminID); err != nil {
		return fmt.Errorf("admin posts seed: %w", err)
	}
	if err := ensureDemoUserTags(db, adminID, modID, lifterID); err != nil {
		return fmt.Errorf("user tags seed: %w", err)
	}
	if err := boostDemoStaffStats(db); err != nil {
		return fmt.Errorf("staff profile stats: %w", err)
	}
	if err := ensureRecentActivity(db, forumIDs); err != nil {
		return fmt.Errorf("recent activity seed: %w", err)
	}
	return nil
}

func ensureSponsorBanners(db *sql.DB) error {
	const seedFlag = "seed_sponsor_banners"
	var alreadySeeded bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, seedFlag,
	).Scan(&alreadySeeded); err != nil {
		return err
	}
	if alreadySeeded {
		return nil
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sponsor_banners`).Scan(&n); err != nil {
		return err
	}
	// Rows already present from an earlier run — mark seeded so admin deletes stick across restarts
	if n > 0 {
		_, _ = db.Exec(`INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING`, seedFlag)
		return nil
	}

	log.Println("seeding sponsor banners…")
	demos := []struct {
		name, image, link string
		order             int
	}{
		{"GenLabs", "/sponsors/genlabs.jpg", "https://www.genlabs.st", 0},
		{"Steroidify", "/sponsors/steroidify.mp4", "https://steroidify.ltd/", 1},
		{"Dragon Pharma Store", "/sponsors/dragon-pharma.mp4", "https://dragonpharmastore.to/", 2},
		{"DMK Labs USA", "/sponsors/dmk-labs.mp4", "https://dmklabsusa.com/", 3},
		{"Your Muscle Shop", "/sponsors/your-muscle-shop.jpg", "https://www.yourmuscleshopforum.com/index.php", 4},
	}
	for _, d := range demos {
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, sort_order, is_active)
			VALUES($1,$2,$3,$4,$5,true)
		`, id, d.name, d.image, d.link, d.order); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING`, seedFlag); err != nil {
		return err
	}
	log.Println("sponsor banners seeded (Steroidify, Dragon Pharma Store, DMK Labs USA, Your Muscle Shop, GenLabs)")
	return nil
}

// syncSponsorBannerLinks keeps demo banner URLs correct across restarts (idempotent).
// File numbers (1/2/3.mp4) do not match brands — use named files.
func syncSponsorBannerLinks(db *sql.DB) error {
	links := []struct{ image, name, link string }{
		{"/sponsors/steroidify.mp4", "Steroidify", "https://steroidify.ltd/"},
		{"/sponsors/dragon-pharma.mp4", "Dragon Pharma Store", "https://dragonpharmastore.to/"},
		{"/sponsors/dmk-labs.mp4", "DMK Labs USA", "https://dmklabsusa.com/"},
		{"/sponsors/your-muscle-shop.jpg", "Your Muscle Shop", "https://www.yourmuscleshopforum.com/index.php"},
		{"/sponsors/genlabs.jpg", "GenLabs", "https://www.genlabs.st"},
		{"/sponsors/genlabs-loot-sale.png", "GenLabs Loot Sale", "https://www.genlabs.st"},
		{"/sponsors/nad-plus-deals.png", "NAD+ Deals", "https://www.yourmuscleshop.com"},
		{"/sponsors/yms-price-drop-alert.png", "YMS Price Drop Alert", "https://www.yourmuscleshop.com"},
		{"/sponsors/yms-loot-sale.jpg", "YMS Loot Sale", "https://www.yourmuscleshop.com"},
	}
	for _, l := range links {
		if _, err := db.Exec(`
			UPDATE sponsor_banners SET name=$2, link_url=$3, image_url=$1
			WHERE image_url = $1 OR image_url LIKE '%' || $1
		`, l.image, l.name, l.link); err != nil {
			return err
		}
	}
	// Migrate legacy numbered filenames to correct brand + link
	legacy := []struct{ old, image, name, link string }{
		{"3.mp4", "/sponsors/steroidify.mp4", "Steroidify", "https://steroidify.ltd/"},
		{"2.mp4", "/sponsors/dragon-pharma.mp4", "Dragon Pharma Store", "https://dragonpharmastore.to/"},
		{"1.mp4", "/sponsors/dmk-labs.mp4", "DMK Labs USA", "https://dmklabsusa.com/"},
	}
	for _, l := range legacy {
		if _, err := db.Exec(`
			UPDATE sponsor_banners SET name=$3, link_url=$4, image_url=$2
			WHERE image_url LIKE '%/sponsors/' || $1
		`, l.old, l.image, l.name, l.link); err != nil {
			return err
		}
	}

	// Drop duplicate banner files so the hero rotator cannot show the same clip twice.
	if _, err := db.Exec(`
		DELETE FROM sponsor_banners a
		WHERE EXISTS (
			SELECT 1 FROM sponsor_banners b
			WHERE b.image_url = a.image_url
			  AND (
			    b.sort_order < a.sort_order
			    OR (b.sort_order = a.sort_order AND b.id::text < a.id::text)
			  )
		)
	`); err != nil {
		return err
	}

	var dmk int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sponsor_banners WHERE name ILIKE '%dmk%'`).Scan(&dmk); err != nil {
		return err
	}
	if dmk == 0 {
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, sort_order, is_active)
			VALUES($1,'DMK Labs USA','/sponsors/dmk-labs.mp4','https://dmklabsusa.com/',3,true)
		`, id); err != nil {
			return err
		}
	}

	var yms int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sponsor_banners WHERE name ILIKE '%your muscle shop%'`).Scan(&yms); err != nil {
		return err
	}
	if yms == 0 {
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, sort_order, is_active)
			VALUES($1,'Your Muscle Shop','/sponsors/your-muscle-shop.jpg','https://www.yourmuscleshopforum.com/index.php',4,true)
		`, id); err != nil {
			return err
		}
	}

	var genlabs int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sponsor_banners WHERE name ILIKE '%genlabs%'`).Scan(&genlabs); err != nil {
		return err
	}
	if genlabs == 0 {
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, sort_order, is_active)
			VALUES($1,'GenLabs','/sponsors/genlabs.jpg','https://www.genlabs.st',0,true)
		`, id); err != nil {
			return err
		}
	}

	var lootSale int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sponsor_banners WHERE name ILIKE '%loot sale%' OR image_url LIKE '%yms-loot-sale%'`).Scan(&lootSale); err != nil {
		return err
	}
	if lootSale == 0 {
		var introForum any
		_ = db.QueryRow(`SELECT id FROM forums WHERE slug='introductions'`).Scan(&introForum)
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
			VALUES($1,'YMS Loot Sale','/sponsors/yms-loot-sale.jpg','https://www.yourmuscleshop.com',$2,1,true)
		`, id, introForum); err != nil {
			return err
		}
	}

	var genlabsLoot int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name ILIKE '%genlabs loot%' OR image_url LIKE '%genlabs-loot-sale%'
	`).Scan(&genlabsLoot); err != nil {
		return err
	}
	if genlabsLoot == 0 {
		var suppForum any
		_ = db.QueryRow(`SELECT id FROM forums WHERE slug='supplements'`).Scan(&suppForum)
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
			VALUES($1,'GenLabs Loot Sale','/sponsors/genlabs-loot-sale.png','https://www.genlabs.st',$2,0,true)
		`, id, suppForum); err != nil {
			return err
		}
	}

	var nadPlus int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name = 'NAD+ Deals' OR image_url LIKE '%nad-plus-deals%'
	`).Scan(&nadPlus); err != nil {
		return err
	}
	if nadPlus == 0 {
		var suppForum any
		_ = db.QueryRow(`SELECT id FROM forums WHERE slug='supplements'`).Scan(&suppForum)
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
			VALUES($1,'NAD+ Deals','/sponsors/nad-plus-deals.png','https://www.yourmuscleshop.com',$2,0,true)
		`, id, suppForum); err != nil {
			return err
		}
	}

	var ymsAlert int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sponsor_banners
		WHERE name = 'YMS Price Drop Alert' OR image_url LIKE '%yms-price-drop-alert%'
	`).Scan(&ymsAlert); err != nil {
		return err
	}
	if ymsAlert == 0 {
		var introForum any
		_ = db.QueryRow(`SELECT id FROM forums WHERE slug='introductions'`).Scan(&introForum)
		id := uuid.New()
		if _, err := db.Exec(`
			INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
			VALUES($1,'YMS Price Drop Alert','/sponsors/yms-price-drop-alert.png','https://www.yourmuscleshop.com',$2,0,true)
		`, id, introForum); err != nil {
			return err
		}
	}
	return nil
}

func ensureTrustedStores(db *sql.DB, forumIDs map[string]string) error {
	type store struct {
		name, slug, tag, color, banner, link, desc, forumKey string
		order                                                int
	}
	// Homepage board keeps the first few; /sponsors lists all partners.
	stores := []store{
		{
			name: "YMS Price Drop Alert", slug: "yms-price-drop-alert", tag: "Trusted Source", color: "#e85d5d",
			banner: "/sponsors/yms-price-drop-alert.png",
			link:   "https://www.yourmuscleshop.com",
			desc:   "PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS",
			forumKey: "introductions", order: 0,
		},
		{
			name: "NAD+ Deals", slug: "nad-plus-deals", tag: "Trusted Source", color: "#e85d5d",
			banner: "/sponsors/nad-plus-deals.png",
			link:   "https://www.yourmuscleshop.com",
			desc:   "NAD+ DEALS JUST DROPPED 👀 | BIGGER SAVINGS. LIMITED-TIME OFFER",
			forumKey: "supplements", order: 0,
		},
		{
			name: "GenLabs Loot Sale", slug: "genlabs-loot-sale", tag: "Trusted Source", color: "#e85d5d",
			banner: "/sponsors/genlabs-loot-sale.png",
			link:   "https://www.genlabs.st",
			desc:   "THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM",
			forumKey: "supplements", order: 0,
		},
		{
			name: "GenLabs", slug: "genlabs", tag: "Trusted Source", color: "#e85d5d",
			banner: "/sponsors/genlabs.jpg",
			link:   "https://www.genlabs.st",
			desc:   "Biggest GenLabs price drop — injectables, peptides, SARMs, orals, HGH/HMG, insulin, and fat burners.",
			forumKey: "supplements", order: 0,
		},
		{
			name: "YMS Loot Sale", slug: "yms-loot-sale", tag: "Trusted Source", color: "#e85d5d",
			banner: "/sponsors/yms-loot-sale.jpg",
			link:   "https://www.yourmuscleshop.com",
			desc:   "LOOT SALE — prices just dropped on GenLabs injectables, peptides, orals, HGH/HMG, and more. Only 24 hours left!",
			forumKey: "introductions", order: 1,
		},
		{
			name: "Anabolic Dragon", slug: "anabolic-dragon", tag: "Trusted Source", color: "#e85d5d",
			banner: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
			link:   "https://anabolic-dragon.com/dr/", desc: "Pharmaceutical-grade compounds and peptides.",
			forumKey: "supplements", order: 1,
		},
		{
			name: "NapsGear", slug: "napsgear", tag: "Trusted Source", color: "#7dd3c0",
			banner: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80",
			link:   "https://www.napsgear.org/", desc: "Established source with worldwide shipping.",
			forumKey: "hormone-health", order: 2,
		},
		{
			name: "DMK Labs USA", slug: "dmk-labs-usa", tag: "Trusted Source", color: "#f0c14b",
			banner: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
			link:   "https://dmklabsusa.com/", desc: "Quality raw materials and finished products.",
			forumKey: "nutrition", order: 3,
		},
		{
			name: "Steroidify", slug: "steroidify", tag: "Trusted Source", color: "#d4ff3a",
			banner: "/sponsors/steroidify.mp4",
			link:   "https://steroidify.ltd/", desc: "Community-vetted lab partner with a large member base.",
			forumKey: "supplements", order: 4,
		},
		{
			name: "Dragon Pharma Store", slug: "dragon-pharma", tag: "Trusted Source", color: "#e85d5d",
			banner: "/sponsors/dragon-pharma.mp4",
			link:   "https://dragonpharmastore.to/", desc: "Official Dragon Pharma supplier for the lab.",
			forumKey: "hormone-health", order: 5,
		},
		{
			name: "Iron Forge Supply", slug: "iron-forge-supply", tag: "Trusted Source", color: "#c4a574",
			banner: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
			link:   "https://www.anabolicsteroidforums.com/", desc: "Training gear and plateload for serious barbell work.",
			forumKey: "accessories", order: 6,
		},
		{
			name: "Clarity Recovery", slug: "clarity-recovery", tag: "Trusted Source", color: "#9bb8ff",
			banner: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1200&q=80",
			link:   "https://www.anabolicsteroidforums.com/", desc: "Recovery tools and protocols for hard training blocks.",
			forumKey: "recovery", order: 7,
		},
		{
			name: "Your Muscle Shop", slug: "your-muscle-shop", tag: "Trusted Source", color: "#f0c14b",
			banner: "/sponsors/your-muscle-shop.jpg",
			link:   "https://www.yourmuscleshopforum.com/index.php",
			desc:   "Your Muscle Shop + GenLabs — Bitcoin promo and community forum partner.",
			forumKey: "supplements", order: 8,
		},
	}

	var added int
	for _, s := range stores {
		var forum any
		if fid, ok := forumIDs[s.forumKey]; ok && fid != "" {
			forum = fid
		} else {
			forum = nil
		}
		id := uuid.New()
		res, err := db.Exec(`
			INSERT INTO trusted_stores(id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
			ON CONFLICT (slug) DO NOTHING
		`, id, s.name, s.slug, s.tag, s.color, s.banner, s.link, s.desc, forum, s.order)
		if err != nil {
			return err
		}
		n, _ := res.RowsAffected()
		added += int(n)
	}
	if added > 0 {
		log.Printf("trusted stores: added %d partner(s)", added)
	}
	return nil
}

func ensureDemoUserTags(db *sql.DB, adminID, modID, lifterID string) error {
	// Ensure default profile tags exist (migration also inserts these)
	if _, err := db.Exec(`
		INSERT INTO profile_tags (slug, label, color, sort_order) VALUES
			('member', 'Member', '#8b948c', 10),
			('vip', 'VIP', '#f0c14b', 20),
			('company', 'Company', '#7dd3c0', 30),
			('trusted', 'Trusted Source', '#d4ff3a', 40)
		ON CONFLICT (slug) DO NOTHING
	`); err != nil {
		return nil // table missing — skip
	}
	assigns := []struct {
		uid  string
		tags []string
	}{
		{adminID, []string{"trusted", "company"}},
		{modID, []string{"vip"}},
		{lifterID, []string{"member", "vip"}},
	}
	for _, a := range assigns {
		for _, tag := range a.tags {
			_, _ = db.Exec(`
				INSERT INTO user_tags(user_id, tag_slug)
				SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM profile_tags WHERE slug=$2)
				ON CONFLICT DO NOTHING
			`, a.uid, tag)
		}
	}
	return nil
}

func seedBulkEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("SEED_BULK")))
	if v == "" {
		return true // default on for Northflank / demo deploys
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func ensureRoles(db *sql.DB) error {
	_, err := db.Exec(`
		INSERT INTO roles (slug, label, is_staff, is_protected) VALUES
			('member', 'Member', false, false),
			('moderator', 'Moderator', true, false),
			('admin', 'Admin', true, true)
		ON CONFLICT (slug) DO NOTHING
	`)
	return err
}

func ensureDemoUsers(db *sql.DB) (adminID, modID, lifterID string, err error) {
	hash, err := auth.HashPassword("password123")
	if err != nil {
		return "", "", "", err
	}

	type demo struct {
		username, email, title, role string
		points, messages, reactions, followers int
		out                                    *string
	}
	adminID, modID, lifterID = uuid.New().String(), uuid.New().String(), uuid.New().String()
	demos := []demo{
		{"coach", "coach@thestrengthlab.local", "Head Coach", "admin", 3654, 2847, 4128, 1847, &adminID},
		{"spotter", "spotter@thestrengthlab.local", "Moderator", "moderator", 2416, 1923, 2784, 1243, &modID},
		{"lifter", "lifter@thestrengthlab.local", "Member", "member", 1428, 1156, 1892, 687, &lifterID},
	}

	for _, d := range demos {
		var existing string
		err := db.QueryRow(`SELECT id::text FROM users WHERE lower(username)=lower($1)`, d.username).Scan(&existing)
		if err == nil {
			*d.out = existing
			continue
		}
		if err != sql.ErrNoRows {
			return "", "", "", err
		}
		id := uuid.New().String()
		*d.out = id
		if _, err := db.Exec(`
			INSERT INTO users(id, username, email, password_hash, display_name, title, role,
				trophy_points, message_count, reaction_score, follower_count, last_seen_at, bio, created_at)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12, NOW() - INTERVAL '95 days')
		`, id, d.username, d.email, hash, d.username, d.title, d.role, d.points, d.messages, d.reactions, d.followers,
			"Training at The Strength Lab."); err != nil {
			return "", "", "", err
		}
	}
	return adminID, modID, lifterID, nil
}

func ensureCategories(db *sql.DB) (map[string]string, bool, error) {
	forumIDs := map[string]string{}
	rows, err := db.Query(`SELECT slug, id::text FROM forums`)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	for rows.Next() {
		var slug, id string
		if rows.Scan(&slug, &id) == nil {
			forumIDs[slug] = id
		}
	}
	if len(forumIDs) > 0 {
		return forumIDs, false, nil
	}

	log.Println("seeding The Strength Lab categories & forums...")

	type forumDef struct {
		name, slug, desc string
	}
	type catDef struct {
		name, slug, desc string
		forums           []forumDef
	}

	cats := []catDef{
		{"Community", "community", "Meet the lab, share wins, and settle in.", []forumDef{
			{"New Member Introductions", "introductions", "Introduce yourself like you mean it."},
			{"General Discussion", "general", "Talk training, life, and everything between sets."},
			{"Training Journals", "journals", "Log cycles, PRs, and long-game progress."},
		}},
		{"Training Lab", "training-lab", "Programming, technique, and session design.", []forumDef{
			{"Programs & Periodization", "programs", "Templates, blocks, and peaking strategies."},
			{"Technique & Cues", "technique", "Bar path, bracing, and movement quality."},
			{"Accessory Work", "accessories", "Weak points, rehab lifts, and smart volume."},
		}},
		{"Strength & Power", "strength-power", "Big lifts, meets, and absolute strength.", []forumDef{
			{"Powerlifting Training", "powerlifting-training", "Squat, bench, deadlift systems."},
			{"Meet Prep & Results", "meet-prep", "Attempts, openers, and competition day."},
			{"Records & Big Lifts", "records", "Celebrate the numbers that matter."},
		}},
		{"Nutrition & Recovery", "nutrition-recovery", "Fuel, sleep, and staying in the fight.", []forumDef{
			{"Nutrition & Macros", "nutrition", "Fueling strength without the fluff."},
			{"Recovery & Injury", "recovery", "Tendons, sleep, and coming back stronger."},
			{"Supplements", "supplements", "What helps, what doesn’t, what’s hype."},
		}},
		{"Health & Longevity", "health-longevity", "Hormones, labs, and long-term performance.", []forumDef{
			{"Bloodwork & Labs", "bloodwork", "Track markers that affect training."},
			{"TRT & Hormone Health", "hormone-health", "Evidence-first hormone discussion."},
			{"Longevity & Wellness", "longevity", "Stay strong for decades, not weeks."},
		}},
	}

	for i, c := range cats {
		cid := uuid.New()
		if _, err := db.Exec(`INSERT INTO categories(id, name, slug, description, sort_order) VALUES($1,$2,$3,$4,$5)`,
			cid, c.name, c.slug, c.desc, i+1); err != nil {
			return nil, false, err
		}
		for j, f := range c.forums {
			fid := uuid.New()
			forumIDs[f.slug] = fid.String()
			if _, err := db.Exec(`INSERT INTO forums(id, category_id, name, slug, description, sort_order) VALUES($1,$2,$3,$4,$5,$6)`,
				fid, cid, f.name, f.slug, f.desc, j+1); err != nil {
				return nil, false, err
			}
		}
	}
	return forumIDs, true, nil
}

func seedStarterThreads(db *sql.DB, forumIDs map[string]string, adminID, modID, lifterID string) error {
	seeds := []struct {
		forum, author, title, body string
		featured                   bool
	}{
		{"introductions", lifterID, "New here — chasing a 500 deadlift", "Hey lab. Intermediate lifter, running a strength block. Looking for cue feedback and programming nerds.", false},
		{"programs", adminID, "Simple strength block that actually works", "Four-day upper/lower with heavy singles and backoff volume. Post your variations.", true},
		{"technique", modID, "Bench cues that fixed my stick point", "Leg drive first, then bar path. Film your set and critique each other.", false},
		{"powerlifting-training", lifterID, "Plateau on the big 3 — what broke yours?", "Everything stalled for 8 weeks. Changing frequency helped more than adding accessories.", false},
		{"nutrition", modID, "Carbs around heavy sessions", "Pre-lift carbs make my squats less ugly. What’s your timing?", false},
		{"bloodwork", lifterID, "First full panel results — what should I watch?", "Sharing markers (no source talk). Curious what experienced lifters track quarterly.", false},
		{"general", modID, "Morning vs night training — settle this", "I pull better at night. Coach says mornings build discipline. Fight it out.", false},
	}
	for i, s := range seeds {
		fid := forumIDs[s.forum]
		tid := uuid.New()
		pid := uuid.New()
		slug := fmt.Sprintf("%s-%s", slugify(s.title), tid.String()[:8])
		created := fmt.Sprintf("NOW() - INTERVAL '%d days'", 88-i*3)
		if _, err := db.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_featured, reply_count, view_count, last_post_at, last_poster_id, created_at, updated_at)
			VALUES($1,$2,$3,$4,$5,$6,0,12,`+created+`,$3,`+created+`,`+created+`)
		`, tid, fid, s.author, s.title, slug, s.featured); err != nil {
			return err
		}
		if _, err := db.Exec(`INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at) VALUES($1,$2,$3,$4,`+created+`,`+created+`)`,
			pid, tid, s.author, s.body); err != nil {
			return err
		}
		if _, err := db.Exec(`
			UPDATE forums SET thread_count=thread_count+1, post_count=post_count+1,
			last_thread_id=$2, last_post_at=`+created+`, last_poster_id=$3 WHERE id=$1
		`, fid, tid, s.author); err != nil {
			return err
		}
	}
	return nil
}

func ensureSponsorPosts(db *sql.DB, forumIDs map[string]string, adminID string) error {
	type spec struct {
		key, name, forum, title, body, link string
		bannerName, storeSlug               string
	}
	posts := []spec{
		{
			key: "steroidify", name: "Steroidify", forum: "supplements",
			title:      "Official Steroidify thread",
			link:       "https://steroidify.ltd/",
			body:       "Lab partner thread for Steroidify.\n\nQuestions, sourcing talk that stays within the rules, and promo discussion go here. Shop: https://steroidify.ltd/",
			bannerName: "Steroidify", storeSlug: "steroidify",
		},
		{
			key: "dragon-pharma", name: "Dragon Pharma Store", forum: "supplements",
			title:      "Official Dragon Pharma Store thread",
			link:       "https://dragonpharmastore.to/",
			body:       "Official thread for Dragon Pharma Store — trusted supplier discussion for the lab.\n\nShop: https://dragonpharmastore.to/",
			bannerName: "Dragon Pharma Store", storeSlug: "dragon-pharma",
		},
		{
			key: "dmk-labs", name: "DMK Labs USA", forum: "supplements",
			title:      "Official DMK Labs USA thread",
			link:       "https://dmklabsusa.com/",
			body:       "Official thread for DMK Labs USA.\n\nRaw materials, finished products, and lab questions that stay in-bounds. Shop: https://dmklabsusa.com/",
			bannerName: "DMK Labs USA", storeSlug: "dmk-labs-usa",
		},
		{
			key: "anabolic-dragon", name: "Anabolic Dragon", forum: "hormone-health",
			title:     "Official Anabolic Dragon thread",
			link:      "https://anabolic-dragon.com/dr/",
			body:      "Official thread for Anabolic Dragon.\n\nShop: https://anabolic-dragon.com/dr/",
			storeSlug: "anabolic-dragon",
		},
		{
			key: "napsgear", name: "NapsGear", forum: "hormone-health",
			title:     "Official NapsGear thread",
			link:      "https://www.napsgear.org/",
			body:      "Official thread for NapsGear.\n\nShop: https://www.napsgear.org/",
			storeSlug: "napsgear",
		},
		{
			key: "iron-forge-supply", name: "Iron Forge Supply", forum: "accessories",
			title:     "Official Iron Forge Supply thread",
			link:      "https://www.anabolicsteroidforums.com/",
			body:      "Official thread for Iron Forge Supply — gear talk for barbell work that stays in-bounds.\n\nForum: https://www.anabolicsteroidforums.com/",
			storeSlug: "iron-forge-supply",
		},
		{
			key: "clarity-recovery", name: "Clarity Recovery", forum: "recovery",
			title:     "Official Clarity Recovery thread",
			link:      "https://www.anabolicsteroidforums.com/",
			body:      "Official thread for Clarity Recovery — recovery tools and protocols for hard training blocks.\n\nForum: https://www.anabolicsteroidforums.com/",
			storeSlug: "clarity-recovery",
		},
		{
			key: "your-muscle-shop", name: "Your Muscle Shop", forum: "supplements",
			title:      "Official Your Muscle Shop thread",
			link:       "https://www.yourmuscleshopforum.com/index.php",
			body:       "Official thread for Your Muscle Shop / GenLabs.\n\nPay with Bitcoin promo talk, reviews, and questions that stay in-bounds. Forum: https://www.yourmuscleshopforum.com/index.php",
			bannerName: "Your Muscle Shop", storeSlug: "your-muscle-shop",
		},
		{
			key: "genlabs", name: "GenLabs", forum: "supplements",
			title:      "THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON'T MISS OUT",
			link:       "https://www.genlabs.st",
			body:       "Official GenLabs promo thread — biggest price drop on injectables, peptides, SARMs, orals, HGH/HMG, insulin, and fat burners.\n\nVisit us:\nhttps://www.genlabs.st\nhttps://www.yourmuscleshop.com\n\nContact us:\nEmail: Support@genlabs.st\nWhatsApp: +91 96917 10589",
			bannerName: "GenLabs", storeSlug: "genlabs",
		},
		{
			key: "yms-loot-sale", name: "YMS Loot Sale", forum: "introductions",
			title: "LOOT SALE | PRICES JUST DROPPED | YOUR MUSCLE SHOP — ONLY 24 HOURS LEFT",
			link:  "https://www.yourmuscleshop.com",
			body: `Official Your Muscle Shop LOOT SALE thread — prices just dropped to help the community afford more!

We've lowered our prices across GenLabs injectables, peptides, orals, HGH/HMG, and more.

ONLY 24 HOURS LEFT — Limited Time Sale. Don't miss out!

Visit: https://www.yourmuscleshop.com
Email: wholesale@yourmuscleshop.com

DISCREET SHIPPING | UNBEATABLE PRICES | 100% AUTHENTIC`,
			bannerName: "YMS Loot Sale", storeSlug: "yms-loot-sale",
		},
	}

	for i, p := range posts {
		fid := forumIDs[p.forum]
		if fid == "" {
			_ = db.QueryRow(`SELECT id::text FROM forums WHERE slug=$1`, p.forum).Scan(&fid)
		}
		if fid == "" {
			continue
		}

		slug := "official-" + p.key
		var threadID string
		err := db.QueryRow(`SELECT id::text FROM threads WHERE slug=$1`, slug).Scan(&threadID)
		if err == sql.ErrNoRows {
			tid := uuid.New()
			pid := uuid.New()
			threadID = tid.String()
			created := fmt.Sprintf("NOW() - INTERVAL '%d hours'", 6+i*3)
			if _, err := db.Exec(`
				INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured, reply_count, view_count, last_post_at, last_poster_id, created_at, updated_at)
				VALUES($1,$2,$3,$4,$5,true,true,0,80,`+created+`,$3,`+created+`,`+created+`)
			`, tid, fid, adminID, p.title, slug); err != nil {
				return err
			}
			if _, err := db.Exec(`
				INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
				VALUES($1,$2,$3,$4,`+created+`,`+created+`)
			`, pid, tid, adminID, p.body); err != nil {
				return err
			}
			if _, err := db.Exec(`
				UPDATE forums SET thread_count=thread_count+1, post_count=post_count+1 WHERE id=$1
			`, fid); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		if p.bannerName != "" {
			if _, err := db.Exec(`UPDATE sponsor_banners SET thread_id=$1 WHERE name=$2`, threadID, p.bannerName); err != nil {
				return err
			}
		}
		if p.storeSlug != "" {
			if _, err := db.Exec(`UPDATE trusted_stores SET thread_id=$1 WHERE slug=$2`, threadID, p.storeSlug); err != nil {
				return err
			}
		}
	}
	log.Println("sponsor official threads ready")
	return nil
}

func slugify(s string) string {
	out := make([]rune, 0, len(s))
	dash := false
	for _, r := range s {
		switch {
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
			dash = false
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			out = append(out, r)
			dash = false
		default:
			if !dash && len(out) > 0 {
				out = append(out, '-')
				dash = true
			}
		}
	}
	for len(out) > 0 && out[len(out)-1] == '-' {
		out = out[:len(out)-1]
	}
	if len(out) == 0 {
		return "thread"
	}
	if len(out) > 60 {
		out = out[:60]
	}
	return string(out)
}
