package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/thestrengthlab/api/internal/models"
)

type searchForumHit struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Score       float64 `json:"score,omitempty"`
}

type searchThreadHit struct {
	models.Thread
	Snippet string  `json:"snippet,omitempty"`
	Score   float64 `json:"score,omitempty"`
}

type searchProfileHit struct {
	ID          string           `json:"id"`
	Body        string           `json:"body"`
	Snippet     string           `json:"snippet,omitempty"`
	CreatedAt   time.Time        `json:"createdAt"`
	Author      models.UserPublic `json:"author"`
	ProfileUser models.UserPublic `json:"profileUser"`
	Score       float64          `json:"score,omitempty"`
}

type searchSuggestion struct {
	Label string `json:"label"`
	Query string `json:"query"`
}

// Lifting-domain synonym expansion for smarter matches.
var searchSynonyms = map[string][]string{
	"dl":          {"deadlift", "pull"},
	"deadlift":    {"dl", "pull"},
	"squat":       {"squatting"},
	"bench":       {"benchpress", "press"},
	"ohp":         {"overhead", "press"},
	"pr":          {"personal record", "pb"},
	"pb":          {"pr", "personal record"},
	"prog":        {"programming", "program"},
	"programming": {"prog", "periodization", "template"},
	"meet":        {"competition", "comp"},
	"comp":        {"meet", "competition"},
	"rom":         {"range of motion"},
	"rpe":         {"effort", "intensity"},
	"deload":      {"recovery week", "backoff"},
	"hypertrophy": {"volume", "muscle"},
	"cut":         {"deficit", "fat loss"},
	"bulk":        {"surplus", "gain"},
	"form":        {"technique", "cues"},
	"technique":   {"form", "cues"},
}

var (
	opFromRe       = regexp.MustCompile(`(?i)\bfrom:([a-z0-9_-]+)`)
	opInRe         = regexp.MustCompile(`(?i)\bin:([a-z0-9_-]+)`)
	opBeforeRe     = regexp.MustCompile(`(?i)\bbefore:(\d{4}-\d{2}-\d{2})`)
	opAfterRe      = regexp.MustCompile(`(?i)\bafter:(\d{4}-\d{2}-\d{2})`)
	opMinRepliesRe = regexp.MustCompile(`(?i)\bminreplies:(\d+)`)
	opTitleRe      = regexp.MustCompile(`(?i)\btitle:`)
	quotedRe       = regexp.MustCompile(`"([^"]+)"`)
)

type searchOpts struct {
	Raw         string
	Terms       []string
	Phrase      string
	TSQuery     string
	MemberHint  string
	Author      string
	ForumSlugs  []string
	TitlesOnly  bool
	MinReplies  int
	After       *time.Time
	Before      *time.Time
	Sort        string // relevance | date | replies
	Scope       string // all | threads | members | forums | profile
	Limit       int
}

