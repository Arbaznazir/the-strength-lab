package handlers

import (
	"database/sql"

	"github.com/thestrengthlab/api/internal/models"
)

func profilePostSelectSQL() string {
	return `pp.id::text, pp.body, pp.created_at, ` + userSelectPrefix("u") + `, ` + userSelectPrefix("pu")
}

func scanProfilePost(rows *sql.Rows) (models.ProfilePost, error) {
	var p models.ProfilePost
	err := rows.Scan(
		&p.ID, &p.Body, &p.CreatedAt,
		&p.Author.ID, &p.Author.Username, &p.Author.DisplayName, &p.Author.Title, &p.Author.Bio,
		&p.Author.AvatarURL, &p.Author.BannerURL, &p.Author.Role, &p.Author.MessageCount,
		&p.Author.ReactionScore, &p.Author.TrophyPoints, &p.Author.LastSeenAt, &p.Author.CreatedAt,
		&p.ProfileUser.ID, &p.ProfileUser.Username, &p.ProfileUser.DisplayName, &p.ProfileUser.Title, &p.ProfileUser.Bio,
		&p.ProfileUser.AvatarURL, &p.ProfileUser.BannerURL, &p.ProfileUser.Role, &p.ProfileUser.MessageCount,
		&p.ProfileUser.ReactionScore, &p.ProfileUser.TrophyPoints, &p.ProfileUser.LastSeenAt, &p.ProfileUser.CreatedAt,
	)
	if err != nil {
		return p, err
	}
	if p.Author.DisplayName == "" {
		p.Author.DisplayName = p.Author.Username
	}
	if p.ProfileUser.DisplayName == "" {
		p.ProfileUser.DisplayName = p.ProfileUser.Username
	}
	return p, nil
}
