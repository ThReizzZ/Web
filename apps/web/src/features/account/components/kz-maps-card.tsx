import Link from "next/link";
import { ExternalLink, Map as MapIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export async function KzMapsCard({
  steamId64,
  mode,
  view,
  page,
}: {
  steamId64: string;
  mode: KzMode;
  view: KzMapView;
  page: number;
}) {
  const data = await fetchKzgoPlayerMaps(steamId64, mode, view, page);
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
          <KzSelectors mode={mode} view={view} />
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

  return <KzMapsCardContent data={data} profileUrl={profileUrl} mode={mode} view={view} />;
}

function KzSelectors({ mode, view }: { mode: KzMode; view: KzMapView }) {
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
            href={`/account?kz=${option.value}&view=${view}`}
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
            href={`/account?kz=${mode}&view=${option.value}`}
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

function kzMapPageHref(mode: KzMode, view: KzMapView, page: number): string {
  const query = new URLSearchParams({ kz: mode, view });
  if (page > 1) {
    query.set("page", String(page));
  }
  return `/account?${query.toString()}`;
}

function KzMapsCardContent({
  data,
  profileUrl,
  mode,
  view,
}: {
  data: KzPlayerMaps;
  profileUrl: string;
  mode: KzMode;
  view: KzMapView;
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
                ? `未完成 ${data.incompleteCount.toLocaleString("zh-CN")} 张 · 地图库共 ${(data.totalMapLibrary ?? 0).toLocaleString("zh-CN")} 张`
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
        <KzSelectors mode={mode} view={view} />
      </CardHeader>
      <CardContent className="space-y-3">
        {view === "incomplete" ? (
          data.incompleteMaps.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>未完成地图</span>
                <span>
                  共 {data.incompleteCount.toLocaleString("zh-CN")} 张 · 第 {data.incompletePage}/
                  {data.incompletePageCount} 页
                </span>
              </div>
              <div className="max-h-96 divide-y overflow-y-auto rounded-xl border">
                {data.incompleteMaps.map((map) => (
                  <div
                    key={map.mapId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <p className="truncate font-mono text-xs sm:text-sm">{map.mapName}</p>
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
                        href={kzMapPageHref(mode, view, data.incompletePage - 1)}
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
                        href={kzMapPageHref(mode, view, data.incompletePage + 1)}
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
              当前地图库中的地图都已完成。
            </p>
          )
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
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs sm:text-sm">{map.mapName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelativeTime(map.lastPlayedAt)}
                    </p>
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

export function KzMapsCardSkeleton({ mode, view }: { mode: KzMode; view: KzMapView }) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon className="size-4 text-primary" aria-hidden="true" />
          KZ 地图记录
        </CardTitle>
        <CardDescription>正在从 KZ:GO 读取地图记录…</CardDescription>
        <KzSelectors mode={mode} view={view} />
      </CardHeader>
      <CardContent>
        <div className="space-y-px overflow-hidden rounded-xl border bg-border">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="bg-card px-4 py-3">
              <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
