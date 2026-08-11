package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/auth"
	"github.com/thestrengthlab/api/internal/models"
)

type registerReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginReq struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func (a *API) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if !validUsername(req.Username) || !strings.Contains(req.Email, "@") || len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "invalid username, email, or password (min 8)")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	id := uuid.New()
	_, err = a.DB.Exec(
		`INSERT INTO users(id, username, email, password_hash, display_name, title) VALUES($1,$2,$3,$4,$5,'New member')`,
		id, req.Username, req.Email, hash, req.Username,
	)
	if err != nil {
		writeError(w, http.StatusConflict, "username or email already taken")
		return
	}
	token, _, err := auth.IssueToken(a.JWTSecret, a.JWTTTL, id, req.Username, "member")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token error")
		return
	}
	user, _ := a.getUserByID(id.String())
	a.setAuthCookie(w, token)
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": user})
}

func (a *API) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	login := strings.TrimSpace(req.Login)
	var id uuid.UUID
	var username, role, hash string
	var bannedAt sql.NullTime
	err := a.DB.QueryRow(
		`SELECT id, username, role, password_hash, banned_at FROM users WHERE lower(username)=lower($1) OR lower(email)=lower($1)`,
		login,
	).Scan(&id, &username, &role, &hash, &bannedAt)
	if err != nil || !auth.CheckPassword(hash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if bannedAt.Valid {
		writeError(w, http.StatusForbidden, "account suspended")
		return
	}
	token, _, err := auth.IssueToken(a.JWTSecret, a.JWTTTL, id, username, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token error")
		return
	}
	touchLastSeen(a.DB, id.String())
	user, _ := a.getUserByID(id.String())
	a.setAuthCookie(w, token)
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func (a *API) Logout(w http.ResponseWriter, r *http.Request) {
	a.clearAuthCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) Me(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	touchLastSeen(a.DB, claims.UserID)
	user, err := a.getUserByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	var unreadAlerts, unreadMsgs int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM alerts WHERE user_id=$1 AND is_read=false`, claims.UserID).Scan(&unreadAlerts)
	_ = a.DB.QueryRow(`
		SELECT COUNT(*) FROM conversation_participants cp
		JOIN conversations c ON c.id=cp.conversation_id
		WHERE cp.user_id=$1 AND (cp.last_read_at IS NULL OR cp.last_read_at < c.last_message_at)
	`, claims.UserID).Scan(&unreadMsgs)
	writeJSON(w, http.StatusOK, map[string]any{
		"user":            user,
		"unreadAlerts":    unreadAlerts,
		"unreadMessages":  unreadMsgs,
	})
}

func (a *API) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	var req struct {
		DisplayName string `json:"displayName"`
		Title       string `json:"title"`
		Bio         string `json:"bio"`
		AvatarURL   string `json:"avatarUrl"`
		BannerURL   string `json:"bannerUrl"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	avatar := sanitizeMediaURL(req.AvatarURL)
	banner := sanitizeMediaURL(req.BannerURL)
	bio := strings.TrimSpace(req.Bio)
	if len(bio) > 2000 {
		bio = bio[:2000]
	}
	_, err := a.DB.Exec(
		`UPDATE users SET display_name=$2, title=$3, bio=$4, avatar_url=$5, banner_url=$6, updated_at=NOW() WHERE id=$1`,
		claims.UserID, strings.TrimSpace(req.DisplayName), strings.TrimSpace(req.Title),
		bio, avatar, banner,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}
	user, _ := a.getUserByID(claims.UserID)
	writeJSON(w, http.StatusOK, user)
}

func (a *API) GetMember(w http.ResponseWriter, r *http.Request) {
	username := chiURLParam(r, "username")
	user, err := a.getUserByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (a *API) MembersOverview(w http.ResponseWriter, r *http.Request) {
	var total int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&total)

	topMessages, err := a.listUsers(`message_count DESC`, 5, 0, "", nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	topReactions, err := a.listUsers(`reaction_score DESC`, 5, 0, "", nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	topPoints, err := a.listUsers(`trophy_points DESC`, 5, 0, "", nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	newest, err := a.listUsers(`created_at DESC`, 12, 0, "", nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	staff, err := a.listStaff()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"totalMembers": total,
		"topMessages":  topMessages,
		"topReactions": topReactions,
		"topPoints":    topPoints,
		"newest":       newest,
		"staff":        staff,
	})
}

func (a *API) ListMembers(w http.ResponseWriter, r *http.Request) {
	sort := r.URL.Query().Get("sort")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page := parsePage(r)
	limit := parseLimit(r, DefaultPageSize, 50)

	if sort == "staff" {
		staff, err := a.listStaff()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "query failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"members": staff, "staff": staff})
		return
	}

	order := `created_at DESC`
	switch sort {
	case "messages":
		order = `message_count DESC`
	case "reactions":
		order = `reaction_score DESC`
	case "points":
		order = `trophy_points DESC`
	case "newest":
		order = `created_at DESC`
	}

	var args []any
	where := ""
	if q != "" {
		where = ` WHERE username ILIKE $1 OR display_name ILIKE $1`
		args = append(args, "%"+q+"%")
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM users` + where
	if len(args) > 0 {
		if err := a.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
			writeError(w, http.StatusInternalServerError, "query failed")
			return
		}
	} else {
		if err := a.DB.QueryRow(countQuery).Scan(&total); err != nil {
			writeError(w, http.StatusInternalServerError, "query failed")
			return
		}
	}

	pages, offset, page := paginate(total, page, limit)
	list, err := a.listUsers(order, limit, offset, where, args)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	staff, err := a.listStaff()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"members": list,
		"staff":   staff,
		"page":    page,
		"pages":   pages,
		"total":   total,
		"limit":   limit,
	})
}

func (a *API) listStaff() ([]models.UserPublic, error) {
	rows, err := a.DB.Query(`SELECT ` + userSelect + ` FROM users WHERE role IN ('moderator','admin') ORDER BY role DESC, username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUserRows(rows)
}

func (a *API) listUsers(order string, limit, offset int, where string, args []any) ([]models.UserPublic, error) {
	query := `SELECT ` + userSelect + ` FROM users` + where + ` ORDER BY ` + order + ` LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(offset)
	var rows *sql.Rows
	var err error
	if len(args) > 0 {
		rows, err = a.DB.Query(query, args...)
	} else {
		rows, err = a.DB.Query(query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUserRows(rows)
}

func scanUserRows(rows *sql.Rows) ([]models.UserPublic, error) {
	list := []models.UserPublic{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, nil
}
