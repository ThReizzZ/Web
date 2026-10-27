import type { ForumTopic } from "@/features/forum/types";

export interface AccountUser {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  bio: string;
  location: string;
  joinedAt: string;
  lastLoginAt: string;
}

export interface AccountStats {
  topics: number;
  replies: number;
  favorites: number;
  sessions: number;
}

export interface FavoriteServer {
  id: string;
  name: string;
  map: string;
  status: "online" | "maintenance" | "offline" | "hibernating";
  onlinePlayers: number;
  maxPlayers: number;
  mapImage: string;
}

export interface AccountActivity {
  kind: "topic" | "reply";
  title: string;
  detail: string;
  createdAt: string;
  href: string | null;
}

export interface AccountWhitelist {
  whitelisted: boolean;
  pending: boolean;
}

export interface AccountGameBan {
  scope: "global" | "server" | "ip";
  serverName: string;
  reason: string;
  expiresAt: string | null;
}

export interface AccountOverview {
  user: AccountUser;
  stats: AccountStats;
  whitelist: AccountWhitelist;
  gameBans: AccountGameBan[];
  recentTopics: ForumTopic[];
  favorites: FavoriteServer[];
  recentActivity: AccountActivity[];
}
