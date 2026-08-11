package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/thestrengthlab/api/internal/models"
)

func (a *API) ListReports(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`
		SELECT r.id::text, r.target_type, r.target_id::text, r.reason, r.status, r.created_at,
		       u.username
		FROM reports r
		JOIN users u ON u.id = r.reporter_id
		WHERE r.status = 'open'
		ORDER BY r.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	type reportRow struct {
		ID         string    `json:"id"`
		TargetType string    `json:"targetType"`
		TargetID   string    `json:"targetId"`
		Reason     string    `json:"reason"`
		Status     string    `json:"status"`
		CreatedAt  time.Time `json:"createdAt"`
		Reporter   string    `json:"reporter"`
	}
	list := []reportRow{}
	for rows.Next() {
		var row reportRow
		if err := rows.Scan(&row.ID, &row.TargetType, &row.TargetID, &row.Reason, &row.Status, &row.CreatedAt, &row.Reporter); err == nil {
			list = append(list, row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"reports": list})
}

func (a *API) ResolveReport(w http.ResponseWriter, r *http.Request) {
	id := chiURLParam(r, "id")
	res, err := a.DB.Exec(`UPDATE reports SET status='resolved' WHERE id=$1 AND status='open'`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "report not found")
		return
	}
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
