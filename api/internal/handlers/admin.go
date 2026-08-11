package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/thestrengthlab/api/internal/models"
)

func (a *API) ListReports(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "open"
	}
	if status != "open" && status != "resolved" && status != "all" {
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}

	page := 1
	if n, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && n > 0 {
		page = n
	}
	limit := 20
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 50 {
		limit = n
	}
	offset := (page - 1) * limit

	where := "WHERE 1=1"
	args := []any{}
	argN := 1
	if status != "all" {
		where += " AND r.status = $" + strconv.Itoa(argN)
		args = append(args, status)
		argN++
	}

	var total int
	countQ := `SELECT COUNT(*) FROM reports r ` + where
	if err := a.DB.QueryRow(countQ, args...).Scan(&total); err != nil {
		writeError(w, http.StatusInternalServerError, "count failed")
		return
	}

	listQ := `
		SELECT r.id::text, r.target_type, r.target_id::text, r.reason, r.status, r.created_at,
		       u.username, r.resolved_at, COALESCE(res.username, '')
		FROM reports r
		JOIN users u ON u.id = r.reporter_id
		LEFT JOIN users res ON res.id = r.resolved_by
		` + where + `
		ORDER BY r.created_at DESC
		LIMIT $` + strconv.Itoa(argN) + ` OFFSET $` + strconv.Itoa(argN+1)
	args = append(args, limit, offset)

	rows, err := a.DB.Query(listQ, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	type reportRow struct {
		ID            string     `json:"id"`
		TargetType    string     `json:"targetType"`
		TargetID      string     `json:"targetId"`
		Reason        string     `json:"reason"`
		Status        string     `json:"status"`
		CreatedAt     time.Time  `json:"createdAt"`
		Reporter      string     `json:"reporter"`
		ResolvedAt    *time.Time `json:"resolvedAt,omitempty"`
		ResolvedBy    string     `json:"resolvedBy,omitempty"`
		TargetPreview string     `json:"targetPreview,omitempty"`
		TargetLink    string     `json:"targetLink,omitempty"`
		ThreadSlug    string     `json:"threadSlug,omitempty"`
		ThreadTitle   string     `json:"threadTitle,omitempty"`
	}
	list := []reportRow{}
	for rows.Next() {
		var row reportRow
		var resolvedAt sql.NullTime
		if err := rows.Scan(&row.ID, &row.TargetType, &row.TargetID, &row.Reason, &row.Status, &row.CreatedAt, &row.Reporter, &resolvedAt, &row.ResolvedBy); err == nil {
			if resolvedAt.Valid {
				t := resolvedAt.Time
				row.ResolvedAt = &t
			}
			row.TargetPreview, row.TargetLink, row.ThreadSlug, row.ThreadTitle = a.enrichReportTarget(row.TargetType, row.TargetID)
			list = append(list, row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"reports": list,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (a *API) ResolveReport(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	id := chiURLParam(r, "id")
	res, err := a.DB.Exec(`
		UPDATE reports SET status='resolved', resolved_at=NOW(), resolved_by=$2
		WHERE id=$1 AND status='open'
	`, id, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "report not found")
		return
	}
	a.logModeration(claims.UserID, "report.resolve", "report", id, "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func scanPostRow(rows *sql.Rows, withQuote bool) (models.Post, error) {
	var p models.Post
	var qpID, qpBody sql.NullString
	var quID, quUser, quDisplay, quTitle, quBio, quAvatar, quBanner, quRole sql.NullString
	var quMsg, quReact, quPoints sql.NullInt64
	var quSeen sql.NullTime
	var quCreated sql.NullTime

	dest := []any{
		&p.ID, &p.ThreadID, &p.Body, &p.ReactionCount, &p.CreatedAt, &p.UpdatedAt,
		&p.Author.ID, &p.Author.Username, &p.Author.DisplayName, &p.Author.Title, &p.Author.Bio,
		&p.Author.AvatarURL, &p.Author.BannerURL, &p.Author.Role, &p.Author.MessageCount,
		&p.Author.ReactionScore, &p.Author.TrophyPoints, &p.Author.LastSeenAt, &p.Author.CreatedAt,
		&p.ReactedByMe,
	}
	if withQuote {
		dest = append(dest,
			&qpID, &qpBody,
			&quID, &quUser, &quDisplay, &quTitle, &quBio, &quAvatar, &quBanner, &quRole,
			&quMsg, &quReact, &quPoints, &quSeen, &quCreated,
		)
	}

	if err := rows.Scan(dest...); err != nil {
		return p, err
	}
	if withQuote && qpID.Valid && qpBody.Valid {
		qp := &models.QuotedPost{ID: qpID.String, Body: qpBody.String}
		if quID.Valid {
			qp.Author = models.UserPublic{
				ID: quID.String, Username: quUser.String, DisplayName: quDisplay.String,
				Title: quTitle.String, Bio: quBio.String, AvatarURL: quAvatar.String,
				BannerURL: quBanner.String, Role: quRole.String,
				MessageCount: int(quMsg.Int64), ReactionScore: int(quReact.Int64),
				TrophyPoints: int(quPoints.Int64),
			}
			if quSeen.Valid {
				t := quSeen.Time
				qp.Author.LastSeenAt = &t
			}
			if quCreated.Valid {
				qp.Author.CreatedAt = quCreated.Time
			}
			if qp.Author.DisplayName == "" {
				qp.Author.DisplayName = qp.Author.Username
			}
		}
		p.QuotedPost = qp
	}
	return p, nil
}
