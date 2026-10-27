import { kzMapCdnImageUrl, kzMapImageUrl } from "./map-images";

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

/** Shape returned by `GET /api/v1/servers`; map presentation fields are added by the web app. */
export type LiveServerPayload = Omit<
  KzServer,
  "mapImageFallback" | "mapTier" | "estimatedLatencyMs"
>;

function toKzServer(server: LiveServerPayload): KzServer {
  const proxyImage = kzMapImageUrl(server.map);
  const cdnImage = kzMapCdnImageUrl(server.map);
  return {
    ...server,
    mapImage: server.mapImage || cdnImage || proxyImage || "",
    mapImageFallback: proxyImage || "",
    mapTier: null,
    estimatedLatencyMs: null,
  };
}

/**
 * Merges the live roster/status payload into the initial enriched server list.
 * Static presentation fields (estimated latency, KZ tier) stay from the server
 * render; map-derived fields are refreshed when the active map changes.
 */
export function mergeLiveServers(current: KzServer[], live: LiveServerPayload[]): KzServer[] {
  const currentById = new Map(current.map((server) => [server.id, server]));

  return live.map((server) => {
    const existing = currentById.get(server.id);
    if (!existing) {
      return toKzServer(server);
    }

    const mapChanged = server.map !== existing.map;
    const proxyImage = kzMapImageUrl(server.map);
    const cdnImage = kzMapCdnImageUrl(server.map);
    return {
      ...existing,
      name: server.name,
      map: server.map,
      description: server.description,
      community: server.community,
      status: server.status,
      ip: server.ip,
      port: server.port,
      region: server.region,
      tickrate: server.tickrate,
      maxPlayers: server.maxPlayers,
      latencyMs: server.latencyMs,
      tags: server.tags,
      mapImage: mapChanged
        ? cdnImage || proxyImage || server.mapImage || existing.mapImage
        : existing.mapImage,
      mapImageFallback: mapChanged
        ? proxyImage || existing.mapImageFallback
        : existing.mapImageFallback,
      mapTier: mapChanged ? null : existing.mapTier,
      estimatedLatencyMs: server.ip === existing.ip ? existing.estimatedLatencyMs : null,
      featured: server.featured,
      requiresWhitelist: server.requiresWhitelist,
      playerCount: server.playerCount,
      players: server.players,
    };
  });
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
