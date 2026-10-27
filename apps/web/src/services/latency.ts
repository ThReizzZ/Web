import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { KzServer } from "@/features/servers/data/servers";

const GEOLOCATION_REVALIDATE_SECONDS = 86_400;
const GEOLOCATION_TIMEOUT_MS = 3_500;

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface IpWhoResponse {
  success: boolean;
  latitude?: number;
  longitude?: number;
}

const geoCache = new Map<string, GeoPoint>();

type HeaderReader = { get(name: string): string | null };

function isPublicIp(value: string): boolean {
  const ip = value.trim();
  if (!isIP(ip)) {
    return false;
  }
  return !(
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:")
  );
}

export function clientIpFromHeaders(headers: HeaderReader): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isPublicIp(realIp)) {
    return realIp;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) {
    return null;
  }
  const candidates = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(isPublicIp);
  return candidates.at(-1) ?? null;
}

async function geolocate(ip: string): Promise<GeoPoint | null> {
  const cached = geoCache.get(ip);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
      next: { revalidate: GEOLOCATION_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(GEOLOCATION_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as IpWhoResponse;
    if (!data.success || typeof data.latitude !== "number" || typeof data.longitude !== "number") {
      return null;
    }
    const point = { latitude: data.latitude, longitude: data.longitude };
    geoCache.set(ip, point);
    return point;
  } catch {
    return null;
  }
}

async function resolveHost(host: string): Promise<string | null> {
  const trimmed = host.trim();
  if (!trimmed) {
    return null;
  }
  if (isIP(trimmed)) {
    return trimmed;
  }
  try {
    const result = await lookup(trimmed, { family: 4 });
    return result.address;
  } catch {
    return null;
  }
}

function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function estimateLatency(from: GeoPoint, to: GeoPoint): number {
  // IP geolocation can only give a rough estimate. Keep the value
  // deliberately coarse and round it to 5 ms.
  const distance = distanceKm(from, to);
  const raw = 8 + distance / 80;
  return Math.min(300, Math.max(5, Math.round(raw / 5) * 5));
}

export async function applyEstimatedLatencies(
  servers: KzServer[],
  clientIp: string | null,
): Promise<KzServer[]> {
  if (!clientIp || !isPublicIp(clientIp)) {
    return servers;
  }

  const clientPoint = await geolocate(clientIp);
  if (!clientPoint) {
    return servers;
  }

  const uniqueHosts = [...new Set(servers.map((server) => server.ip).filter(Boolean))];
  const hostPoints = new Map<string, GeoPoint | null>();
  await Promise.all(
    uniqueHosts.map(async (host) => {
      const resolved = await resolveHost(host);
      hostPoints.set(host, resolved ? await geolocate(resolved) : null);
    }),
  );

  return servers.map((server) => {
    const point = hostPoints.get(server.ip);
    return {
      ...server,
      estimatedLatencyMs: point ? estimateLatency(clientPoint, point) : null,
    };
  });
}
