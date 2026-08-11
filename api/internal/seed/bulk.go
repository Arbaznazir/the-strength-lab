package seed

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/auth"
)

const bulkUserTarget = 2150

// RunBulk fills the forum with ~2150 members and ~3 months of realistic activity.
// Safe to re-run: skips when user count already meets the target.
func RunBulk(db *sql.DB, forumIDs map[string]string, adminID, modID, lifterID string) error {
	var userCount, threadCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		return err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM threads`).Scan(&threadCount); err != nil {
		return err
	}

	if err := trimDemoUsersToTarget(db, bulkUserTarget); err != nil {
		return fmt.Errorf("trim demo users: %w", err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		return err
	}
	if userCount >= bulkUserTarget && threadCount >= 100 {
		log.Printf("bulk seed skipped (already have %d users, %d threads)", userCount, threadCount)
		return nil
	}

	log.Printf("bulk seed starting (%d users → %d, %d threads)…", userCount, bulkUserTarget, threadCount)
	start := time.Now()
	rng := rand.New(rand.NewSource(42)) // deterministic for reproducible demos

	memberHash, err := auth.HashPassword("password123")
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	epoch := now.AddDate(0, 0, -90)

	members := make([]member, 0, bulkUserTarget)
	// Keep demo accounts in the pool for mentions / activity.
	for _, row := range []struct{ id, u string }{
		{adminID, "coach"}, {modID, "spotter"}, {lifterID, "lifter"},
	} {
		var joined time.Time
		_ = db.QueryRow(`SELECT created_at FROM users WHERE id=$1`, row.id).Scan(&joined)
		if joined.IsZero() {
			joined = epoch
		}
		members = append(members, member{id: row.id, username: row.u, display: row.u, joined: joined})
	}

	need := bulkUserTarget - userCount
	if need < 0 {
		need = 0
	}

	if need > 0 {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()

		stmt, err := tx.Prepare(`
		INSERT INTO users(id, username, email, password_hash, display_name, title, role,
			trophy_points, message_count, reaction_score, bio, last_seen_at, created_at, updated_at)
		VALUES($1,$2,$3,$4,$5,$6,'member',$7,0,$8,$9,$10,$11,$11)
		ON CONFLICT (username) DO NOTHING
	`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		usedNames := map[string]struct{}{}
		nameRows, err := db.Query(`SELECT username FROM users`)
		if err != nil {
			return err
		}
		for nameRows.Next() {
			var u string
			if nameRows.Scan(&u) == nil {
				usedNames[u] = struct{}{}
			}
		}
		nameRows.Close()

		created := 0
		for created < need {
			uname := uniqueUsername(rng, usedNames)
			id := uuid.New().String()
			dayOffset := rng.Intn(90)
			joined := epoch.AddDate(0, 0, dayOffset).Add(time.Duration(rng.Intn(20*3600)) * time.Second)
			span := int(now.Sub(joined).Seconds())
			if span < 1 {
				span = 1
			}
			lastSeen := joined.Add(time.Duration(rng.Intn(span)) * time.Second)
			if lastSeen.After(now) {
				lastSeen = now.Add(-time.Duration(rng.Intn(48)) * time.Hour)
			}
			title := memberTitles[rng.Intn(len(memberTitles))]
			display := displayName(uname, rng)
			bio := bios[rng.Intn(len(bios))]
			points := rng.Intn(80)
			reactScore := rng.Intn(60)

			res, err := stmt.Exec(
				id, uname, uname+"@demo.thestrengthlab.local", memberHash, display, title,
				points, reactScore, bio, lastSeen, joined,
			)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				continue
			}
			members = append(members, member{id: id, username: uname, display: display, joined: joined})
			created++
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		log.Printf("bulk seed: created %d members", created)
	}

	if threadCount >= 100 {
		log.Printf("bulk seed: content skipped (already have %d threads)", threadCount)
		return nil
	}

	// Reload full member list (handles partial prior runs).
	members, err = loadMembers(db)
	if err != nil {
		return err
	}
	if len(members) == 0 {
		return fmt.Errorf("no members to seed content for")
	}

	forumSlugs := make([]string, 0, len(forumIDs))
	for slug := range forumIDs {
		forumSlugs = append(forumSlugs, slug)
	}
	if len(forumSlugs) == 0 {
		return fmt.Errorf("no forums available for bulk seed")
	}

	type threadRef struct {
		id, slug, forumID, authorID string
		created                     time.Time
		title                       string
	}

	const bulkThreadCount = 220
	threads := make([]threadRef, 0, bulkThreadCount)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	threadStmt, err := tx.Prepare(`
		INSERT INTO threads(id, forum_id, author_id, title, slug, is_pinned, is_featured,
			view_count, reply_count, last_post_at, last_poster_id, created_at, updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$3,$9,$9)
	`)
	if err != nil {
		return err
	}
	defer threadStmt.Close()

	opStmt, err := tx.Prepare(`
		INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
		VALUES($1,$2,$3,$4,$5,$5)
	`)
	if err != nil {
		return err
	}
	defer opStmt.Close()

	for i := 0; i < bulkThreadCount; i++ {
		author := pickActiveMember(rng, members, epoch.AddDate(0, 0, i%90))
		forumSlug := forumSlugs[rng.Intn(len(forumSlugs))]
		fid := forumIDs[forumSlug]
		tpl := threadTemplates[rng.Intn(len(threadTemplates))]
		title := tpl.title
		// Slight variation so titles aren't identical across 200+ threads
		if rng.Float32() < 0.25 {
			title = fmt.Sprintf("%s (%s)", title, []string{"update", "week notes", "lab take", "check-in"}[rng.Intn(4)])
		}
		body := tpl.body
		if rng.Float32() < 0.35 {
			mention := pickActiveMember(rng, members, author.joined)
			if mention.username != author.username {
				body += fmt.Sprintf("\n\ncc @%s — curious what you'd run here.", mention.username)
			}
		}
		tid := uuid.New()
		pid := uuid.New()
		createdAt := randomTimeBetween(rng, maxTime(author.joined, epoch), now)
		slug := fmt.Sprintf("%s-%s", slugify(title), tid.String()[:8])
		featured := rng.Float32() < 0.04
		pinned := rng.Float32() < 0.015
		views := 20 + rng.Intn(900)

		if _, err := threadStmt.Exec(tid, fid, author.id, title, slug, pinned, featured, views, createdAt); err != nil {
			return err
		}
		if _, err := opStmt.Exec(pid, tid, author.id, body, createdAt); err != nil {
			return err
		}
		threads = append(threads, threadRef{
			id: tid.String(), slug: slug, forumID: fid, authorID: author.id,
			created: createdAt, title: title,
		})
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("bulk seed: created %d threads", len(threads))

	// Replies with staggered timestamps + @mentions
	tx, err = db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	replyStmt, err := tx.Prepare(`
		INSERT INTO posts(id, thread_id, author_id, body, created_at, updated_at)
		VALUES($1,$2,$3,$4,$5,$5)
	`)
	if err != nil {
		return err
	}
	defer replyStmt.Close()

	alertStmt, err := tx.Prepare(`
		INSERT INTO alerts(user_id, kind, title, body, link, is_read, created_at)
		VALUES($1,'mention','Mention',$2,$3,$4,$5)
	`)
	if err != nil {
		return err
	}
	defer alertStmt.Close()

	type postRef struct {
		id, authorID, threadID string
		created                time.Time
	}
	posts := make([]postRef, 0, threadCount*8)
	replyTotal := 0

	for _, th := range threads {
		replies := 2 + rng.Intn(14) // 2–15 replies
		if rng.Float32() < 0.12 {
			replies += rng.Intn(20) // hot threads
		}
		lastAt := th.created
		lastPoster := th.authorID
		for r := 0; r < replies; r++ {
			author := pickActiveMember(rng, members, th.created)
			at := th.created.Add(time.Duration(r+1) * time.Duration(30+rng.Intn(18*3600)) * time.Second)
			if at.After(now) {
				// Keep replies in chronological order when clamping to the past.
				at = now.Add(-time.Duration(replies-r) * time.Minute)
				if at.Before(lastAt) {
					at = lastAt.Add(time.Duration(1+rng.Intn(5)) * time.Minute)
				}
				if at.After(now) {
					at = now.Add(-time.Second)
				}
			}
			if at.Before(lastAt) {
				at = lastAt.Add(time.Duration(5+rng.Intn(120)) * time.Minute)
			}
			body := replyBodies[rng.Intn(len(replyBodies))]
			var mentioned *member
			if rng.Float32() < 0.45 {
				m := pickActiveMember(rng, members, th.created)
				if m.username != author.username {
					mentioned = &m
					body = fmt.Sprintf("@%s %s", m.username, body)
				}
			}
			if rng.Float32() < 0.2 {
				m2 := pickActiveMember(rng, members, th.created)
				if m2.username != author.username && (mentioned == nil || m2.username != mentioned.username) {
					body += fmt.Sprintf(" Also tagging @%s for thoughts.", m2.username)
					if mentioned == nil {
						mentioned = &m2
					}
				}
			}
			pid := uuid.New().String()
			if _, err := replyStmt.Exec(pid, th.id, author.id, body, at); err != nil {
				return err
			}
			posts = append(posts, postRef{id: pid, authorID: author.id, threadID: th.id, created: at})
			if mentioned != nil {
				link := "/threads/" + th.slug
				msg := author.username + " mentioned you in \"" + th.title + "\""
				read := rng.Float32() < 0.55
				if _, err := alertStmt.Exec(mentioned.id, msg, link, read, at); err != nil {
					return err
				}
			}
			lastAt = at
			lastPoster = author.id
			replyTotal++
		}
		if _, err := tx.Exec(`
			UPDATE threads SET reply_count=$2, last_post_at=$3, last_poster_id=$4, updated_at=$3 WHERE id=$1
		`, th.id, replies, lastAt, lastPoster); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("bulk seed: created %d replies", replyTotal)

	// Reactions
	tx, err = db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	reactStmt, err := tx.Prepare(`
		INSERT INTO reactions(post_id, user_id, kind, created_at)
		VALUES($1,$2,'like',$3)
		ON CONFLICT DO NOTHING
	`)
	if err != nil {
		return err
	}
	defer reactStmt.Close()

	reactN := 0
	sample := posts
	if len(sample) > 800 {
		rng.Shuffle(len(sample), func(i, j int) { sample[i], sample[j] = sample[j], sample[i] })
		sample = sample[:800]
	}
	for _, p := range sample {
		n := rng.Intn(6)
		for i := 0; i < n; i++ {
			u := members[rng.Intn(len(members))]
			if u.id == p.authorID {
				continue
			}
			at := p.created.Add(time.Duration(rng.Intn(72*3600)) * time.Second)
			if at.After(now) {
				at = now
			}
			if _, err := reactStmt.Exec(p.id, u.id, at); err == nil {
				reactN++
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("bulk seed: created ~%d reactions", reactN)

	// Refresh reaction_count
	if _, err := db.Exec(`
		UPDATE posts p SET reaction_count = COALESCE((
			SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id
		), 0)
	`); err != nil {
		return err
	}

	// Chat history over 90 days
	tx, err = db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	chatStmt, err := tx.Prepare(`INSERT INTO chat_messages(author_id, body, created_at) VALUES($1,$2,$3)`)
	if err != nil {
		return err
	}
	defer chatStmt.Close()
	for i := 0; i < 180; i++ {
		u := pickActiveMember(rng, members, epoch)
		at := randomTimeBetween(rng, epoch, now)
		body := chatLines[rng.Intn(len(chatLines))]
		if rng.Float32() < 0.3 {
			m := pickActiveMember(rng, members, epoch)
			if m.username != u.username {
				body = fmt.Sprintf("@%s %s", m.username, body)
			}
		}
		if _, err := chatStmt.Exec(u.id, body, at); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	// Profile wall posts
	tx, err = db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	ppStmt, err := tx.Prepare(`
		INSERT INTO profile_posts(profile_user_id, author_id, body, created_at)
		VALUES($1,$2,$3,$4)
	`)
	if err != nil {
		return err
	}
	defer ppStmt.Close()
	for i := 0; i < 120; i++ {
		profile := members[rng.Intn(len(members))]
		author := pickActiveMember(rng, members, profile.joined)
		at := randomTimeBetween(rng, maxTime(profile.joined, epoch), now)
		body := profileLines[rng.Intn(len(profileLines))]
		if rng.Float32() < 0.4 {
			body = fmt.Sprintf("@%s %s", profile.username, body)
		}
		if _, err := ppStmt.Exec(profile.id, author.id, body, at); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	// Thread watches
	tx, err = db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	watchStmt, err := tx.Prepare(`
		INSERT INTO thread_watches(user_id, thread_id, created_at) VALUES($1,$2,$3)
		ON CONFLICT DO NOTHING
	`)
	if err != nil {
		return err
	}
	defer watchStmt.Close()
	for _, th := range threads {
		if rng.Float32() > 0.35 {
			continue
		}
		n := 1 + rng.Intn(5)
		for i := 0; i < n; i++ {
			u := members[rng.Intn(len(members))]
			if _, err := watchStmt.Exec(u.id, th.id, th.created.Add(time.Hour)); err != nil {
				return err
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	// Recompute forum counters + last post
	if _, err := db.Exec(`
		UPDATE forums f SET
			thread_count = COALESCE((SELECT COUNT(*) FROM threads t WHERE t.forum_id = f.id), 0),
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

	// Recompute user message counts + reaction scores
	if _, err := db.Exec(`
		UPDATE users u SET
			message_count = COALESCE((SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM chat_messages c WHERE c.author_id = u.id), 0),
			reaction_score = COALESCE((
				SELECT COUNT(*) FROM reactions r
				JOIN posts p ON p.id = r.post_id
				WHERE p.author_id = u.id
			), 0),
			trophy_points = GREATEST(trophy_points, COALESCE((SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id), 0))
	`); err != nil {
		return err
	}

	var finalUsers, finalThreads, finalPosts int
	_ = db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&finalUsers)
	_ = db.QueryRow(`SELECT COUNT(*) FROM threads`).Scan(&finalThreads)
	_ = db.QueryRow(`SELECT COUNT(*) FROM posts`).Scan(&finalPosts)

	log.Printf("bulk seed complete in %s — %d users, %d threads, %d posts (demo: coach/spotter/lifter · password123)",
		time.Since(start).Round(time.Millisecond), finalUsers, finalThreads, finalPosts)
	return nil
}