func parseSmartQuery(q string, r *http.Request) searchOpts {
	opts := searchOpts{
		Raw:   strings.TrimSpace(q),
		Sort:  strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sort"))),
		Scope: strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope"))),
	}
	if opts.Sort == "" {
		opts.Sort = "relevance"
	}
	if opts.Scope == "" {
		opts.Scope = "all"
	}
	opts.TitlesOnly = r.URL.Query().Get("titlesOnly") == "1" || r.URL.Query().Get("titlesOnly") == "true"
	if n, err := strconv.Atoi(r.URL.Query().Get("minReplies")); err == nil && n > 0 {
		opts.MinReplies = n
	}
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 50 {
		opts.Limit = n
	} else {
		opts.Limit = 25
	}
	if v := strings.TrimSpace(r.URL.Query().Get("author")); v != "" {
		opts.Author = strings.TrimPrefix(v, "@")
	}
	if v := strings.TrimSpace(r.URL.Query().Get("forums")); v != "" {
		for _, s := range strings.Split(v, ",") {
			s = strings.TrimSpace(s)
			if s != "" {
				opts.ForumSlugs = append(opts.ForumSlugs, s)
			}
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("after")); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			opts.After = &t
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("before")); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			// inclusive end-of-day
			t2 := t.Add(24*time.Hour - time.Nanosecond)
			opts.Before = &t2
		}
	}

	work := opts.Raw

	// Extract operators from free text
	if m := opFromRe.FindStringSubmatch(work); len(m) > 1 {
		if opts.Author == "" {
			opts.Author = m[1]
		}
		work = opFromRe.ReplaceAllString(work, " ")
	}
	if m := opInRe.FindStringSubmatch(work); len(m) > 1 {
		opts.ForumSlugs = append(opts.ForumSlugs, m[1])
		work = opInRe.ReplaceAllString(work, " ")
	}
	if m := opBeforeRe.FindStringSubmatch(work); len(m) > 1 && opts.Before == nil {
		if t, err := time.Parse("2006-01-02", m[1]); err == nil {
			t2 := t.Add(24*time.Hour - time.Nanosecond)
			opts.Before = &t2
		}
		work = opBeforeRe.ReplaceAllString(work, " ")
	}
	if m := opAfterRe.FindStringSubmatch(work); len(m) > 1 && opts.After == nil {
		if t, err := time.Parse("2006-01-02", m[1]); err == nil {
			opts.After = &t
		}
		work = opAfterRe.ReplaceAllString(work, " ")
	}
	if m := opMinRepliesRe.FindStringSubmatch(work); len(m) > 1 && opts.MinReplies == 0 {
		if n, err := strconv.Atoi(m[1]); err == nil {
			opts.MinReplies = n
		}
		work = opMinRepliesRe.ReplaceAllString(work, " ")
	}
	if opTitleRe.MatchString(work) {
		opts.TitlesOnly = true
		work = opTitleRe.ReplaceAllString(work, " ")
	}

	if m := quotedRe.FindStringSubmatch(work); len(m) > 1 {
		opts.Phrase = strings.TrimSpace(m[1])
		work = quotedRe.ReplaceAllString(work, " ")
	}

	if strings.HasPrefix(strings.TrimSpace(work), "@") {
		hint := strings.TrimPrefix(strings.TrimSpace(work), "@")
		hint = strings.Fields(hint)[0]
		opts.MemberHint = hint
		if opts.Author == "" {
			opts.Author = hint
		}
	}

	seen := map[string]struct{}{}
	for _, w := range strings.Fields(work) {
		w = strings.Trim(strings.ToLower(w), ".,!?;:#")
		if len(w) < 2 {
			continue
		}
		if _, ok := seen[w]; ok {
			continue
		}
		seen[w] = struct{}{}
		opts.Terms = append(opts.Terms, w)
		for _, syn := range searchSynonyms[w] {
			sw := strings.ToLower(syn)
			if _, ok := seen[sw]; ok {
				continue
			}
			// only add single-token synonyms into terms; multi-word go to phrase boost via tsquery OR
			if !strings.Contains(sw, " ") {
				seen[sw] = struct{}{}
				opts.Terms = append(opts.Terms, sw)
			}
		}
	}
	if len(opts.Terms) == 0 && opts.Phrase != "" {
		opts.Terms = append(opts.Terms, strings.ToLower(opts.Phrase))
	}
	if len(opts.Terms) == 0 && len(opts.Raw) >= 2 && opts.Author == "" && opts.MemberHint == "" {
		opts.Terms = append(opts.Terms, strings.ToLower(opts.Raw))
	}

	opts.TSQuery = buildTSQuery(opts.Terms, opts.Phrase)
	return opts
}

