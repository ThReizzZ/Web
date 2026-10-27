const KZ_TIMER_API = "https://kztimerglobal.com/api/v2.0";
const KZ_TIMER_TIMEOUT_MS = 15_000;
const KZ_TIMER_REVALIDATE_SECONDS = 600;
const KZ_MAP_REVALIDATE_SECONDS = 3600;
const KZ_RECORD_LIMIT = 9999;
const KZ_MAP_LIMIT = 9999;
const KZ_RECENT_MAP_LIMIT = 8;
const KZ_INCOMPLETE_PAGE_SIZE = 30;

const STEAM_ID64_OFFSET = 76561197960265728n;

export const KZ_MODES = [
  { value: "kz_timer", label: "KZT", name: "KZTimer", rankModeId: 200 },
  { value: "kz_simple", label: "SKZ", name: "SimpleKZ", rankModeId: 201 },
  { value: "kz_vanilla", label: "VNL", name: "Vanilla", rankModeId: 202 },
] as const;

export type KzMode = (typeof KZ_MODES)[number]["value"];

export const KZ_MAP_VIEWS = [
  { value: "completed", label: "已完成地图" },
  { value: "incomplete", label: "未完成地图" },
] as const;

export type KzMapView = (typeof KZ_MAP_VIEWS)[number]["value"];

export function parseKzMode(value: string | string[] | undefined): KzMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  const matched = KZ_MODES.find((mode) => mode.value === candidate);
  return matched?.value ?? "kz_timer";
}

export function parseKzMapView(value: string | string[] | undefined): KzMapView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "incomplete" ? "incomplete" : "completed";
}

export function parseKzPage(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(candidate ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseKzTier(value: string | string[] | undefined): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const tier = Number.parseInt(candidate ?? "", 10);
  return Number.isInteger(tier) && tier >= 1 && tier <= 7 ? tier : null;
}

interface KzTimerRecord {
  map_id: number;
  map_name: string;
  time: number;
  points: number;
  created_on: string;
}

interface KzTimerRank {
  finishes: number;
  points: number;
  rating: number;
}

interface KzTimerMap {
  id: number;
  name: string;
  difficulty: number;
}

interface KzTimerRecordFilter {
  map_id: number;
  mode_id: number;
}

interface MutableMapProgress {
  mapId: number;
  mapName: string;
  proTime: number | null;
  tpTime: number | null;
  points: number;
  lastPlayedTimestamp: number;
}

export interface KzMapProgress {
  mapId: number;
  mapName: string;
  proTime: number | null;
  tpTime: number | null;
  points: number;
  lastPlayedAt: string;
}

export interface KzIncompleteMap {
  mapId: number;
  mapName: string;
  difficulty: number;
}

export interface KzMapInfo {
  name: string;
  difficulty: number;
}

export function kzMapImageUrl(mapName: string): string | null {
  const normalized = mapName.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    return null;
  }
  return `/map-images/${encodeURIComponent(normalized)}`;
}

export function kzMapCdnImageUrl(mapName: string): string | null {
  const normalized = mapName.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    return null;
  }
  return `https://cdn.threi.cn/csgo/map-images-v1/${encodeURIComponent(normalized)}.jpg`;
}

export async function fetchKzTimerMapInfo(): Promise<Map<string, KzMapInfo>> {
  const maps = await fetchKzTimerMaps();
  return new Map(
    maps.map((map) => [
      map.name.trim().toLowerCase(),
      { name: map.name, difficulty: map.difficulty },
    ]),
  );
}

