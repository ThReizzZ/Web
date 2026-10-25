import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CopyAddressButton } from "./copy-address-button";
import { JoinServerButton } from "./join-server-button";
import { PlayerRoster } from "./player-roster";
import { ServerStatusBadge } from "./server-status-badge";
import { getOnlinePlayerCount, getServerAddress, type KzServer } from "../data/servers";

export function ServerCard({
  server,
  compact = false,
  className,
}: {
  server: KzServer;
  compact?: boolean;
  className?: string;
}) {
  const address = getServerAddress(server);
  const playerCount = getOnlinePlayerCount(server);

  return (
    <Card
      data-server-id={server.id}
      className={cn("flex h-full gap-0 overflow-hidden py-0", className)}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        {server.mapImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={server.mapImage}
            alt={`${server.map} 地图预览`}
            className="absolute inset-0 size-full object-cover transition-transform duration-700 hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.35),transparent_55%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <div className="flex flex-wrap gap-2">
            <ServerStatusBadge status={server.status} />
            <Badge variant="secondary" className="bg-white/15 text-white backdrop-blur">
              KZ
            </Badge>
            {server.community ? (
              <Badge
                variant="secondary"
                className="max-w-[12rem] truncate bg-white/15 text-white backdrop-blur"
              >
                {server.community}
              </Badge>
            ) : null}
            {server.requiresWhitelist ? (
              <Badge variant="warning" className="bg-amber-400/20 text-amber-100 backdrop-blur">
                白名单
              </Badge>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className="border-white/25 bg-slate-950/25 text-white backdrop-blur"
          >
            {server.region}
          </Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-white">
          <div className="min-w-0">
            <p className="font-mono text-xs text-white/65">{server.map}</p>
            <h3 className="truncate text-xl font-semibold tracking-tight">{server.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {playerCount}
              <span className="text-sm font-normal text-white/65">/{server.maxPlayers}</span>
            </p>
            <p className="text-[11px] text-white/65">在线玩家</p>
          </div>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {!compact ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{server.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>{server.tickrate} tick</span>
          <span>{server.latencyMs === null ? "延迟未知" : `延迟 ${server.latencyMs} ms`}</span>
          <span>{server.tags.slice(0, compact ? 2 : 3).join(" · ")}</span>
        </div>

        <div className="flex flex-1 flex-col rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">在线玩家</span>
            <span className="text-muted-foreground">
              {playerCount} / {server.maxPlayers}
            </span>
          </div>
          <PlayerRoster players={server.players} variant="card" className="mt-2" />
          {playerCount === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">暂无在线玩家</p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-muted-foreground">
            <span>
              {playerCount < server.maxPlayers
                ? `还有 ${server.maxPlayers - playerCount} 个空位`
                : "服务器已满"}
            </span>
            <span>复制地址加入</span>
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">IP : PORT</p>
            <p className="mt-0.5 font-mono text-xs break-all sm:text-sm">{address}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CopyAddressButton
              address={address}
              label="复制地址"
              size="default"
              className="w-full"
            />
            <JoinServerButton server={server} className="w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
