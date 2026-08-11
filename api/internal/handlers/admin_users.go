package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/thestrengthlab/api/internal/models"
)

func (a *API) ListAdminUsers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page := 1
	if n, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && n > 0 {
		page = n
	}
	limit := 20
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 50 {
		limit = n
	}
	offset := (page - 1) * limit

	type adminUser struct {
		models.UserPublic
		Banned    bool       `json:"banned"`
		BanReason string     `json:"banReason"`
		BannedAt  *time.Time `json:"bannedAt,omitempty"`
	}

	where := `WHERE u.role NOT IN (SELECT slug FROM roles WHERE is_protected)`
	args := []any{}
	argN := 1
	if q != "" {
		where += ` AND (lower(u.username) LIKE lower($` + strconv.Itoa(argN) + `) OR lower(u.display_name) LIKE lower($` + strconv.Itoa(argN) + `) OR lower(u.email) LIKE lower($` + strconv.Itoa(argN) + `))`
		args = append(args, "%"+q+"%")
		argN++
	}

	var total int
	countQ := `SELECT COUNT(*) FROM users u ` + where
	if err := a.DB.QueryRow(countQ, args...).Scan(&total); err != nil {
		writeError(w, http.StatusInternalServerError, "count failed")
		return
	}

	listQ := `
		SELECT u.id::text, u.username, COALESCE(NULLIF(u.display_name,''), u.username), u.title, u.bio, u.avatar_url, u.banner_url, u.role,
		       u.message_count, u.reaction_score, u.trophy_points, u.last_seen_at, u.created_at,
		       u.banned_at, COALESCE(u.ban_reason,'')
		FROM users u
		` + where + `
		ORDER BY u.created_at DESC
		LIMIT $` + strconv.Itoa(argN) + ` OFFSET $` + strconv.Itoa(argN+1)
	args = append(args, limit, offset)

	rows, err := a.DB.Query(listQ, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	list := []adminUser{}
	for rows.Next() {
		var u adminUser
		var lastSeen sql.NullTime
		var bannedAt sql.NullTime
		if err := rows.Scan(
			&u.ID, &u.Username, &u.DisplayName, &u.Title, &u.Bio, &u.AvatarURL, &u.BannerURL, &u.Role,
			&u.MessageCount, &u.ReactionScore, &u.TrophyPoints, &lastSeen, &u.CreatedAt,
			&bannedAt, &u.BanReason,
		); err != nil {
			continue
		}
		if lastSeen.Valid {
			t := lastSeen.Time
			u.LastSeenAt = &t
		}
		if bannedAt.Valid {
			u.Banned = true
			t := bannedAt.Time
			u.BannedAt = &t
		}
		list = append(list, u)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"users": list,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (a *API) PatchAdminUser(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	userID := chiURLParam(r, "id")
	var req struct {
		Role      *string `json:"role"`
		Banned    *bool   `json:"banned"`
		BanReason string  `json:"banReason"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	var currentRole string
	err := a.DB.QueryRow(`SELECT role FROM users WHERE id=$1`, userID).Scan(&currentRole)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if a.roleIsProtected(currentRole) {
		writeError(w, http.StatusForbidden, "protected account")
		return
	}
	if userID == claims.UserID && req.Banned != nil && *req.Banned {
		writeError(w, http.StatusBadRequest, "cannot ban yourself")
		return
	}

	if req.Role != nil {
		if claims.Role != "admin" {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}
		role := strings.TrimSpace(*req.Role)
		var protected bool
		err := a.DB.QueryRow(`SELECT is_protected FROM roles WHERE slug=$1`, role).Scan(&protected)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid role")
			return
		}
		if protected {
			writeError(w, http.StatusForbidden, "cannot assign protected role")
			return
		}
		if _, err := a.DB.Exec(`UPDATE users SET role=$2, updated_at=NOW() WHERE id=$1`, userID, role); err != nil {
			writeError(w, http.StatusInternalServerError, "update failed")
			return
		}
		a.logModeration(claims.UserID, "user.role", "user", userID, role)
	}

	if req.Banned != nil {
		if *req.Banned {
			reason := strings.TrimSpace(req.BanReason)
			if reason == "" {
				reason = "Suspended by staff"
			}
			if _, err := a.DB.Exec(`UPDATE users SET banned_at=NOW(), ban_reason=$2, updated_at=NOW() WHERE id=$1`, userID, reason); err != nil {
				writeError(w, http.StatusInternalServerError, "ban failed")
				return
			}
			a.logModeration(claims.UserID, "user.ban", "user", userID, reason)
		} else {
			if _, err := a.DB.Exec(`UPDATE users SET banned_at=NULL, ban_reason='', updated_at=NOW() WHERE id=$1`, userID); err != nil {
				writeError(w, http.StatusInternalServerError, "unban failed")
				return
			}
			a.logModeration(claims.UserID, "user.unban", "user", userID, "")
		}
	}

	user, _ := a.getUserByID(userID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (a *API) ListModerationLog(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 200 {
		limit = n
	}
	type logRow struct {
		ID         string    `json:"id"`
		Action     string    `json:"action"`
		TargetType string    `json:"targetType"`
		TargetID   string    `json:"targetId"`
		Reason     string    `json:"reason"`
		Actor      string    `json:"actor"`
		CreatedAt  time.Time `json:"createdAt"`
	}
	rows, err := a.DB.Query(`
		SELECT m.id::text, m.action, m.target_type, m.target_id::text, COALESCE(m.reason,''), u.username, m.created_at
		FROM moderation_actions m
		JOIN users u ON u.id = m.actor_id
		ORDER BY m.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	list := []logRow{}
	for rows.Next() {
		var row logRow
		if rows.Scan(&row.ID, &row.Action, &row.TargetType, &row.TargetID, &row.Reason, &row.Actor, &row.CreatedAt) == nil {
			list = append(list, row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"actions": list})
}
