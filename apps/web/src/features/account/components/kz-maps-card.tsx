import Link from "next/link";
import { ExternalLink, Map as MapIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { kzMapCdnImageUrl, kzMapImageUrl } from "@/features/servers/data/map-images";
import { ServerMapImage } from "@/features/servers/components/server-map-image";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  fetchKzgoPlayerMaps,
  KZ_MAP_VIEWS,
  KZ_MODES,
  kzgoProfileUrl,
  type KzMapView,
  type KzMode,
  type KzPlayerMaps,
} from "@/services/kzgo";

const KZ_TIERS = [1, 2, 3, 4, 5, 6, 7] as const;

function formatKzTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60_000);
  const wholeSeconds = Math.floor((totalMs % 60_000) / 1000);
  const milliseconds = totalMs % 1000;
  const fraction = String(milliseconds).padStart(3, "0");
  if (minutes > 0) {
    return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${fraction}`;
  }
  return `${wholeSeconds}.${fraction}`;
}

function KzMapThumbnail({ mapName }: { mapName: string }) {
  const imageSrc = kzMapCdnImageUrl(mapName);
  const fallbackSrc = kzMapImageUrl(mapName) ?? "";

  return (
    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border bg-slate-900">
      {imageSrc ? (
        <ServerMapImage src={imageSrc} fallbackSrc={fallbackSrc} alt={`${mapName} 地图预览`} />
      ) : (
        <span className="grid size-full place-items-center text-[10px] text-white/50">KZ</span>
      )}
    </div>
  );
}

export async function KzMapsCard({
  steamId64,
  mode,
  view,
  tier,
  page,
  basePath = "/account",
}: {
  steamId64: string;
  mode: KzMode;
  view: KzMapView;
  tier: number | null;
  page: number;
  basePath?: string;
}) {
  const data = await fetchKzgoPlayerMaps(steamId64, mode, view, page, tier);
  const profileUrl = kzgoProfileUrl(steamId64);
  const modeName = KZ_MODES.find((item) => item.value === mode)?.name ?? "KZTimer";

  if (!data) {
    return (
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="size-4 text-primary" aria-hidden="true" />
              KZ 地图记录
            </CardTitle>
            <CardDescription>暂时无法从 KZ:GO 获取 {modeName} 记录，请稍后刷新。</CardDescription>
          </div>
          <KzSelectors mode={mode} view={view} tier={tier} basePath={basePath} />
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <a href={profileUrl} target="_blank" rel="noopener noreferrer">
              打开 KZ:GO 档案
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <KzMapsCardContent
      data={data}
      profileUrl={profileUrl}
      mode={mode}
      view={view}
      basePath={basePath}
    />
  );
}

function kzHref(
  basePath: string,
  mode: KzMode,
  view: KzMapView,
  tier: number | null,
  page = 1,
): string {
  const query = new URLSearchParams({ kz: mode, view });
  if (tier !== null) {
    query.set("tier", String(tier));
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  return `${basePath}?${query.toString()}`;
}

function KzSelectors({
  mode,
  view,
  tier,
  basePath,
}: {
  mode: KzMode;
  view: KzMapView;
  tier: number | null;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="KZ 模式"
        className="flex w-fit items-center gap-1 rounded-lg border bg-muted/30 p-1"
      >
        {KZ_MODES.map((option) => (
          <Link
            key={option.value}
            href={kzHref(basePath, option.value, view, view === "incomplete" ? tier : null)}
            scroll={false}
            title={option.name}
            aria-current={option.value === mode ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              option.value === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <div
        role="group"
        aria-label="地图完成状态"
        className="flex w-fit items-center gap-1 rounded-lg border bg-muted/30 p-1"
      >
        {KZ_MAP_VIEWS.map((option) => (
          <Link
            key={option.value}
            href={kzHref(basePath, mode, option.value, option.value === "incomplete" ? tier : null)}
            scroll={false}
            aria-current={option.value === view ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              option.value === view
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function KzTierFilter({
  mode,
  tier,
  basePath,
}: {
  mode: KzMode;
  tier: number | null;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] text-muted-foreground">难度</span>
      {[null, ...KZ_TIERS].map((value) => {
        const active = value === tier;
        return (
          <Link
            key={value ?? "all"}
            href={kzHref(basePath, mode, "incomplete", value)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
              active
                ? "border-primary/30 bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {value === null ? "全部" : `T${value}`}
          </Link>
        );
      })}
    </div>
  );
}

function KzMapsCardContent({
  data,
  profileUrl,
  mode,
  view,
  basePath,
}: {
  data: KzPlayerMaps;
  profileUrl: string;
  mode: KzMode;
  view: KzMapView;
  basePath: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="size-4 text-primary" aria-hidden="true" />
              KZ 地图记录
            </CardTitle>
            <CardDescription>
              {view === "incomplete"
                ? data.incompleteTier !== null
                  ? `Tier ${data.incompleteTier} 未完成 ${data.incompleteFilteredCount.toLocaleString("zh-CN")} 张 · 共 ${data.incompleteCount.toLocaleString("zh-CN")} 张未完成`
                  : `未完成 ${data.incompleteCount.toLocaleString("zh-CN")} 张 · 地图库共 ${(data.totalMapLibrary ?? 0).toLocaleString("zh-CN")} 张`
                : `已过 ${data.uniqueMaps.toLocaleString("zh-CN")} 张地图 · 总完成 ${data.totalRuns.toLocaleString("zh-CN")} 次`}
            </CardDescription>
            {data.points !== null || data.rating !== null ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {data.points !== null ? (
                  <span>
                    总分数{" "}
                    <span className="font-mono text-sm font-medium text-foreground">
                      {data.points.toLocaleString("zh-CN")}
                    </span>
                  </span>
                ) : null}
                {data.rating !== null ? (
                  <span>
                    评级{" "}
                    <span className="font-mono text-sm font-medium text-foreground">
                      {data.rating.toFixed(2)}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={profileUrl} target="_blank" rel="noopener noreferrer">
              KZ:GO 档案
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
        <KzSelectors mode={mode} view={view} tier={data.incompleteTier} basePath={basePath} />
      </CardHeader>
      <CardContent className="space-y-3">
        {view === "incomplete" ? (
          <>
            <KzTierFilter mode={mode} tier={data.incompleteTier} basePath={basePath} />
            {data.incompleteMaps.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>未完成地图</span>
                  <span>
                    共 {data.incompleteFilteredCount.toLocaleString("zh-CN")} 张 · 第{" "}
                    {data.incompletePage}/{data.incompletePageCount} 页
                  </span>
                </div>
                <div className="max-h-96 divide-y overflow-y-auto rounded-xl border">
                  {data.incompleteMaps.map((map) => (
                    <div
                      key={map.mapId}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <KzMapThumbnail mapName={map.mapName} />
                        <p className="truncate font-mono text-xs sm:text-sm">{map.mapName}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        Tier {map.difficulty}
                      </Badge>
                    </div>
                  ))}
                </div>
                {data.incompletePageCount > 1 ? (
                  <div className="flex items-center justify-between gap-2">
                    {data.incompletePage > 1 ? (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={kzHref(
                            basePath,
                            mode,
                            view,
                            data.incompleteTier,
                            data.incompletePage - 1,
                          )}
                          scroll={false}
                        >
                          上一页
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        上一页
                      </Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      第 {data.incompletePage} / {data.incompletePageCount} 页
                    </span>
                    {data.incompletePage < data.incompletePageCount ? (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={kzHref(
                            basePath,
                            mode,
                            view,
                            data.incompleteTier,
                            data.incompletePage + 1,
                          )}
                          scroll={false}
                        >
                          下一页
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        下一页
                      </Button>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                {data.incompleteTier !== null
                  ? `Tier ${data.incompleteTier} 没有未完成地图。`
                  : "当前地图库中的地图都已完成。"}
              </p>
            )}
          </>
        ) : data.recentMaps.length > 0 ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>最近完成</span>
              <span>
                PRO {data.proMaps.toLocaleString("zh-CN")} · TP{" "}
                {data.tpMaps.toLocaleString("zh-CN")}
              </span>
            </div>
            <div className="divide-y overflow-hidden rounded-xl border">
              {data.recentMaps.map((map) => (
                <div
                  key={map.mapId}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <KzMapThumbnail mapName={map.mapName} />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs sm:text-sm">{map.mapName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatRelativeTime(map.lastPlayedAt)} ·{" "}
                        {map.points.toLocaleString("zh-CN")} 分
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {map.proTime !== null ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px]">
                        <Badge variant="success" className="h-4 px-1.5 text-[10px]">
                          PRO
                        </Badge>
                        <span className="font-mono">{formatKzTime(map.proTime)}</span>
                      </span>
                    ) : null}
                    {map.tpTime !== null ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px]">
                        <Badge variant="muted" className="h-4 px-1.5 text-[10px]">
                          TP
                        </Badge>
                        <span className="font-mono">{formatKzTime(map.tpTime)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-xl border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            还没有 KZ:GO 地图完成记录。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KzMapsCardSkeleton({
  mode,
  view,
  tier,
  basePath = "/account",
}: {
  mode: KzMode;
  view: KzMapView;
  tier: number | null;
  basePath?: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon className="size-4 text-primary" aria-hidden="true" />
          KZ 地图记录
        </CardTitle>
        <CardDescription>正在从 KZ:GO 读取地图记录…</CardDescription>
        <KzSelectors mode={mode} view={view} tier={tier} basePath={basePath} />
      </CardHeader>
      <CardContent>
        <div className="space-y-px overflow-hidden rounded-xl border bg-border">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 bg-card px-4 py-3">
              <div className="h-12 w-20 shrink-0 animate-pulse rounded-md bg-muted" />
              <div>
                <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
