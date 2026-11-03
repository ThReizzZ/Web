const KZ_API_BASE = (process.env.KZ_API_URL ?? "https://api.threi.cn").replace(/\/+$/, "");
const KZ_API_TIMEOUT_MS = 5_000;
const KZ_MAP_LIBRARY_TIMEOUT_MS = 2_500;
const KZ_API_REVALIDATE_SECONDS = 600;
const KZ_MAP_REVALIDATE_SECONDS = 3600;
// When the KZ API itself is unreachable, fail fast for a while instead of
// making every visitor wait for a full request timeout.
const KZ_API_BACKOFF_MS = 60_000;
const KZ_PAGE_SIZE = 200;
const KZ_PAGE_LIMIT = 40;
const KZ_RECENT_MAP_LIMIT = 8;
const KZ_INCOMPLETE_PAGE_SIZE = 30;

// Static fallback for server cards: if api.threi.cn is unreachable, keep
// showing tiers from the download-site snapshot.
const MAP_TIERS_URL = process.env.MAP_TIERS_URL ?? "https://files.threi.cn/csgo/map-tiers-v1.json";
const MAP_TIERS_TIMEOUT_MS = 2_000;
const MAP_TIERS_RETRY_MS = 60_000;

export const KZ_MODES = [
  { value: "kz_timer", label: "KZT", name: "KZTimer" },
  { value: "kz_simple", label: "SKZ", name: "SimpleKZ" },
  { value: "kz_vanilla", label: "VNL", name: "Vanilla" },
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

interface KzApiMap {
  id: string;
  name: string;
  tier: number | null;
  validated: boolean;
}

interface KzApiMapList {
  total: number;
  items: KzApiMap[];
}

interface KzApiPb {
  map_name: string;
  course: number;
  mode: number;
  time_type: string;
  time_ms: number;
  points: number;
  updated_at: string;
  played_at: string;
}

interface KzApiPbList {
  total: number;
  items: KzApiPb[];
}

interface KzApiRankInfo {
  name: string;
}

interface KzApiModeTotals {
  mode: number;
  points: number;
  records: number;
  rankInfo: KzApiRankInfo;
}

interface KzApiPlayerRank {
  rankInfo: KzApiRankInfo;
  modes: KzApiModeTotals[];
}

interface KzApiRanks {
  players: KzApiPlayerRank[];
}

interface PlayerRankSummary {
  totals: KzApiModeTotals | null;
  rankName: string | null;
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
  difficulty: number | null;
}

export interface KzMapInfo {
  name: string;
  difficulty: number | null;
}

export interface KzPlayerMaps {
  uniqueMaps: number;
  proMaps: number;
  tpMaps: number;
  totalRuns: number;
  points: number | null;
  rankName: string | null;
  recentMaps: KzMapProgress[];
  incompleteMaps: KzIncompleteMap[];
  incompleteCount: number;
  incompleteFilteredCount: number;
  incompleteTier: number | null;
  incompletePage: number;
  incompletePageCount: number;
  totalMapLibrary: number | null;
}

function modeToApiMode(mode: KzMode): number {
  return mode === "kz_timer" ? 2 : mode === "kz_simple" ? 1 : 0;
}

function mapIdFromName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizeTimestamp(value: string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  const parsed = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

let kzApiRetryAt = 0;

async function fetchKzApi<T>(
  path: string,
  timeoutMs: number,
  revalidateSeconds: number,
): Promise<T> {
  if (kzApiRetryAt > Date.now()) {
    throw new Error("KZ API is temporarily unavailable");
  }

  let response: Response;
  try {
    response = await fetch(`${KZ_API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ThRei/0.1 (+https://threi.cn)",
      },
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    kzApiRetryAt = Date.now() + KZ_API_BACKOFF_MS;
    throw error;
  }

  if (response.status >= 500 || response.status === 429) {
    kzApiRetryAt = Date.now() + KZ_API_BACKOFF_MS;
  }
  if (!response.ok) {
    throw new Error(`KZ API request failed with ${response.status}`);
  }
  kzApiRetryAt = 0;
  return (await response.json()) as T;
}

interface MapLibraryCache {
  value: KzApiMap[];
  expiresAt: number;
}

let mapLibraryCache: MapLibraryCache | null = null;
let mapLibraryRequest: Promise<KzApiMap[]> | null = null;

async function fetchKzMapLibrary(): Promise<KzApiMap[]> {
  const now = Date.now();
  if (mapLibraryCache && mapLibraryCache.expiresAt > now) {
    return mapLibraryCache.value;
  }
  if (!mapLibraryRequest) {
    mapLibraryRequest = (async () => {
      const first = await fetchKzApi<KzApiMapList>(
        `/api/v1/maps?validated=true&limit=${KZ_PAGE_SIZE}&offset=0`,
        KZ_MAP_LIBRARY_TIMEOUT_MS,
        KZ_MAP_REVALIDATE_SECONDS,
      );
      const total = Number.isFinite(first.total) ? first.total : first.items.length;
      const pageCount = Math.min(KZ_PAGE_LIMIT, Math.max(1, Math.ceil(total / KZ_PAGE_SIZE)));
      const rest = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) =>
          fetchKzApi<KzApiMapList>(
            `/api/v1/maps?validated=true&limit=${KZ_PAGE_SIZE}&offset=${(index + 1) * KZ_PAGE_SIZE}`,
            KZ_MAP_LIBRARY_TIMEOUT_MS,
            KZ_MAP_REVALIDATE_SECONDS,
          ),
        ),
      );
      const value = [first, ...rest].flatMap((page) => page.items);
      mapLibraryCache = {
        value,
        expiresAt: Date.now() + KZ_MAP_REVALIDATE_SECONDS * 1000,
      };
      return value;
    })().finally(() => {
      mapLibraryRequest = null;
    });
  }
  return mapLibraryRequest;
}

interface MapInfoCache {
  value: Map<string, KzMapInfo>;
  expiresAt: number;
}

let mapInfoCache: MapInfoCache | null = null;
let mapInfoRetryAt = 0;
let mapInfoRequest: Promise<Map<string, KzMapInfo>> | null = null;

async function fetchMapTierFile(): Promise<Map<string, KzMapInfo>> {
  const response = await fetch(MAP_TIERS_URL, {
    headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
    next: { revalidate: KZ_MAP_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(MAP_TIERS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Map tier index request failed with ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const tiers = new Map<string, KzMapInfo>();
  for (const [name, tier] of Object.entries(data)) {
    if (typeof tier === "number" && Number.isInteger(tier)) {
      tiers.set(name, { name, difficulty: tier });
    }
  }
  return tiers;
}

export async function fetchKzTimerMapInfo(): Promise<Map<string, KzMapInfo>> {
  const now = Date.now();
  if (mapInfoCache && mapInfoCache.expiresAt > now) {
    return mapInfoCache.value;
  }
  if (mapInfoRetryAt > now) {
    return mapInfoCache?.value ?? new Map();
  }
  if (!mapInfoRequest) {
    mapInfoRequest = (async () => {
      try {
        const maps = await fetchKzMapLibrary();
        return new Map(
          maps.map((map) => [
            map.name.trim().toLowerCase(),
            { name: map.name, difficulty: map.tier },
          ]),
        );
      } catch {
        return fetchMapTierFile();
      }
    })()
      .then((value) => {
        mapInfoCache = {
          value,
          expiresAt: Date.now() + KZ_MAP_REVALIDATE_SECONDS * 1000,
        };
        mapInfoRetryAt = 0;
        return value;
      })
      .catch((error: unknown) => {
        mapInfoRetryAt = Date.now() + MAP_TIERS_RETRY_MS;
        if (mapInfoCache) {
          // Prefer stale tiers over failing the whole page.
          return mapInfoCache.value;
        }
        throw error;
      })
      .finally(() => {
        mapInfoRequest = null;
      });
  }
  return mapInfoRequest;
}

async function fetchPlayerPbs(steamId64: string, mode: KzMode): Promise<KzApiPb[]> {
  const modeId = modeToApiMode(mode);
  const base = `/api/v1/players/${encodeURIComponent(steamId64)}/pbs?mode=${modeId}&limit=${KZ_PAGE_SIZE}`;
  const first = await fetchKzApi<KzApiPbList>(
    `${base}&offset=0`,
    KZ_API_TIMEOUT_MS,
    KZ_API_REVALIDATE_SECONDS,
  );
  const total = Number.isFinite(first.total) ? first.total : first.items.length;
  const pageCount = Math.min(KZ_PAGE_LIMIT, Math.max(1, Math.ceil(total / KZ_PAGE_SIZE)));
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchKzApi<KzApiPbList>(
        `${base}&offset=${(index + 1) * KZ_PAGE_SIZE}`,
        KZ_API_TIMEOUT_MS,
        KZ_API_REVALIDATE_SECONDS,
      ),
    ),
  );
  return [first, ...rest].flatMap((page) => page.items);
}

async function fetchPlayerRank(steamId64: string, mode: KzMode): Promise<PlayerRankSummary | null> {
  try {
    const data = await fetchKzApi<KzApiRanks>(
      `/api/v1/game/ranks?steamids=${encodeURIComponent(steamId64)}`,
      KZ_API_TIMEOUT_MS,
      KZ_API_REVALIDATE_SECONDS,
    );
    const player = data.players?.[0];
    const totals = player?.modes?.find((item) => item.mode === modeToApiMode(mode)) ?? null;
    return {
      totals,
      rankName: totals?.rankInfo?.name ?? player?.rankInfo?.name ?? null,
    };
  } catch {
    return null;
  }
}

export function kzgoProfileUrl(steamId64: string): string {
  return `https://kz.threi.cn/players/${encodeURIComponent(steamId64)}`;
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
    const [pbsResult, rankResult, libraryResult] = await Promise.allSettled([
      fetchPlayerPbs(steamId64, mode),
      fetchPlayerRank(steamId64, mode),
      fetchKzMapLibrary(),
    ]);

    if (pbsResult.status === "rejected") {
      return null;
    }
    if (view === "incomplete" && libraryResult.status === "rejected") {
      return null;
    }

    const pbs = pbsResult.value.filter((pb) => Number(pb.course) === 0);
    const rank = rankResult.status === "fulfilled" ? rankResult.value : null;
    const library = libraryResult.status === "fulfilled" ? libraryResult.value : [];
    const idByName = new Map(library.map((map) => [map.name.trim().toLowerCase(), Number(map.id)]));

    const maps = new Map<string, MutableMapProgress>();
    for (const pb of pbs) {
      const mapName = pb.map_name?.trim();
      if (!mapName) {
        continue;
      }
      const key = mapName.toLowerCase();
      let item = maps.get(key);
      if (!item) {
        item = {
          mapId: idByName.get(key) ?? mapIdFromName(mapName),
          mapName,
          proTime: null,
          tpTime: null,
          points: 0,
          lastPlayedTimestamp: 0,
        };
        maps.set(key, item);
      }

      const time = Number(pb.time_ms) / 1000;
      if (Number.isFinite(time)) {
        if (String(pb.time_type).toLowerCase() === "tp") {
          item.tpTime = item.tpTime === null ? time : Math.min(item.tpTime, time);
        } else {
          item.proTime = item.proTime === null ? time : Math.min(item.proTime, time);
        }
      }
      item.points = Math.max(item.points, Number(pb.points) || 0);

      const timestamp = Date.parse(normalizeTimestamp(pb.updated_at || pb.played_at));
      if (Number.isFinite(timestamp) && timestamp > item.lastPlayedTimestamp) {
        item.lastPlayedTimestamp = timestamp;
      }
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
        lastPlayedAt: new Date(map.lastPlayedTimestamp || 0).toISOString(),
      }));

    let incompleteMaps: KzIncompleteMap[] = [];
    let incompleteCount = 0;
    let incompleteFilteredCount = 0;
    let incompleteTier: number | null = null;
    let incompletePage = 1;
    let incompletePageCount = 1;
    let totalMapLibrary: number | null = null;

    if (view === "incomplete") {
      const completed = new Set(maps.keys());
      const allIncomplete = library
        .filter((map) => !completed.has(map.name.trim().toLowerCase()))
        .sort(
          (left, right) =>
            (left.tier ?? 99) - (right.tier ?? 99) ||
            left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
        );
      incompleteTier = tier;
      incompleteCount = allIncomplete.length;
      totalMapLibrary = library.length;

      const filtered =
        tier === null ? allIncomplete : allIncomplete.filter((map) => map.tier === tier);
      incompleteFilteredCount = filtered.length;
      incompletePageCount = Math.max(1, Math.ceil(filtered.length / KZ_INCOMPLETE_PAGE_SIZE));
      incompletePage = Math.min(Math.max(page, 1), incompletePageCount);
      const start = (incompletePage - 1) * KZ_INCOMPLETE_PAGE_SIZE;
      incompleteMaps = filtered.slice(start, start + KZ_INCOMPLETE_PAGE_SIZE).map((map) => ({
        mapId: Number(map.id),
        mapName: map.name,
        difficulty: map.tier,
      }));
    }

    return {
      uniqueMaps: values.length,
      proMaps: values.filter((map) => map.proTime !== null).length,
      tpMaps: values.filter((map) => map.tpTime !== null).length,
      totalRuns: rank?.totals ? Number(rank.totals.records) : pbs.length,
      points: rank?.totals ? Number(rank.totals.points) : null,
      rankName: rank?.rankName ?? null,
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
