export type UserPublic = {
  id: string;
  username: string;
  displayName: string;
  title: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  role: string;
  messageCount: number;
  reactionScore: number;
  trophyPoints: number;
  lastSeenAt?: string;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  forums: Forum[];
};

export type Forum = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  threadCount: number;
  postCount: number;
  lastPostAt?: string;
  lastThreadId?: string;
  lastThreadTitle?: string;
  lastPoster?: UserPublic;
};

export type Thread = {
  id: string;
  forumId: string;
  forumSlug?: string;
  forumName?: string;
  title: string;
  slug: string;
  isPinned: boolean;
  isLocked: boolean;
  isFeatured: boolean;
  viewCount: number;
  replyCount: number;
  lastPostAt: string;
  createdAt: string;
  author: UserPublic;
  lastPoster?: UserPublic;
  preview?: string;
};

export type Post = {
  id: string;
  threadId: string;
  body: string;
  reactionCount: number;
  createdAt: string;
  updatedAt: string;
  author: UserPublic;
  reactedByMe: boolean;
  attachments?: Attachment[];
  quotedPost?: QuotedPost;
};

export type QuotedPost = {
  id: string;
  body: string;
  author: UserPublic;
};

export type Attachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ProfilePost = {
  id: string;
  body: string;
  createdAt: string;
  author: UserPublic;
  profileUser: UserPublic;
};

export type SearchForumHit = {
  slug: string;
  name: string;
  description: string;
  category: string;
  score?: number;
};

export type SearchThreadHit = Thread & {
  snippet?: string;
  score?: number;
};

export type SearchProfileHit = {
  id: string;
  body: string;
  snippet?: string;
  createdAt: string;
  author: UserPublic;
  profileUser: UserPublic;
  score?: number;
};

export type SearchResponse = {
  query: string;
  scope?: string;
  sort?: string;
  threads: SearchThreadHit[];
  members: UserPublic[];
  forums: SearchForumHit[];
  profilePosts?: SearchProfileHit[];
  suggestions?: { label: string; query: string }[];
  parsed?: {
    terms?: string[];
    phrase?: string;
    author?: string;
    forums?: string[];
    titlesOnly?: boolean;
    minReplies?: number;
  };
  total: number;
  results: Thread[];
};

export type Alert = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: UserPublic;
};

export type Conversation = {
  id: string;
  subject: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageAuthorId: string;
  unread: boolean;
  participants: UserPublic[];
};

export type PrivateMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: UserPublic;
};

export type ForumStats = {
  threads: number;
  messages: number;
  members: number;
  latestMember?: UserPublic;
};

export type OnlineStats = {
  members: number;
  guests: number;
  total: number;
};

export type AuthResponse = {
  token: string;
  user: UserPublic;
};

export type MeResponse = {
  user: UserPublic;
  unreadAlerts: number;
  unreadMessages: number;
};

export type ApiError = {
  error: string;
};