func buildTSQuery(terms []string, phrase string) string {
	parts := make([]string, 0, len(terms)+1)
	if phrase != "" {
		words := strings.Fields(strings.ToLower(phrase))
		clean := make([]string, 0, len(words))
		for _, w := range words {
			w = regexp.MustCompile(`[^a-z0-9]`).ReplaceAllString(w, "")
			if len(w) >= 2 {
				clean = append(clean, w)
			}
		}
		if len(clean) > 0 {
			parts = append(parts, strings.Join(clean, " <-> "))
		}
	}
	for _, t := range terms {
		t = regexp.MustCompile(`[^a-z0-9]`).ReplaceAllString(t, "")
		if len(t) >= 2 {
			parts = append(parts, t+":*")
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, " | ")
}

func (a *API) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	opts := parseSmartQuery(q, r)

	// Allow author/forum-only browse-style searches
	if len(opts.Terms) == 0 && opts.Phrase == "" && opts.Author == "" && opts.MemberHint == "" && len(opts.ForumSlugs) == 0 {
		writeError(w, http.StatusBadRequest, "query too short — try keywords, @user, or filters")
		return
	}

	threads := []searchThreadHit{}
	members := []models.UserPublic{}
	forums := []searchForumHit{}
	profiles := []searchProfileHit{}

	wantThreads := opts.Scope == "all" || opts.Scope == "threads"
	wantMembers := opts.Scope == "all" || opts.Scope == "members"
	wantForums := opts.Scope == "all" || opts.Scope == "forums"
	wantProfile := opts.Scope == "all" || opts.Scope == "profile"

	if wantThreads {
		threads, _ = a.smartSearchThreads(opts)
	}
	if wantMembers {
		members, _ = a.smartSearchMembers(opts)
	}
	if wantForums {
		forums, _ = a.smartSearchForums(opts)
	}
	if wantProfile {
		profiles, _ = a.smartSearchProfilePosts(opts)
	}

	suggestions := buildSuggestions(opts)

	// Plain thread list for backwards compat
	plainThreads := make([]models.Thread, 0, len(threads))
	for _, t := range threads {
		plainThreads = append(plainThreads, t.Thread)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"query":       opts.Raw,
		"scope":       opts.Scope,
		"sort":        opts.Sort,
		"threads":     threads,
		"members":     members,
		"forums":      forums,
		"profilePosts": profiles,
		"suggestions": suggestions,
		"parsed": map[string]any{
			"terms":      opts.Terms,
			"phrase":     opts.Phrase,
			"author":     opts.Author,
			"forums":     opts.ForumSlugs,
			"titlesOnly": opts.TitlesOnly,
			"minReplies": opts.MinReplies,
			"after":      opts.After,
			"before":     opts.Before,
			"tsQuery":    opts.TSQuery,
		},
		"total":   len(threads) + len(members) + len(forums) + len(profiles),
		"results": plainThreads,
	})
}

func buildSuggestions(opts searchOpts) []searchSuggestion {
	out := []searchSuggestion{}
	if opts.Raw == "" {
		return out
	}
	if !opts.TitlesOnly && len(opts.Terms) > 0 {
		out = append(out, searchSuggestion{Label: "Titles only", Query: `title: ` + opts.Raw})
	}
	if opts.Author == "" && len(opts.Terms) == 1 {
		out = append(out, searchSuggestion{Label: "Posts by @" + opts.Terms[0], Query: "from:" + opts.Terms[0]})
	}
	if opts.MinReplies == 0 {
		out = append(out, searchSuggestion{Label: "Active threads (5+ replies)", Query: strings.TrimSpace(opts.Raw + " minreplies:5")})
	}
	return out
}

