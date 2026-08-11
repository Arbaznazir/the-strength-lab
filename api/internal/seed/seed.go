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
		points, messages, reactions  int
		out                          *string
	}
	adminID, modID, lifterID = uuid.New().String(), uuid.New().String(), uuid.New().String()
	demos := []demo{
		{"coach", "coach@thestrengthlab.local", "Head Coach", "admin", 120, 40, 80, &adminID},
		{"spotter", "spotter@thestrengthlab.local", "Moderator", "moderator", 90, 28, 55, &modID},
		{"lifter", "lifter@thestrengthlab.local", "Member", "member", 25, 12, 18, &lifterID},
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
				trophy_points, message_count, reaction_score, last_seen_at, bio, created_at)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11, NOW() - INTERVAL '95 days')
		`, id, d.username, d.email, hash, d.username, d.title, d.role, d.points, d.messages, d.reactions,
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
		{"Challenges & Raffles", "challenges", "Weekly challenges, giveaways, and lab events.", []forumDef{
			{"Weekly Challenges", "weekly-challenges", "Earn bragging rights and lab rewards."},
			{"Raffles & Giveaways", "raffles", "Enter, follow the rules, test your luck."},
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
		{"weekly-challenges", adminID, "Lab Challenge: 5x5 squat PR week", "Post your working weight and a short video. Winner gets bragging rights + merch credit.", true},
		{"raffles", adminID, "Weekly Lab Raffle — enter now", "Reply once to enter. One entry per member. Drawing Friday.", false},
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
