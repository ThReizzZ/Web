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
            已过 {data.uniqueMaps.toLocaleString("zh-CN")} 张地图 · 总完成{" "}
            {data.totalRuns.toLocaleString("zh-CN")} 次
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            KZ:GO 档案
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.recentMaps.length > 0 ? (
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
