import type { AccountOverview } from "@/features/account/types";
import type {
  AdminAccount,
  AdminLookupResponse,
  Ban,
  WhitelistOverview,
} from "@/features/admin/types";
import type { AdminOverview } from "@/features/admin/types";
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

export async function fetchBans(client: ApiClient): Promise<Ban[]> {
  return client.get<Ban[]>("/api/v1/admin/bans", noStore);
}

export async function createBan(
  client: ApiClient,
  input: {
    steamId64: string;
    reason: string;
    playerName?: string;
    expiresInHours?: number | null;
  },
): Promise<Ban> {
  return client.request<Ban>("/api/v1/admin/bans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function liftBan(client: ApiClient, id: string, reason?: string): Promise<void> {
  await client.request<void>(`/api/v1/admin/bans/${encodeURIComponent(id)}/lift`, {
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
  input: { serverId: string; steamId64: string; playerName?: string },
): Promise<void> {
  await client.request<void>("/api/v1/admin/whitelist", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeWhitelistEntry(
  client: ApiClient,
  serverId: string,
  steamId64: string,
): Promise<void> {
  await client.request<void>(
    `/api/v1/admin/whitelist/${encodeURIComponent(serverId)}/${encodeURIComponent(steamId64)}`,
    { method: "DELETE" },
  );
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
  input: { serverId: string; message: string },
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
