package seed

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/auth"
)

func Run(db *sql.DB) error {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM categories`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	log.Println("seeding The Strength Lab demo data...")

	adminHash, _ := auth.HashPassword("password123")
	modHash, _ := auth.HashPassword("password123")
	userHash, _ := auth.HashPassword("password123")

	adminID := uuid.New()
	modID := uuid.New()
	userID := uuid.New()

	users := []struct {
		id, username, email, hash, title, role string
		points, messages, reactions            int
	}{
		{adminID.String(), "coach", "coach@thestrengthlab.local", adminHash, "Head Coach", "admin", 120, 40, 80},
		{modID.String(), "spotter", "spotter@thestrengthlab.local", modHash, "Moderator", "moderator", 90, 28, 55},
		{userID.String(), "lifter", "lifter@thestrengthlab.local", userHash, "Member", "member", 25, 12, 18},
	}
	for _, u := range users {
		if _, err := db.Exec(`
			INSERT INTO users(id, username, email, password_hash, display_name, title, role, trophy_points, message_count, reaction_score, last_seen_at, bio)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11)
		`, u.id, u.username, u.email, u.hash, u.username, u.title, u.role, u.points, u.messages, u.reactions,
			"Training at The Strength Lab."); err != nil {
			return err
		}
	}

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

	forumIDs := map[string]string{}
	for i, c := range cats {
		cid := uuid.New()
		if _, err := db.Exec(`INSERT INTO categories(id, name, slug, description, sort_order) VALUES($1,$2,$3,$4,$5)`,
			cid, c.name, c.slug, c.desc, i+1); err != nil {
			return err
		}
		for j, f := range c.forums {
			fid := uuid.New()
			forumIDs[f.slug] = fid.String()
			if _, err := db.Exec(`INSERT INTO forums(id, category_id, name, slug, description, sort_order) VALUES($1,$2,$3,$4,$5,$6)`,
				fid, cid, f.name, f.slug, f.desc, j+1); err != nil {
				return err
			}
		}
	}

	seedThread := func(forumSlug, authorID, title, body string, featured bool) error {
		fid := forumIDs[forumSlug]
		tid := uuid.New()
		pid := uuid.New()
		slug := fmt.Sprintf("%s-%s", slugify(title), tid.String()[:8])
		if _, err := db.Exec(`
			INSERT INTO threads(id, forum_id, author_id, title, slug, is_featured, reply_count, view_count, last_post_at, last_poster_id)
			VALUES($1,$2,$3,$4,$5,$6,0,12,NOW(),$3)
		`, tid, fid, authorID, title, slug, featured); err != nil {
			return err
		}
		if _, err := db.Exec(`INSERT INTO posts(id, thread_id, author_id, body) VALUES($1,$2,$3,$4)`, pid, tid, authorID, body); err != nil {
			return err
		}
		if _, err := db.Exec(`
			UPDATE forums SET thread_count=thread_count+1, post_count=post_count+1,
			last_thread_id=$2, last_post_at=NOW(), last_poster_id=$3 WHERE id=$1
		`, fid, tid, authorID); err != nil {
			return err
		}
		return nil
	}

	seeds := []struct {
		forum, author, title, body string
		featured                   bool
	}{
		{"introductions", userID.String(), "New here — chasing a 500 deadlift", "Hey lab. Intermediate lifter, running a strength block. Looking for cue feedback and programming nerds.", false},
		{"programs", adminID.String(), "Simple strength block that actually works", "Four-day upper/lower with heavy singles and backoff volume. Post your variations.", true},
		{"technique", modID.String(), "Bench cues that fixed my stick point", "Leg drive first, then bar path. Film your set and critique each other.", false},
		{"powerlifting-training", userID.String(), "Plateau on the big 3 — what broke yours?", "Everything stalled for 8 weeks. Changing frequency helped more than adding accessories.", false},
		{"nutrition", modID.String(), "Carbs around heavy sessions", "Pre-lift carbs make my squats less ugly. What’s your timing?", false},
		{"weekly-challenges", adminID.String(), "Lab Challenge: 5x5 squat PR week", "Post your working weight and a short video. Winner gets bragging rights + merch credit.", true},
		{"raffles", adminID.String(), "Weekly Lab Raffle — enter now", "Reply once to enter. One entry per member. Drawing Friday.", false},
		{"bloodwork", userID.String(), "First full panel results — what should I watch?", "Sharing markers (no source talk). Curious what experienced lifters track quarterly.", false},
		{"general", modID.String(), "Morning vs night training — settle this", "I pull better at night. Coach says mornings build discipline. Fight it out.", false},
	}
	for _, s := range seeds {
		if err := seedThread(s.forum, s.author, s.title, s.body, s.featured); err != nil {
			return err
		}
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

	log.Println("seed complete (coach/spotter/lifter — password: password123)")
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
