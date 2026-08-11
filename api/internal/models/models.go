package models

import "time"

type UserPublic struct {
	ID            string     `json:"id"`
	Username      string     `json:"username"`
	DisplayName   string     `json:"displayName"`
	Title         string     `json:"title"`
	Bio           string     `json:"bio"`
	AvatarURL     string     `json:"avatarUrl"`
	BannerURL     string     `json:"bannerUrl"`
	Role          string     `json:"role"`
	MessageCount  int        `json:"messageCount"`
	ReactionScore int        `json:"reactionScore"`
	TrophyPoints  int        `json:"trophyPoints"`
	LastSeenAt    *time.Time `json:"lastSeenAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
}

type Category struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sortOrder"`
	Forums      []Forum `json:"forums"`
}

type Forum struct {
	ID            string     `json:"id"`
	CategoryID    string     `json:"categoryId"`
	Name          string     `json:"name"`
	Slug          string     `json:"slug"`
	Description   string     `json:"description"`
	ThreadCount   int        `json:"threadCount"`
	PostCount     int        `json:"postCount"`
	LastPostAt    *time.Time `json:"lastPostAt,omitempty"`
	LastThreadID  *string    `json:"lastThreadId,omitempty"`
	LastThreadTitle *string  `json:"lastThreadTitle,omitempty"`
	LastPoster    *UserPublic `json:"lastPoster,omitempty"`
}

type Thread struct {
	ID           string      `json:"id"`
	ForumID      string      `json:"forumId"`
	ForumSlug    string      `json:"forumSlug,omitempty"`
	ForumName    string      `json:"forumName,omitempty"`
	Title        string      `json:"title"`
	Slug         string      `json:"slug"`
	IsPinned     bool        `json:"isPinned"`
	IsLocked     bool        `json:"isLocked"`
	IsFeatured   bool        `json:"isFeatured"`
	ViewCount    int         `json:"viewCount"`
	ReplyCount   int         `json:"replyCount"`
	LastPostAt   time.Time   `json:"lastPostAt"`
	CreatedAt    time.Time   `json:"createdAt"`
	Author       UserPublic  `json:"author"`
	LastPoster   *UserPublic `json:"lastPoster,omitempty"`
	Preview      string      `json:"preview,omitempty"`
}

type Post struct {
	ID            string       `json:"id"`
	ThreadID      string       `json:"threadId"`
	Body          string       `json:"body"`
	ReactionCount int          `json:"reactionCount"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
	Author        UserPublic   `json:"author"`
	ReactedByMe   bool         `json:"reactedByMe"`
	Attachments   []Attachment `json:"attachments,omitempty"`
	QuotedPost    *QuotedPost  `json:"quotedPost,omitempty"`
}

type QuotedPost struct {
	ID     string     `json:"id"`
	Body   string     `json:"body"`
	Author UserPublic `json:"author"`
}

type Attachment struct {
	ID        string    `json:"id"`
	Filename  string    `json:"filename"`
	URL       string    `json:"url"`
	MimeType  string    `json:"mimeType"`
	SizeBytes int       `json:"sizeBytes"`
	CreatedAt time.Time `json:"createdAt"`
}

type ProfilePost struct {
	ID          string     `json:"id"`
	Body        string     `json:"body"`
	CreatedAt   time.Time  `json:"createdAt"`
	Author      UserPublic `json:"author"`
	ProfileUser UserPublic `json:"profileUser"`
}

type Alert struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Link      string    `json:"link"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
}

type ChatMessage struct {
	ID        string     `json:"id"`
	Body      string     `json:"body"`
	CreatedAt time.Time  `json:"createdAt"`
	Author    UserPublic `json:"author"`
}

type Conversation struct {
	ID                   string       `json:"id"`
	Subject              string       `json:"subject"`
	LastMessageAt        time.Time    `json:"lastMessageAt"`
	LastMessagePreview   string       `json:"lastMessagePreview"`
	LastMessageAuthorID  string       `json:"lastMessageAuthorId"`
	Unread               bool         `json:"unread"`
	Participants         []UserPublic `json:"participants"`
}

type PrivateMessage struct {
	ID        string     `json:"id"`
	Body      string     `json:"body"`
	CreatedAt time.Time  `json:"createdAt"`
	Author    UserPublic `json:"author"`
}

type ForumStats struct {
	Threads      int         `json:"threads"`
	Messages     int         `json:"messages"`
	Members      int         `json:"members"`
	LatestMember *UserPublic `json:"latestMember,omitempty"`
}

type OnlineStats struct {
	Members int `json:"members"`
	Guests  int `json:"guests"`
	Total   int `json:"total"`
}
