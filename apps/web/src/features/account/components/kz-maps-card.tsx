import { ExternalLink, Map as MapIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { fetchKzgoPlayerMaps, kzgoProfileUrl, type KzPlayerMaps } from "@/services/kzgo";

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

export async function KzMapsCard({ steamId64 }: { steamId64: string }) {
  const data = await fetchKzgoPlayerMaps(steamId64);
  const profileUrl = kzgoProfileUrl(steamId64);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="size-4 text-primary" aria-hidden="true" />
            KZ 地图记录
          </CardTitle>
          <CardDescription>暂时无法从 KZ:GO 获取地图记录，请稍后刷新。</CardDescription>
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

  return <KzMapsCardContent data={data} profileUrl={profileUrl} />;
}

function KzMapsCardContent({ data, profileUrl }: { data: KzPlayerMaps; profileUrl: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="size-4 text-primary" aria-hidden="true" />
            KZ 地图记录
          </CardTitle>
          <CardDescription>
            已在 KZ:GO 记录 {data.uniqueMaps.toLocaleString("zh-CN")} 张地图
            {data.points !== null ? ` · ${data.points.toLocaleString("zh-CN")} 分` : ""}
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            KZ:GO 档案
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KzStat label="已过地图" value={data.uniqueMaps} />
          <KzStat label="PRO 完成" value={data.proMaps} />
          <KzStat label="TP 完成" value={data.tpMaps} />
          <KzStat label="总完成次数" value={data.totalRuns} />
        </div>

        {data.recentMaps.length > 0 ? (
          <div className="overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span>最近完成的地图</span>
              <span>最佳时间</span>
            </div>
            <div className="divide-y">
              {data.recentMaps.map((map) => (
                <div
                  key={map.mapId}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs sm:text-sm">{map.mapName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelativeTime(map.lastPlayedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {map.proTime !== null ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="success" className="h-4 px-1.5 text-[10px]">
                          PRO
                        </Badge>
                        <span className="font-mono text-[11px]">{formatKzTime(map.proTime)}</span>
                      </div>
                    ) : null}
                    {map.tpTime !== null ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="muted" className="h-4 px-1.5 text-[10px]">
                          TP
                        </Badge>
                        <span className="font-mono text-[11px]">{formatKzTime(map.tpTime)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            还没有 KZ:GO 地图完成记录。
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            显示最近 {data.recentMaps.length} 张，共 {data.uniqueMaps.toLocaleString("zh-CN")}{" "}
            张地图。
          </span>
          {data.rating !== null ? (
            <span>
              全球评级 <span className="font-mono text-foreground">{data.rating.toFixed(2)}</span>
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function KzStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value.toLocaleString("zh-CN")}</p>
    </div>
  );
}

export function KzMapsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon className="size-4 text-primary" aria-hidden="true" />
          KZ 地图记录
        </CardTitle>
        <CardDescription>正在从 KZ:GO 读取地图记录…</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-xl border bg-muted/20 px-3 py-2.5">
              <div className="h-3 w-14 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-5 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-xl border bg-muted/20" />
      </CardContent>
    </Card>
  );
}
