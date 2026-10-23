export type CategoryIcon = "megaphone" | "messages" | "map" | "graduation" | "life-buoy";

export interface ForumAuthor {
  name: string;
  role: string;
  avatarUrl?: string | null;
}

export interface ForumCategory {
  slug: string;
  name: string;
  description: string;
  icon: CategoryIcon;
  topicCount: number;
  postCount: number;
  lastActivityAt: string | null;
}

export interface ForumTopic {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  categoryName: string;
  categoryIcon: CategoryIcon;
  author: ForumAuthor;
  tags: string[];
  createdAt: string;
  lastActivityAt: string;
  views: number;
  pinned: boolean;
  hot: boolean;
  replyCount: number;
}

export interface ForumReply {
  id: string;
  content: string;
  likes: number;
  createdAt: string;
  author: ForumAuthor;
}

export interface ForumTopicDetail extends ForumTopic {
  content: string;
  replies: ForumReply[];
}

export interface ActiveUser {
  name: string;
  role: string;
  avatarUrl?: string | null;
  lastActiveAt: string;
}
