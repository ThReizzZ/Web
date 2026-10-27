const KZ_TIMER_API = "https://kztimerglobal.com/api/v2.0";
const KZ_TIMER_TIMEOUT_MS = 15_000;
const KZ_TIMER_REVALIDATE_SECONDS = 600;
const KZ_RECORD_LIMIT = 9999;
const KZ_RECENT_MAP_LIMIT = 8;

const STEAM_ID64_OFFSET = 76561197960265728n;

export const KZ_MODES = [
  { value: "kz_timer", label: "KZT", name: "KZTimer", rankModeId: 200 },
  { value: "kz_simple", label: "SKZ", name: "SimpleKZ", rankModeId: 201 },
  { value: "kz_vanilla", label: "VNL", name: "Vanilla", rankModeId: 202 },
] as const;

export type KzMode = (typeof KZ_MODES)[number]["value"];

export function parseKzMode(value: string | string[] | undefined): KzMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  const matched = KZ_MODES.find((mode) => mode.value === candidate);
  return matched?.value ?? "kz_timer";
}

interface KzTimerRecord {
  map_id: number;
  map_name: string;
  time: number;
  created_on: string;
}

interface KzTimerRank {
  finishes: number;
  points: number;
  rating: number;
}

interface MutableMapProgress {
  mapId: number;
  mapName: string;
  proTime: number | null;
  tpTime: number | null;
  lastPlayedTimestamp: number;
}

export interface KzMapProgress {
  mapId: number;
  mapName: string;
  proTime: number | null;
  tpTime: number | null;
  lastPlayedAt: string;
}

export interface KzPlayerMaps {
  uniqueMaps: number;
  proMaps: number;
  tpMaps: number;
  totalRuns: number;
  points: number | null;
  rating: number | null;
  recentMaps: KzMapProgress[];
}

function steamId64ToSteamId2(steamId64: string): string {
  const accountId = BigInt(steamId64) - STEAM_ID64_OFFSET;
  return `STEAM_1:${accountId & 1n}:${accountId >> 1n}`;
}

export function kzgoProfileUrl(steamId64: string): string {
  return `https://kzgo.eu/players/${steamId64ToSteamId2(steamId64)}`;
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

async function fetchKzTimerRecords(
  steamId64: string,
  hasTeleports: boolean,
  mode: KzMode,
): Promise<KzTimerRecord[]> {
  const query = new URLSearchParams({
    steamid64: steamId64,
    modes_list_string: mode,
    stage: "0",
    tickrate: "128",
    has_teleports: String(hasTeleports),
    limit: String(KZ_RECORD_LIMIT),
  });
  const response = await fetch(`${KZ_TIMER_API}/records/top?${query.toString()}`, {
    headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
    next: { revalidate: KZ_TIMER_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(KZ_TIMER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`KZ:GO records request failed with ${response.status}`);
  }
  return (await response.json()) as KzTimerRecord[];
}

async function fetchKzTimerRank(steamId64: string, mode: KzMode): Promise<KzTimerRank | null> {
  const modeId = KZ_MODES.find((item) => item.value === mode)?.rankModeId;
  if (!modeId) {
    return null;
  }
  const query = new URLSearchParams({
    steamid64s: steamId64,
    mode_ids: String(modeId),
  });
  const response = await fetch(`${KZ_TIMER_API}/player_ranks?${query.toString()}`, {
    headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
    next: { revalidate: KZ_TIMER_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(KZ_TIMER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`KZ:GO rank request failed with ${response.status}`);
  }
  const ranks = (await response.json()) as KzTimerRank[];
  return ranks[0] ?? null;
}

function mergeRecords(
  maps: Map<number, MutableMapProgress>,
  records: KzTimerRecord[],
  teleported: boolean,
): void {
  for (const record of records) {
    let item = maps.get(record.map_id);
    if (!item) {
      item = {
        mapId: record.map_id,
        mapName: record.map_name,
        proTime: null,
        tpTime: null,
        lastPlayedTimestamp: 0,
      };
      maps.set(record.map_id, item);
    }

    if (teleported) {
      item.tpTime = item.tpTime === null ? record.time : Math.min(item.tpTime, record.time);
    } else {
      item.proTime = item.proTime === null ? record.time : Math.min(item.proTime, record.time);
    }
    const timestamp = Date.parse(normalizeTimestamp(record.created_on));
    if (timestamp > item.lastPlayedTimestamp) {
      item.lastPlayedTimestamp = timestamp;
    }
  }
}

export async function fetchKzgoPlayerMaps(
  steamId64: string,
  mode: KzMode,
): Promise<KzPlayerMaps | null> {
  if (!/^\d{17}$/.test(steamId64)) {
    return null;
  }

  try {
    const [rankResult, proResult, tpResult] = await Promise.allSettled([
      fetchKzTimerRank(steamId64, mode),
      fetchKzTimerRecords(steamId64, false, mode),
      fetchKzTimerRecords(steamId64, true, mode),
    ]);
    if (proResult.status === "rejected" && tpResult.status === "rejected") {
      return null;
    }

    const rank = rankResult.status === "fulfilled" ? rankResult.value : null;
    const proRecords = proResult.status === "fulfilled" ? proResult.value : [];
    const tpRecords = tpResult.status === "fulfilled" ? tpResult.value : [];

    const maps = new Map<number, MutableMapProgress>();
    mergeRecords(maps, proRecords, false);
    mergeRecords(maps, tpRecords, true);

    const values = [...maps.values()];
    const recentMaps = values
      .sort((left, right) => right.lastPlayedTimestamp - left.lastPlayedTimestamp)
      .slice(0, KZ_RECENT_MAP_LIMIT)
      .map((map) => ({
        mapId: map.mapId,
        mapName: map.mapName,
        proTime: map.proTime,
        tpTime: map.tpTime,
        lastPlayedAt: new Date(map.lastPlayedTimestamp).toISOString(),
      }));

    return {
      uniqueMaps: values.length,
      proMaps: values.filter((map) => map.proTime !== null).length,
      tpMaps: values.filter((map) => map.tpTime !== null).length,
      totalRuns: rank?.finishes ?? proRecords.length + tpRecords.length,
      points: rank?.points ?? null,
      rating: rank?.rating ?? null,
      recentMaps,
    };
  } catch {
    return null;
  }
}
