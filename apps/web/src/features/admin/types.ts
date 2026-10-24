import type { ForumTopic } from "@/features/forum/types";

export interface AdminStats {
  members: number;
  activeToday: number;
  topics: number;
  replies: number;
  servers: number;
  onlinePlayers: number;
  pendingWhitelist: number;
  activeBans: number;
}

export interface RoleCount {
  role: string;
  count: number;
}

export interface RecentUser {
  steamId64: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export interface WeeklyActivity {
  date: string;
  users: number;
  topics: number;
  replies: number;
}

export interface AdminOverview {
  stats: AdminStats;
  roles: RoleCount[];
  recentUsers: RecentUser[];
  recentTopics: ForumTopic[];
  weeklyActivity: WeeklyActivity[];
}

export interface AdminAccount {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isDisabled: boolean;
  disabledReason: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export interface Ban {
  id: string;
  steamId64: string;
  playerName: string;
  avatarUrl: string | null;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  liftedAt: string | null;
  liftedBy: string | null;
  liftReason: string | null;
  isActive: boolean;
}

export interface WhitelistApplication {
  id: string;
  serverId: string;
  serverName: string;
  steamId64: string;
  playerName: string;
  avatarUrl: string | null;
  message: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export interface WhitelistEntry {
  serverId: string;
  serverName: string;
  steamId64: string;
  playerName: string;
  avatarUrl: string | null;
  createdAt: string;
  addedBy: string | null;
}

export interface ServerWhitelistSetting {
  id: string;
  name: string;
  requiresWhitelist: boolean;
  whitelistCount: number;
  pendingCount: number;
}

export interface WhitelistOverview {
  applications: WhitelistApplication[];
  entries: WhitelistEntry[];
  servers: ServerWhitelistSetting[];
}

export interface AdminLookupUser {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isDisabled: boolean;
  isSystem: boolean;
}

export interface AdminLookupResponse {
  user: AdminLookupUser | null;
}
