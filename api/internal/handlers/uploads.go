package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/thestrengthlab/api/internal/models"
)

var allowedImageMIME = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

const maxUploadBytes = 8 << 20 // 8MB

func (a *API) ensureUploadDir() error {
	if a.UploadDir == "" {
		a.UploadDir = "uploads"
	}
	return os.MkdirAll(a.UploadDir, 0o755)
}

func (a *API) Upload(w http.ResponseWriter, r *http.Request) {
	claims := a.requireUser(r)
	if err := a.ensureUploadDir(); err != nil {
		writeError(w, http.StatusInternalServerError, "upload dir unavailable")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+512)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 8MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()

	mime := header.Header.Get("Content-Type")
	ext, ok := allowedImageMIME[mime]
	if !ok {
		// sniff
		buf := make([]byte, 512)
		n, _ := file.Read(buf)
		_, _ = file.Seek(0, io.SeekStart)
		mime = http.DetectContentType(buf[:n])
		ext, ok = allowedImageMIME[mime]
		if !ok {
			writeError(w, http.StatusBadRequest, "only jpeg, png, gif, webp allowed")
			return
		}
	}

	id := uuid.New()
	stored := id.String() + ext
	destPath := filepath.Join(a.UploadDir, stored)
	out, err := os.Create(destPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save file")
		return
	}
	defer out.Close()

	written, err := io.Copy(out, file)
	if err != nil {
		_ = os.Remove(destPath)
		writeError(w, http.StatusInternalServerError, "write failed")
		return
	}

	filename := filepath.Base(header.Filename)
	if filename == "." || filename == "/" || filename == "" {
		filename = "image" + ext
	}

	purpose := r.FormValue("purpose") // avatar | banner | attachment
	url := "/uploads/" + stored

	if purpose == "avatar" || purpose == "banner" {
		col := "avatar_url"
		if purpose == "banner" {
			col = "banner_url"
		}
		q := fmt.Sprintf(`UPDATE users SET %s=$2, updated_at=NOW() WHERE id=$1`, col)
		if _, err := a.DB.Exec(q, claims.UserID, url); err != nil {
			_ = os.Remove(destPath)
			writeError(w, http.StatusInternalServerError, "profile update failed")
			return
		}
		user, _ := a.getUserByID(claims.UserID)
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":       id.String(),
			"url":      url,
			"filename": filename,
			"mimeType": mime,
			"sizeBytes": written,
			"user":     user,
		})
		return
	}

	_, err = a.DB.Exec(`
		INSERT INTO attachments(id, user_id, filename, stored_name, mime_type, size_bytes)
		VALUES($1,$2,$3,$4,$5,$6)
	`, id, claims.UserID, filename, stored, mime, written)
	if err != nil {
		_ = os.Remove(destPath)
		writeError(w, http.StatusInternalServerError, "db insert failed")
		return
	}

	writeJSON(w, http.StatusCreated, models.Attachment{
		ID:        id.String(),
		Filename:  filename,
		URL:       url,
		MimeType:  mime,
		SizeBytes: int(written),
		CreatedAt: time.Now().UTC(),
	})
}

func (a *API) attachToPost(tx *sql.Tx, postID, userID string, ids []string) error {
	for _, raw := range ids {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		res, err := tx.Exec(`
			UPDATE attachments SET post_id=$1
			WHERE id=$2 AND user_id=$3 AND post_id IS NULL
		`, postID, id, userID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return fmt.Errorf("invalid attachment")
		}
	}
	return nil
}

func (a *API) attachmentsForPosts(postIDs []string) (map[string][]models.Attachment, error) {
	out := map[string][]models.Attachment{}
	if len(postIDs) == 0 {
		return out, nil
	}
	// Build IN clause
	args := make([]any, len(postIDs))
	ph := make([]string, len(postIDs))
	for i, id := range postIDs {
		args[i] = id
		ph[i] = fmt.Sprintf("$%d", i+1)
	}
	rows, err := a.DB.Query(`
		SELECT id::text, post_id::text, filename, stored_name, mime_type, size_bytes, created_at
		FROM attachments
		WHERE post_id IN (`+strings.Join(ph, ",")+`)
		ORDER BY created_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var aitem models.Attachment
		var postID, stored string
		if err := rows.Scan(&aitem.ID, &postID, &aitem.Filename, &stored, &aitem.MimeType, &aitem.SizeBytes, &aitem.CreatedAt); err != nil {
			return nil, err
		}
		aitem.URL = "/uploads/" + stored
		out[postID] = append(out[postID], aitem)
	}
	return out, nil
}
