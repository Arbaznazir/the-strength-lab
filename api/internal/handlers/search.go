package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/thestrengthlab/api/internal/models"
)

type searchForumHit struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

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

func (a *API) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		writeError(w, http.StatusBadRequest, "query too short")
		return
	}

	terms, memberHint := parseSearchQuery(q)
	if len(terms) == 0 {
		writeError(w, http.StatusBadRequest, "query too short")
		return
	}
	likeFull := "%" + q + "%"

	threads, _ := a.searchThreads(terms, likeFull, q)
	members, _ := a.searchMembers(terms, memberHint, likeFull)
	forums, _ := a.searchForums(terms, likeFull)

	writeJSON(w, http.StatusOK, map[string]any{
		"query":         q,
		"threads":       threads,
		"members":       members,
		"forums":        forums,
		"total":         len(threads) + len(members) + len(forums),
		"results":       threads, // backwards compat for old clients
	})
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
