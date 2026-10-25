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

export interface AdminForumTopic {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  categorySlug: string;
  categoryName: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  tags: string[];
  views: number;
  pinned: boolean;
  hot: boolean;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  deletedAt: string | null;
  isDeleted: boolean;
}

export interface AdminForumReply {
  id: string;
  topicSlug: string;
  topicTitle: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  likes: number;
  createdAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
}

export interface AdminForumUser {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isDisabled: boolean;
  isBanned: boolean;
  isMuted: boolean;
  muteReason: string | null;
  mutedUntil: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export interface AdminServer {
  id: string;
  name: string;
  map: string;
  description: string;
  communityId: string | null;
  community: string;
  status: string;
  host: string;
  port: number;
  region: string;
  tickrate: number;
  maxPlayers: number;
  latencyMs: number | null;
  tags: string[];
  mapImage: string;
  featured: boolean;
  isActive: boolean;
  requiresWhitelist: boolean;
  playerCount: number | null;
  lastReportedAt: string | null;
  pluginState: "disabled" | "waiting" | "connected";
  hasRconPassword: boolean;
  lastRconAt: string | null;
  rconFailures: number;
  pendingActions: number;
  players: AdminServerPlayer[];
}

export interface AdminCommunityServer {
  id: string;
  name: string;
  host: string;
  port: number;
  status: string;
  isActive: boolean;
  playerCount: number | null;
  maxPlayers: number;
  pluginState: "disabled" | "waiting" | "connected";
}

export interface AdminCommunity {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  servers: AdminCommunityServer[];
}

export interface AdminCommunityOverview {
  communities: AdminCommunity[];
}

export interface AdminServerPlayer {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  connectedAt: string;
  lastSeenAt: string;
}

export interface PluginTokenResponse {
  token: string | null;
}

export interface ServerBan {
  id: string;
  serverId: string;
  serverName: string;
  steamId64: string;
  playerName: string;
  avatarUrl: string | null;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  liftedAt: string | null;
  liftedBy: string | null;
  isActive: boolean;
}

export interface ServerAdminOverview {
  servers: AdminServer[];
  bans: ServerBan[];
}