func loadMembers(db *sql.DB) ([]member, error) {
	rows, err := db.Query(`SELECT id::text, username, COALESCE(NULLIF(display_name,''), username), created_at FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []member
	for rows.Next() {
		var m member
		if err := rows.Scan(&m.id, &m.username, &m.display, &m.joined); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

type member struct {
	id, username, display string
	joined                time.Time
}

func uniqueUsername(rng *rand.Rand, used map[string]struct{}) string {
	for {
		a := usernameAdjectives[rng.Intn(len(usernameAdjectives))]
		b := usernameNouns[rng.Intn(len(usernameNouns))]
		n := rng.Intn(9000) + 10
		u := fmt.Sprintf("%s_%s%d", a, b, n)
		if len(u) > 24 {
			u = u[:24]
		}
		if _, ok := used[u]; ok {
			continue
		}
		used[u] = struct{}{}
		return u
	}
}

func displayName(username string, rng *rand.Rand) string {
	if rng.Float32() < 0.4 {
		return firstNames[rng.Intn(len(firstNames))] + " " + string(firstNames[rng.Intn(len(firstNames))][0]) + "."
	}
	parts := strings.Split(username, "_")
	if len(parts) >= 2 {
		return capitalize(parts[0]) + " " + capitalize(strings.TrimRight(parts[1], "0123456789"))
	}
	return username
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// trimDemoUsersToTarget removes excess seeded demo accounts when a prior run overshot the cap.
func trimDemoUsersToTarget(db *sql.DB, target int) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	excess := count - target
	if excess <= 0 {
		return nil
	}
	res, err := db.Exec(`
		DELETE FROM users WHERE id IN (
			SELECT id FROM users
			WHERE email LIKE '%@demo.thestrengthlab.local'
			  AND username NOT IN ('coach', 'spotter', 'lifter')
			ORDER BY created_at ASC
			LIMIT $1
		)
	`, excess)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("bulk seed: trimmed %d excess demo members (target %d)", n, target)
	}
	return nil
}

func pickActiveMember(rng *rand.Rand, members []member, notBefore time.Time) member {
	for tries := 0; tries < 12; tries++ {
		m := members[rng.Intn(len(members))]
		if !m.joined.After(notBefore.Add(24 * time.Hour)) {
			return m
		}
	}
	return members[rng.Intn(len(members))]
}

func randomTimeBetween(rng *rand.Rand, start, end time.Time) time.Time {
	if !end.After(start) {
		return start
	}
	span := end.Sub(start)
	return start.Add(time.Duration(rng.Int63n(int64(span))))
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}
