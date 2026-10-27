import type { AccountOverview } from "@/features/account/types";
import type {
  AdminAccount,
  AdminCommunity,
  AdminCommunityOverview,
  AdminForumReply,
  AdminForumTopic,
  AdminForumUser,
  AdminLookupResponse,
  AdminOverview,
  PluginTokenResponse,
  ServerAdminOverview,
  ServerBan,
  ServerIpBan,
  WhitelistOverview,
} from "@/features/admin/types";
import type {
  ActiveUser,
  ForumCategory,
  ForumTopic,
  ForumTopicDetail,
} from "@/features/forum/types";
import type { KzServer } from "@/features/servers/data/servers";
import type { ApiClient } from "@/lib/api/client";

export interface CommunityStats {
  members: number;
  topics: number;
  replies: number;
  onlinePlayers: number;
  servers: number;
  newTopicsWeek: number;
  activeMembersWeek: number;
}

export interface AuthUser {
  steamId64: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  bio: string;
  location: string;
  joinedAt: string;
  lastLoginAt: string;
}

export interface MeResponse {
  user: AuthUser | null;
}

const noStore = { cache: "no-store" as const };

export function fetchServers(client: ApiClient): Promise<KzServer[]> {
  return client.get<KzServer[]>("/api/v1/servers", noStore);
}

export function fetchCommunityStats(client: ApiClient): Promise<CommunityStats> {
  return client.get<CommunityStats>("/api/v1/community/overview", noStore);
}

export function fetchForumCategories(client: ApiClient): Promise<ForumCategory[]> {
  return client.get<ForumCategory[]>("/api/v1/forum/categories", noStore);
}

export function fetchForumTopics(
  client: ApiClient,
  options: { limit?: number; category?: string; q?: string } = {},
): Promise<ForumTopic[]> {
  return client.get<ForumTopic[]>("/api/v1/forum/topics", {
    ...noStore,
    query: options,
  });
}

export function fetchForumTopic(client: ApiClient, slug: string): Promise<ForumTopicDetail> {
  return client.get<ForumTopicDetail>(`/api/v1/forum/topics/${encodeURIComponent(slug)}`, noStore);
}

export function fetchActiveUsers(client: ApiClient, limit = 8): Promise<ActiveUser[]> {
  return client.get<ActiveUser[]>("/api/v1/forum/active-users", {
    ...noStore,
    query: { limit },
  });
}

export function fetchMe(client: ApiClient): Promise<MeResponse> {
  return client.get<MeResponse>("/api/v1/auth/me", noStore);
}

export function fetchAccount(client: ApiClient): Promise<AccountOverview> {
  return client.get<AccountOverview>("/api/v1/account", noStore);
}

export function fetchAdminOverview(client: ApiClient): Promise<AdminOverview> {
  return client.get<AdminOverview>("/api/v1/admin/overview", noStore);
}

export async function fetchAdminAccounts(client: ApiClient): Promise<AdminAccount[]> {
  return client.get<AdminAccount[]>("/api/v1/admin/admins", noStore);
}

export async function addAdminAccount(client: ApiClient, steamId64: string): Promise<AdminAccount> {
  return client.request<AdminAccount>("/api/v1/admin/admins", {
    method: "POST",
    body: JSON.stringify({ steamId64 }),
  });
}

