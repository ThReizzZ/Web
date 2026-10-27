export type ServerStatus = "online" | "maintenance" | "offline" | "hibernating";

export interface KzPlayer {
  name: string;
  avatarUrl?: string | null;
  connectedAt?: string;
}

export interface KzServer {
  id: string;
  name: string;
  map: string;
  description: string;
  /** Optional community/group label used to group instances of one host. */
  community: string;
  status: ServerStatus;
  ip: string;
  port: number;
  region: string;
  tickrate: number;
  maxPlayers: number;
  latencyMs: number | null;
  /** Live player count reported by the ThRei_Players plugin; falls back to the roster length. */
  playerCount?: number | null;
  tags: string[];
  players: KzPlayer[];
  mapImage: string;
  mapImageFallback: string;
  mapTier: number | null;
  estimatedLatencyMs: number | null;
  featured: boolean;
  requiresWhitelist: boolean;
}

export function getServerAddress(server: KzServer): string {
  return `${server.ip}:${server.port}`;
}

export function getOnlinePlayerCount(server: KzServer): number {
  return server.playerCount ?? server.players.length;
}

export function getOnlinePlayerTotal(servers: KzServer[]): number {
  return servers.reduce((total, server) => total + getOnlinePlayerCount(server), 0);
}

export function getMaxPlayerTotal(servers: KzServer[]): number {
  return servers.reduce((total, server) => total + server.maxPlayers, 0);
}

export type ServerSortKey = "default" | "players" | "name" | "latency" | "status";

const STATUS_SORT_ORDER: Record<ServerStatus, number> = {
  online: 0,
  hibernating: 1,
  maintenance: 2,
  offline: 3,
};

function compareNames(left: KzServer, right: KzServer): number {
  return left.name.localeCompare(right.name, "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

/** Returns a new array; "default" keeps the API order (featured first, then name). */
export function sortServers(servers: KzServer[], sort: ServerSortKey): KzServer[] {
  if (sort === "default") {
    return servers;
  }

  const sorted = [...servers];
  switch (sort) {
    case "players":
      sorted.sort(
        (left, right) =>
          getOnlinePlayerCount(right) - getOnlinePlayerCount(left) || compareNames(left, right),
      );
      break;
    case "name":
      sorted.sort(compareNames);
      break;
    case "latency":
      sorted.sort(
        (left, right) =>
          (left.latencyMs ?? Number.POSITIVE_INFINITY) -
            (right.latencyMs ?? Number.POSITIVE_INFINITY) || compareNames(left, right),
      );
      break;
    case "status":
      sorted.sort(
        (left, right) =>
          STATUS_SORT_ORDER[left.status] - STATUS_SORT_ORDER[right.status] ||
          getOnlinePlayerCount(right) - getOnlinePlayerCount(left) ||
          compareNames(left, right),
      );
      break;
  }
  return sorted;
}

export function searchServers(servers: KzServer[], query: string): KzServer[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return servers;
  }

  return servers.filter((server) =>
    [
      server.name,
      server.map,
      server.region,
      server.description,
      ...server.tags,
      ...server.players.map((player) => player.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}
