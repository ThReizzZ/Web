import type { ForumTopic } from "@/features/forum/types";

export interface PlayerOnlineServer {
  id: string;
  name: string;
  map: string;
}

export interface CommunityPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
  lastLoginAt: string;
  topics: number;
  replies: number;
  onlineServer: PlayerOnlineServer | null;
}

export interface PlayerStats {
  topics: number;
  replies: number;
}

export interface PlayerLatestServer {
  id: string;
  name: string;
  map: string;
  lastSeenAt: string;
  online: boolean;
}

export interface CommunityPlayerDetail {
  id: string;
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  bio: string;
  location: string;
  joinedAt: string;
  lastLoginAt: string;
  stats: PlayerStats;
  latestServer: PlayerLatestServer | null;
  recentTopics: ForumTopic[];
}