func (a *API) smartSearchThreads(opts searchOpts) ([]searchThreadHit, error) {
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}

	conds := []string{"1=1"}
	var scoreExpr string
	var snippetExpr string

	if opts.TSQuery != "" {
		tq := arg(opts.TSQuery)
		titleVec := `to_tsvector('english', coalesce(t.title,''))`
		bodyExists := `EXISTS (
			SELECT 1 FROM posts p
			WHERE p.thread_id=t.id AND to_tsvector('english', coalesce(p.body,'')) @@ to_tsquery('english', ` + tq + `)
		)`
		if opts.TitlesOnly {
			conds = append(conds, titleVec+` @@ to_tsquery('english', `+tq+`) OR similarity(t.title, `+arg(opts.Raw)+`) > 0.25`)
			scoreExpr = `ts_rank_cd(` + titleVec + `, to_tsquery('english', ` + tq + `)) * 2
				+ similarity(t.title, ` + arg(opts.Raw) + `)`
			snippetExpr = `t.title`
		} else {
			conds = append(conds, `(`+titleVec+` @@ to_tsquery('english', `+tq+`) OR `+bodyExists+`
				OR similarity(t.title, `+arg(opts.Raw)+`) > 0.3
				OR EXISTS (SELECT 1 FROM posts p WHERE p.thread_id=t.id AND p.body ILIKE `+arg("%"+opts.Raw+"%")+`))`)
			scoreExpr = `ts_rank_cd(` + titleVec + `, to_tsquery('english', ` + tq + `)) * 3
				+ CASE WHEN ` + bodyExists + ` THEN 1.2 ELSE 0 END
				+ similarity(t.title, ` + arg(opts.Raw) + `) * 1.5
				+ LEAST(t.reply_count, 50)::float / 50.0
				+ CASE WHEN t.is_featured THEN 0.4 ELSE 0 END`
			snippetExpr = `COALESCE((
				SELECT ts_headline('english', p.body, to_tsquery('english', ` + tq + `),
					'MaxWords=18, MinWords=8, StartSel=<mark>, StopSel=</mark>, MaxFragments=1')
				FROM posts p WHERE p.thread_id=t.id
				  AND to_tsvector('english', coalesce(p.body,'')) @@ to_tsquery('english', ` + tq + `)
				ORDER BY p.created_at ASC LIMIT 1
			), left((SELECT p2.body FROM posts p2 WHERE p2.thread_id=t.id ORDER BY p2.created_at ASC LIMIT 1), 140))`
		}
	} else if opts.Author != "" || len(opts.ForumSlugs) > 0 {
		scoreExpr = `1 + LEAST(t.reply_count, 50)::float / 50.0`
		snippetExpr = `left((SELECT p2.body FROM posts p2 WHERE p2.thread_id=t.id ORDER BY p2.created_at ASC LIMIT 1), 140)`
	} else {
		return nil, nil
	}

	if opts.Author != "" {
		conds = append(conds, `lower(a.username)=lower(`+arg(opts.Author)+`)`)
	}
	if len(opts.ForumSlugs) > 0 {
		ph := make([]string, 0, len(opts.ForumSlugs))
		for _, s := range opts.ForumSlugs {
			ph = append(ph, arg(s))
		}
		conds = append(conds, `f.slug IN (`+strings.Join(ph, ",")+`)`)
	}
	if opts.MinReplies > 0 {
		conds = append(conds, `t.reply_count >= `+arg(opts.MinReplies))
	}
	if opts.After != nil {
		conds = append(conds, `t.created_at >= `+arg(*opts.After))
	}
	if opts.Before != nil {
		conds = append(conds, `t.created_at <= `+arg(*opts.Before))
	}
	if opts.Phrase != "" && !opts.TitlesOnly {
		conds = append(conds, `(t.title ILIKE `+arg("%"+opts.Phrase+"%")+` OR EXISTS (
			SELECT 1 FROM posts p WHERE p.thread_id=t.id AND p.body ILIKE `+arg("%"+opts.Phrase+"%")+`
		))`)
	}

	order := `score DESC, t.last_post_at DESC`
	switch opts.Sort {
	case "date":
		order = `t.last_post_at DESC`
	case "replies":
		order = `t.reply_count DESC, t.last_post_at DESC`
	}

	limit := arg(opts.Limit)
	query := `
		SELECT t.id::text, t.forum_id::text, f.slug, f.name, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       ` + userSelectPrefix("a") + `,
		       COALESCE(` + scoreExpr + `, 0) AS score,
		       COALESCE(` + snippetExpr + `, '') AS snippet
		FROM threads t
		JOIN forums f ON f.id=t.forum_id
		JOIN users a ON a.id=t.author_id
		WHERE ` + strings.Join(conds, " AND ") + `
		ORDER BY ` + order + `
		LIMIT ` + limit

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		// Fallback if FTS/trgm unavailable
		return a.searchThreadsFallback(opts)
	}
	defer rows.Close()

	list := []searchThreadHit{}
	for rows.Next() {
		var t searchThreadHit
		if err := rows.Scan(
			&t.ID, &t.ForumID, &t.ForumSlug, &t.ForumName, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
			&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
			&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
			&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
			&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
			&t.Score, &t.Snippet,
		); err == nil {
			list = append(list, t)
		}
	}
	return list, nil
}

func (a *API) searchThreadsFallback(opts searchOpts) ([]searchThreadHit, error) {
	// Simple ILIKE path if extensions missing
	terms, _ := parseSearchQuery(opts.Raw)
	threads, err := a.searchThreads(terms, "%"+opts.Raw+"%", opts.Raw)
	if err != nil {
		return nil, err
	}
	out := make([]searchThreadHit, 0, len(threads))
	for _, t := range threads {
		out = append(out, searchThreadHit{Thread: t})
	}
	return out, nil
}

