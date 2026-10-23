export type ServerStatus = "online" | "maintenance" | "offline";

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
  status: ServerStatus;
  ip: string;
  port: number;
  region: string;
  tickrate: number;
  maxPlayers: number;
  latencyMs: number | null;
  tags: string[];
  players: KzPlayer[];
  mapImage: string;
  featured: boolean;
  requiresWhitelist: boolean;
}

export function getServerAddress(server: KzServer): string {
  return `${server.ip}:${server.port}`;
}

export function getOnlinePlayerTotal(servers: KzServer[]): number {
  return servers.reduce((total, server) => total + server.players.length, 0);
}

export function getMaxPlayerTotal(servers: KzServer[]): number {
  return servers.reduce((total, server) => total + server.maxPlayers, 0);
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