export interface KzPlayerMaps {
  uniqueMaps: number;
  proMaps: number;
  tpMaps: number;
  totalRuns: number;
  points: number | null;
  rating: number | null;
  recentMaps: KzMapProgress[];
  incompleteMaps: KzIncompleteMap[];
  incompleteCount: number;
  incompleteFilteredCount: number;
  incompleteTier: number | null;
  incompletePage: number;
  incompletePageCount: number;
  totalMapLibrary: number | null;
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

async function fetchKzTimerMaps(): Promise<KzTimerMap[]> {
  const query = new URLSearchParams({
    is_validated: "true",
    limit: String(KZ_MAP_LIMIT),
  });
  const response = await fetch(`${KZ_TIMER_API}/maps?${query.toString()}`, {
    headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
    next: { revalidate: KZ_MAP_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(KZ_TIMER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`KZ:GO map library request failed with ${response.status}`);
  }
  return (await response.json()) as KzTimerMap[];
}

async function fetchKzTimerRecordFilters(mode: KzMode): Promise<KzTimerRecordFilter[]> {
  const modeId = KZ_MODES.find((item) => item.value === mode)?.rankModeId;
  if (!modeId) {
    return [];
  }
  const query = new URLSearchParams({
    mode_ids: String(modeId),
    limit: String(KZ_MAP_LIMIT),
  });
  const response = await fetch(`${KZ_TIMER_API}/record_filters?${query.toString()}`, {
    headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
    next: { revalidate: KZ_MAP_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(KZ_TIMER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`KZ:GO record filter request failed with ${response.status}`);
  }
  return (await response.json()) as KzTimerRecordFilter[];
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
        points: 0,
        lastPlayedTimestamp: 0,
      };
      maps.set(record.map_id, item);
    }

    if (teleported) {
      item.tpTime = item.tpTime === null ? record.time : Math.min(item.tpTime, record.time);
    } else {
      item.proTime = item.proTime === null ? record.time : Math.min(item.proTime, record.time);
    }
    item.points = Math.max(item.points, record.points);
    const timestamp = Date.parse(normalizeTimestamp(record.created_on));
    if (timestamp > item.lastPlayedTimestamp) {
      item.lastPlayedTimestamp = timestamp;
    }
  }
}

export async function fetchKzgoPlayerMaps(
  steamId64: string,
  mode: KzMode,
  view: KzMapView,
  page: number,
  tier: number | null,
): Promise<KzPlayerMaps | null> {
  if (!/^\d{17}$/.test(steamId64)) {
    return null;
  }

  try {
    const [rankResult, proResult, tpResult, mapResult, filterResult] = await Promise.allSettled([
      fetchKzTimerRank(steamId64, mode),
      fetchKzTimerRecords(steamId64, false, mode),
      fetchKzTimerRecords(steamId64, true, mode),
      view === "incomplete" ? fetchKzTimerMaps() : Promise.resolve(null),
      view === "incomplete" ? fetchKzTimerRecordFilters(mode) : Promise.resolve(null),
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

    let incompleteMaps: KzIncompleteMap[] = [];
    let incompleteCount = 0;
    let incompleteFilteredCount = 0;
    let incompleteTier: number | null = null;
    let incompletePage = 1;
    let incompletePageCount = 1;
    let totalMapLibrary: number | null = null;
    if (view === "incomplete") {
      if (
        mapResult.status !== "fulfilled" ||
        mapResult.value === null ||
        filterResult.status !== "fulfilled" ||
        filterResult.value === null
      ) {
        return null;
      }
      incompleteTier = tier;
      const modeMapIds = new Set(
        filterResult.value.map((filter) => filter.map_id).filter((mapId) => mapId > 0),
      );
      const library = mapResult.value.filter((map) => modeMapIds.has(map.id));
      const completedIds = new Set(maps.keys());
      const allIncomplete = library
        .filter((map) => !completedIds.has(map.id))
        .sort(
          (left, right) =>
            left.difficulty - right.difficulty ||
            left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
        )
        .map((map) => ({
          mapId: map.id,
          mapName: map.name,
          difficulty: map.difficulty,
        }));
      incompleteCount = allIncomplete.length;
      const filtered =
        incompleteTier === null
          ? allIncomplete
          : allIncomplete.filter((map) => map.difficulty === incompleteTier);
      incompleteFilteredCount = filtered.length;
      incompletePageCount = Math.max(
        1,
        Math.ceil(incompleteFilteredCount / KZ_INCOMPLETE_PAGE_SIZE),
      );
      incompletePage = Math.min(Math.max(page, 1), incompletePageCount);
      const start = (incompletePage - 1) * KZ_INCOMPLETE_PAGE_SIZE;
      incompleteMaps = filtered.slice(start, start + KZ_INCOMPLETE_PAGE_SIZE);
      totalMapLibrary = library.length;
    }

    const values = [...maps.values()];
    const recentMaps = values
      .sort((left, right) => right.lastPlayedTimestamp - left.lastPlayedTimestamp)
      .slice(0, KZ_RECENT_MAP_LIMIT)
      .map((map) => ({
        mapId: map.mapId,
        mapName: map.mapName,
        proTime: map.proTime,
        tpTime: map.tpTime,
        points: map.points,
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
      incompleteMaps,
      incompleteCount,
      incompleteFilteredCount,
      incompleteTier,
      incompletePage,
      incompletePageCount,
      totalMapLibrary,
    };
  } catch {
    return null;
  }
}