export async function removeAdminAccount(client: ApiClient, steamId64: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/admins/${encodeURIComponent(steamId64)}`, {
    method: "DELETE",
  });
}

export async function setAdminDisabled(
  client: ApiClient,
  steamId64: string,
  disabled: boolean,
  reason?: string,
): Promise<void> {
  await client.request<void>(
    `/api/v1/admin/admins/${encodeURIComponent(steamId64)}/${disabled ? "disable" : "enable"}`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

export async function fetchServerBans(client: ApiClient): Promise<ServerBan[]> {
  return client.get<ServerBan[]>("/api/v1/admin/server-bans", noStore);
}

export async function createServerBan(
  client: ApiClient,
  input: {
    steamId64: string;
    reason: string;
    playerName?: string;
    expiresInHours?: number | null;
    scope: "global" | "server";
    serverId?: string;
  },
): Promise<void> {
  await client.request<void>("/api/v1/admin/server-bans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchServerIpBans(client: ApiClient): Promise<ServerIpBan[]> {
  return client.get<ServerIpBan[]>("/api/v1/admin/server-ip-bans", noStore);
}

export async function createServerIpBan(
  client: ApiClient,
  input: { ipAddress: string; reason: string; expiresInHours?: number | null },
): Promise<void> {
  await client.request<void>("/api/v1/admin/server-ip-bans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function liftServerIpBan(
  client: ApiClient,
  id: string,
  reason?: string,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/server-ip-bans/${encodeURIComponent(id)}/lift`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function fetchWhitelistOverview(client: ApiClient): Promise<WhitelistOverview> {
  return client.get<WhitelistOverview>("/api/v1/admin/whitelist", noStore);
}

export async function reviewWhitelistApplication(
  client: ApiClient,
  id: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<void> {
  await client.request<void>(
    `/api/v1/admin/whitelist/applications/${encodeURIComponent(id)}/${decision}`,
    {
      method: "POST",
      body: JSON.stringify({ note }),
    },
  );
}

export async function addWhitelistEntry(
  client: ApiClient,
  input: { steamId64: string; playerName?: string },
): Promise<void> {
  await client.request<void>("/api/v1/admin/whitelist", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeWhitelistEntry(client: ApiClient, steamId64: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/whitelist/${encodeURIComponent(steamId64)}`, {
    method: "DELETE",
  });
}

export async function setServerWhitelist(
  client: ApiClient,
  serverId: string,
  requiresWhitelist: boolean,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(serverId)}/whitelist`, {
    method: "PATCH",
    body: JSON.stringify({ requiresWhitelist }),
  });
}

export async function submitWhitelistApplication(
  client: ApiClient,
  input: { message: string },
): Promise<void> {
  await client.request<void>("/api/v1/whitelist/applications", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAdminUserLookup(
  client: ApiClient,
  steamId64: string,
): Promise<AdminLookupResponse> {
  return client.get<AdminLookupResponse>("/api/v1/admin/users/lookup", {
    ...noStore,
    query: { steamId64 },
  });
}

export async function fetchAdminForumTopics(client: ApiClient): Promise<AdminForumTopic[]> {
  return client.get<AdminForumTopic[]>("/api/v1/admin/forum/topics", noStore);
}

export async function fetchAdminForumReplies(client: ApiClient): Promise<AdminForumReply[]> {
  return client.get<AdminForumReply[]>("/api/v1/admin/forum/replies", noStore);
}

export async function fetchAdminForumUsers(client: ApiClient): Promise<AdminForumUser[]> {
  return client.get<AdminForumUser[]>("/api/v1/admin/forum/users", noStore);
}

export async function updateAdminTopic(
  client: ApiClient,
  slug: string,
  input: {
    title: string;
    excerpt: string;
    content: string;
    categorySlug: string;
    tags: string[];
    pinned: boolean;
    hot: boolean;
  },
): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/topics/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminTopic(client: ApiClient, slug: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/topics/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

export async function restoreAdminTopic(client: ApiClient, slug: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/topics/${encodeURIComponent(slug)}/restore`, {
    method: "POST",
  });
}

export async function updateAdminReply(
  client: ApiClient,
  id: string,
  content: string,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/replies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export async function deleteAdminReply(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/replies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function restoreAdminReply(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/replies/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}

export async function muteForumUser(
  client: ApiClient,
  steamId64: string,
  reason: string,
  expiresInHours?: number | null,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/users/${encodeURIComponent(steamId64)}/mute`, {
    method: "POST",
    body: JSON.stringify({ reason, expiresInHours }),
  });
}

export async function unmuteForumUser(client: ApiClient, steamId64: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/forum/users/${encodeURIComponent(steamId64)}/mute`, {
    method: "DELETE",
  });
}

export async function fetchAdminServers(client: ApiClient): Promise<ServerAdminOverview> {
  return client.get<ServerAdminOverview>("/api/v1/admin/servers", noStore);
}

export async function createAdminServer(
  client: ApiClient,
  input: { host: string; port: number; communityId?: string },
): Promise<{ id: string }> {
  return client.request<{ id: string }>("/api/v1/admin/servers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAdminServerPluginToken(
  client: ApiClient,
  id: string,
): Promise<string | null> {
  const response = await client.get<PluginTokenResponse>(
    `/api/v1/admin/servers/${encodeURIComponent(id)}/plugin-token`,
    noStore,
  );
  return response.token;
}

export async function rotateAdminServerPluginToken(client: ApiClient, id: string): Promise<string> {
  const response = await client.request<PluginTokenResponse>(
    `/api/v1/admin/servers/${encodeURIComponent(id)}/plugin-token`,
    { method: "POST" },
  );
  if (!response.token) {
    throw new Error("服务器没有返回插件令牌。");
  }
  return response.token;
}

export async function clearAdminServerPluginToken(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(id)}/plugin-token`, {
    method: "DELETE",
  });
}

export async function setAdminServerRconPassword(
  client: ApiClient,
  id: string,
  password: string,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(id)}/rcon-password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export async function clearAdminServerRconPassword(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(id)}/rcon-password`, {
    method: "DELETE",
  });
}

export async function setAdminServerActive(
  client: ApiClient,
  id: string,
  isActive: boolean,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function setAdminServerCommunity(
  client: ApiClient,
  id: string,
  communityId: string | null,
): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(id)}/community`, {
    method: "PATCH",
    body: JSON.stringify({ communityId }),
  });
}

export async function fetchAdminCommunities(client: ApiClient): Promise<AdminCommunity[]> {
  const response = await client.get<AdminCommunityOverview>(
    "/api/v1/admin/server-communities",
    noStore,
  );
  return response.communities;
}

export async function createAdminCommunity(
  client: ApiClient,
  input: { name: string; description?: string },
): Promise<{ id: string }> {
  return client.request<{ id: string }>("/api/v1/admin/server-communities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminCommunity(
  client: ApiClient,
  id: string,
  input: { name?: string; description?: string },
): Promise<void> {
  await client.request<void>(`/api/v1/admin/server-communities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminCommunity(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/server-communities/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function addAdminCommunityServers(
  client: ApiClient,
  id: string,
  serverIds: string[],
): Promise<void> {
  await client.request<void>(`/api/v1/admin/server-communities/${encodeURIComponent(id)}/servers`, {
    method: "POST",
    body: JSON.stringify({ serverIds }),
  });
}

export async function removeAdminCommunityServer(
  client: ApiClient,
  id: string,
  serverId: string,
): Promise<void> {
  await client.request<void>(
    `/api/v1/admin/server-communities/${encodeURIComponent(id)}/servers/${encodeURIComponent(serverId)}`,
    { method: "DELETE" },
  );
}

export async function reorderAdminServers(client: ApiClient, serverIds: string[]): Promise<void> {
  await client.request<void>("/api/v1/admin/servers/order", {
    method: "PUT",
    body: JSON.stringify({ serverIds }),
  });
}

export async function deleteAdminServer(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/servers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function kickServerPlayer(
  client: ApiClient,
  serverId: string,
  steamId64: string,
  reason: string,
): Promise<void> {
  await client.request<void>(
    `/api/v1/admin/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(steamId64)}/kick`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export async function banServerPlayer(
  client: ApiClient,
  serverId: string,
  steamId64: string,
  input: {
    reason: string;
    playerName?: string;
    expiresInHours?: number | null;
    scope?: "global" | "server";
  },
): Promise<void> {
  await client.request<void>(
    `/api/v1/admin/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(steamId64)}/ban`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function liftServerBan(client: ApiClient, id: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/server-bans/${encodeURIComponent(id)}/lift`, {
    method: "POST",
  });
}