func (a *API) smartSearchMembers(opts searchOpts) ([]models.UserPublic, error) {
	if opts.MemberHint != "" {
		u, err := a.getUserByUsername(opts.MemberHint)
		if err == nil {
			return []models.UserPublic{u}, nil
		}
	}
	if len(opts.Terms) == 0 && opts.Author == "" {
		return nil, nil
	}
	q := opts.Raw
	if opts.Author != "" && len(opts.Terms) == 0 {
		q = opts.Author
	}
	args := []any{q, q, "%" + q + "%"}
	rows, err := a.DB.Query(`
		SELECT `+userSelect+`,
		  GREATEST(similarity(username, $1), similarity(display_name, $2)) AS score
		FROM users
		WHERE username % $1 OR display_name % $2
		   OR username ILIKE $3 OR display_name ILIKE $3 OR title ILIKE $3 OR bio ILIKE $3
		ORDER BY score DESC, trophy_points DESC
		LIMIT 12
	`, args...)
	if err != nil {
		terms, hint := parseSearchQuery(opts.Raw)
		return a.searchMembers(terms, hint, "%"+opts.Raw+"%")
	}
	defer rows.Close()
	list := []models.UserPublic{}
	for rows.Next() {
		var u models.UserPublic
		var lastSeen sql.NullTime
		var score float64
		if err := rows.Scan(
			&u.ID, &u.Username, &u.DisplayName, &u.Title, &u.Bio, &u.AvatarURL, &u.BannerURL,
			&u.Role, &u.MessageCount, &u.ReactionScore, &u.TrophyPoints, &lastSeen, &u.CreatedAt,
			&score,
		); err == nil {
			if lastSeen.Valid {
				t := lastSeen.Time
				u.LastSeenAt = &t
			}
			if u.DisplayName == "" {
				u.DisplayName = u.Username
			}
			list = append(list, u)
		}
	}
	return list, nil
}

func (a *API) smartSearchForums(opts searchOpts) ([]searchForumHit, error) {
	if len(opts.Terms) == 0 && opts.Phrase == "" {
		return nil, nil
	}
	q := opts.Raw
	rows, err := a.DB.Query(`
		SELECT f.slug, f.name, f.description, c.name,
		       GREATEST(similarity(f.name, $1), similarity(f.description, $1)) AS score
		FROM forums f
		JOIN categories c ON c.id=f.category_id
		WHERE f.name % $1 OR f.description % $1 OR f.name ILIKE $2 OR f.description ILIKE $2 OR c.name ILIKE $2
		ORDER BY score DESC, f.thread_count DESC
		LIMIT 8
	`, q, "%"+q+"%")
	if err != nil {
		terms, _ := parseSearchQuery(opts.Raw)
		return a.searchForums(terms, "%"+opts.Raw+"%")
	}
	defer rows.Close()
	list := []searchForumHit{}
	for rows.Next() {
		var f searchForumHit
		if rows.Scan(&f.Slug, &f.Name, &f.Description, &f.Category, &f.Score) == nil {
			list = append(list, f)
		}
	}
	return list, nil
}

