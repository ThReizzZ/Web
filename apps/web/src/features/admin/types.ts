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

export interface AdminPlayer {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isDisabled: boolean;
  createdAt: string;
  lastLoginAt: string;
  lastLoginIp: string | null;
  activeSessions: number;
}

export interface WhitelistApplication {
  id: string;
  serverId: string | null;
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
  serverId: string | null;
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
  ipAddress: string | null;
  connectedAt: string;
  lastSeenAt: string;
}

export interface PluginTokenResponse {
  token: string | null;
}

export interface ServerBan {
  id: string;
  serverId: string | null;
  serverName: string;
  scope: "global" | "server";
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

export interface ServerIpBan {
  id: string;
  ipAddress: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  liftedAt: string | null;
  liftedBy: string | null;
  liftReason: string | null;
  isActive: boolean;
}

export interface ServerAdminOverview {
  servers: AdminServer[];
  bans: ServerBan[];
}

export interface AdminAccessLogItem {
  id: string;
  serverId: string;
  serverName: string;
  serverPort: number;
  communityName: string | null;
  steamId64: string;
  playerName: string;
  ipAddress: string | null;
  allowed: boolean;
  accessMethod: string;
  failureCode: string | null;
  rejectReason: string | null;
  rating: number | null;
  steamLevel: number | null;
  occurredAt: string;
}

export interface AdminAccessLogPage {
  items: AdminAccessLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminPlayerCandidate {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  online: boolean;
  lastSeenAt: string | null;
}

export interface AdminPlayerDetailProfile {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  bio: string;
  location: string;
  isDisabled: boolean;
  registeredAt: string | null;
  lastLoginAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  online: boolean;
}

export interface AdminPlayerOnlineServer {
  id: string;
  name: string;
  map: string;
  connectedAt: string;
}

export interface AdminPlayerSession {
  id: string;
  serverId: string;
  serverName: string;
  playerName: string;
  ipAddress: string | null;
  joinedAt: string;
  lastSeenAt: string;
  leftAt: string | null;
  leaveReason: string | null;
  durationSeconds: number;
}

export interface AdminPlayerGameBan {
  id: string;
  scope: "global" | "server";
  serverName: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdBy: string;
  liftedBy: string | null;
  isActive: boolean;
}

export interface AdminPlayerIpBan {
  id: string;
  ipAddress: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdBy: string;
  liftedBy: string | null;
  isActive: boolean;
}

export interface AdminPlayerWhitelistApplication {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  serverName: string;
}

export interface AdminPlayerWhitelistEntry {
  serverName: string;
  createdAt: string;
  addedBy: string | null;
}

export interface AdminLinkedAccount {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  lastSeenAt: string;
  online: boolean;
  hasActiveBan: boolean;
  hasActiveIpBan: boolean;
  hasWhitelist: boolean;
}

export interface AdminPlayerIpGroup {
  ipAddress: string;
  firstSeenAt: string;
  lastSeenAt: string;
  accessCount: number;
  sources: string[];
  gameLastSeenAt: string | null;
  websiteLastSeenAt: string | null;
  linkedAccounts: AdminLinkedAccount[];
}

export interface AdminPlayerDetailStats {
  accessSuccess: number;
  accessFailure: number;
  activeBanCount: number;
  knownIpCount: number;
  linkedAccountCount: number;
  totalPlaySeconds: number;
  sessionCount: number;
  topics: number;
  replies: number;
}

export interface AdminPlayerTimelineEvent {
  id: string;
  kind: string;
  occurredAt: string;
  title: string;
  description: string;
  actor: string | null;
  serverName: string | null;
}

export interface AdminPlayerNoteHistoryItem {
  id: string;
  note: string;
  tags: string[];
  changedAt: string;
  changedBy: string | null;
}

export interface AdminPlayerInternalProfile {
  note: string;
  tags: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  history: AdminPlayerNoteHistoryItem[];
}

export interface AdminPlayerDetail {
  profile: AdminPlayerDetailProfile;
  onlineServers: AdminPlayerOnlineServer[];
  stats: AdminPlayerDetailStats;
  accessLogs: AdminAccessLogItem[];
  sessions: AdminPlayerSession[];
  gameBans: AdminPlayerGameBan[];
  ipBans: AdminPlayerIpBan[];
  whitelistApplications: AdminPlayerWhitelistApplication[];
  whitelistEntries: AdminPlayerWhitelistEntry[];
  ipGroups: AdminPlayerIpGroup[];
  timeline: AdminPlayerTimelineEvent[];
  timelineTotal: number;
  internalProfile: AdminPlayerInternalProfile;
}