func (a *API) smartSearchProfilePosts(opts searchOpts) ([]searchProfileHit, error) {
	if opts.TSQuery == "" && opts.Phrase == "" && len(opts.Terms) == 0 {
		return nil, nil
	}
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	conds := []string{"1=1"}
	var score string
	var snippet string
	if opts.TSQuery != "" {
		tq := arg(opts.TSQuery)
		conds = append(conds, "to_tsvector('english', coalesce(pp.body,'')) @@ to_tsquery('english', "+tq+") OR pp.body ILIKE "+arg("%"+opts.Raw+"%"))
		score = "ts_rank_cd(to_tsvector('english', coalesce(pp.body,'')), to_tsquery('english', " + tq + "))"
		snippet = "ts_headline('english', pp.body, to_tsquery('english', " + tq + "), 'MaxWords=20, MinWords=9, StartSel=<mark>, StopSel=</mark>, MaxFragments=1')"
	} else {
		conds = append(conds, "pp.body ILIKE "+arg("%"+opts.Raw+"%"))
		score = "1"
		snippet = "left(pp.body, 140)"
	}
	if opts.Author != "" {
		conds = append(conds, `lower(a.username)=lower(`+arg(opts.Author)+`)`)
	}
	if opts.After != nil {
		conds = append(conds, `pp.created_at >= `+arg(*opts.After))
	}
	if opts.Before != nil {
		conds = append(conds, `pp.created_at <= `+arg(*opts.Before))
	}

	query := `
		SELECT pp.id::text, pp.body, pp.created_at,
		       ` + userSelectPrefix("a") + `,
		       ` + userSelectPrefix("pu") + `,
		       COALESCE(` + score + `, 0),
		       COALESCE(` + snippet + `, left(pp.body, 140))
		FROM profile_posts pp
		JOIN users a ON a.id=pp.author_id
		JOIN users pu ON pu.id=pp.profile_user_id
		WHERE ` + strings.Join(conds, " AND ") + `
		ORDER BY  ` + score + ` DESC, pp.created_at DESC
		LIMIT ` + arg(12)

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []searchProfileHit{}
	for rows.Next() {
		var p searchProfileHit
		if err := rows.Scan(
			&p.ID, &p.Body, &p.CreatedAt,
			&p.Author.ID, &p.Author.Username, &p.Author.DisplayName, &p.Author.Title, &p.Author.Bio,
			&p.Author.AvatarURL, &p.Author.BannerURL, &p.Author.Role, &p.Author.MessageCount,
			&p.Author.ReactionScore, &p.Author.TrophyPoints, &p.Author.LastSeenAt, &p.Author.CreatedAt,
			&p.ProfileUser.ID, &p.ProfileUser.Username, &p.ProfileUser.DisplayName, &p.ProfileUser.Title, &p.ProfileUser.Bio,
			&p.ProfileUser.AvatarURL, &p.ProfileUser.BannerURL, &p.ProfileUser.Role, &p.ProfileUser.MessageCount,
			&p.ProfileUser.ReactionScore, &p.ProfileUser.TrophyPoints, &p.ProfileUser.LastSeenAt, &p.ProfileUser.CreatedAt,
			&p.Score, &p.Snippet,
		); err == nil {
			list = append(list, p)
		}
	}
	return list, nil
}

// Keep legacy helpers for fallbacks
func parseSearchQuery(q string) (terms []string, memberHint string) {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil, ""
	}
	if strings.HasPrefix(q, "@") {
		hint := strings.TrimPrefix(strings.TrimSpace(q[1:]), "@")
		if hint != "" {
			return []string{strings.ToLower(hint)}, hint
		}
	}
	for _, w := range strings.Fields(q) {
		w = strings.Trim(strings.ToLower(w), ".,!?;:")
		if len(w) >= 2 {
			terms = append(terms, w)
		}
	}
	if len(terms) == 0 && len(q) >= 2 {
		terms = []string{strings.ToLower(q)}
	}
	return terms, ""
}

func (a *API) searchThreads(terms []string, likeFull, raw string) ([]models.Thread, error) {
	where := make([]string, 0, len(terms))
	args := make([]any, 0, len(terms)+2)
	i := 1
	for _, term := range terms {
		pat := "%" + term + "%"
		where = append(where, `(t.title ILIKE $`+strconv.Itoa(i)+` OR EXISTS (
			SELECT 1 FROM posts p WHERE p.thread_id=t.id AND p.body ILIKE $`+strconv.Itoa(i)+`
		) OR a.username ILIKE $`+strconv.Itoa(i)+` OR a.display_name ILIKE $`+strconv.Itoa(i)+`)`)
		args = append(args, pat)
		i++
	}
	whereSQL := strings.Join(where, " AND ")
	args = append(args, likeFull, strings.ToLower(raw))
	rankIdx := i
	exactIdx := i + 1

	query := `
		SELECT t.id::text, t.forum_id::text, f.slug, f.name, t.title, t.slug, t.is_pinned, t.is_locked, t.is_featured,
		       t.view_count, t.reply_count, t.last_post_at, t.created_at,
		       ` + userSelectPrefix("a") + `,
		       CASE
		         WHEN lower(t.title) = $` + strconv.Itoa(exactIdx) + ` THEN 0
		         WHEN t.title ILIKE $` + strconv.Itoa(rankIdx) + ` THEN 1
		         ELSE 2
		       END AS rank
		FROM threads t
		JOIN forums f ON f.id=t.forum_id
		JOIN users a ON a.id=t.author_id
		WHERE ` + whereSQL + `
		ORDER BY rank ASC, t.last_post_at DESC
		LIMIT 30
	`

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []models.Thread{}
	for rows.Next() {
		var t models.Thread
		var rank int
		if err := rows.Scan(
			&t.ID, &t.ForumID, &t.ForumSlug, &t.ForumName, &t.Title, &t.Slug, &t.IsPinned, &t.IsLocked, &t.IsFeatured,
			&t.ViewCount, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt,
			&t.Author.ID, &t.Author.Username, &t.Author.DisplayName, &t.Author.Title, &t.Author.Bio,
			&t.Author.AvatarURL, &t.Author.BannerURL, &t.Author.Role, &t.Author.MessageCount,
			&t.Author.ReactionScore, &t.Author.TrophyPoints, &t.Author.LastSeenAt, &t.Author.CreatedAt,
			&rank,
		); err == nil {
			list = append(list, t)
		}
	}
	return list, nil
}

func (a *API) searchMembers(terms []string, memberHint, likeFull string) ([]models.UserPublic, error) {
	if memberHint != "" {
		u, err := a.getUserByUsername(memberHint)
		if err == nil {
			return []models.UserPublic{u}, nil
		}
	}

	where := make([]string, 0, len(terms))
	args := make([]any, 0, len(terms)+1)
	i := 1
	for _, term := range terms {
		pat := "%" + term + "%"
		where = append(where, `(username ILIKE $`+strconv.Itoa(i)+` OR display_name ILIKE $`+strconv.Itoa(i)+` OR title ILIKE $`+strconv.Itoa(i)+` OR bio ILIKE $`+strconv.Itoa(i)+`)`)
		args = append(args, pat)
		i++
	}
	if len(where) == 0 {
		return nil, nil
	}
	args = append(args, likeFull)
	rankIdx := i

	query := `SELECT ` + userSelect + `,
		CASE
		  WHEN username ILIKE $` + strconv.Itoa(rankIdx) + ` OR display_name ILIKE $` + strconv.Itoa(rankIdx) + ` THEN 0
		  ELSE 1
		END AS rank
		FROM users
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rank ASC, trophy_points DESC
		LIMIT 12`

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []models.UserPublic{}
	for rows.Next() {
		var u models.UserPublic
		var lastSeen sql.NullTime
		var rank int
		if err := rows.Scan(
			&u.ID, &u.Username, &u.DisplayName, &u.Title, &u.Bio, &u.AvatarURL, &u.BannerURL,
			&u.Role, &u.MessageCount, &u.ReactionScore, &u.TrophyPoints, &lastSeen, &u.CreatedAt,
			&rank,
		); err == nil {
			if lastSeen.Valid {
				t := lastSeen.Time
				u.LastSeenAt = &t
			}
			if u.DisplayName == "" {
				u.DisplayName = u.Username
			}
			list = append(list, u)
		}
	}
	return list, nil
}

func (a *API) searchForums(terms []string, likeFull string) ([]searchForumHit, error) {
	where := make([]string, 0, len(terms))
	args := make([]any, 0, len(terms)+1)
	i := 1
	for _, term := range terms {
		pat := "%" + term + "%"
		where = append(where, `(f.name ILIKE $`+strconv.Itoa(i)+` OR f.description ILIKE $`+strconv.Itoa(i)+` OR c.name ILIKE $`+strconv.Itoa(i)+`)`)
		args = append(args, pat)
		i++
	}
	if len(where) == 0 {
		return nil, nil
	}
	args = append(args, likeFull)
	rankIdx := i

	query := `
		SELECT f.slug, f.name, f.description, c.name,
		       CASE WHEN f.name ILIKE $` + strconv.Itoa(rankIdx) + ` THEN 0 ELSE 1 END AS rank
		FROM forums f
		JOIN categories c ON c.id=f.category_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rank ASC, f.thread_count DESC
		LIMIT 8
	`
	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []searchForumHit{}
	for rows.Next() {
		var f searchForumHit
		var rank int
		if err := rows.Scan(&f.Slug, &f.Name, &f.Description, &f.Category, &rank); err == nil {
			list = append(list, f)
		}
	}
	return list, nil
}
