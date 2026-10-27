import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinServerButton } from "@/features/servers/components/join-server-button";
import { PlayerRoster } from "@/features/servers/components/player-roster";
import { ServerMapImage } from "@/features/servers/components/server-map-image";
import { ServerStatusBadge } from "@/features/servers/components/server-status-badge";
import { getOnlinePlayerCount, type KzServer } from "@/features/servers/data/servers";

export function HomeServerCard({ server }: { server: KzServer }) {
  const playerCount = getOnlinePlayerCount(server);
  const visiblePlayers = server.players.slice(0, 4);
  const hiddenPlayers = Math.max(0, playerCount - visiblePlayers.length);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        <ServerMapImage
          src={server.mapImage}
          fallbackSrc={server.mapImageFallback}
          alt={`${server.map} 地图预览`}
          className="transition-transform duration-700 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <div className="flex flex-wrap gap-2">
            <ServerStatusBadge status={server.status} />
            {server.mapTier !== null ? (
              <Badge variant="secondary" className="bg-white/15 text-white backdrop-blur">
                Tier {server.mapTier}
              </Badge>
            ) : null}
            {server.requiresWhitelist ? (
              <Badge variant="warning" className="bg-amber-400/20 text-amber-100 backdrop-blur">
                白名单
              </Badge>
            ) : null}
          </div>
          <span className="rounded-full border border-white/15 bg-slate-950/30 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur">
            KZ
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-white/60">{server.map}</p>
            <h3 className="mt-1 truncate text-xl font-semibold tracking-tight">{server.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {playerCount}
              <span className="text-sm font-normal text-white/50">/{server.maxPlayers}</span>
            </p>
            <p className="text-[10px] text-white/55">在线玩家</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {playerCount} / {server.maxPlayers} 在线
          </span>
          <span title="根据你的登录 IP 与服务器位置估算">
            {server.estimatedLatencyMs !== null
              ? `预估 ${server.estimatedLatencyMs} ms`
              : "延迟未知"}
          </span>
        </div>

        <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground">
          {server.description ||
            `${server.region && server.region !== "未知" ? server.region : "KZ"} · ${server.tickrate} tick`}
        </p>

        <div className="flex min-h-7 flex-wrap items-center gap-1.5">
          {visiblePlayers.length > 0 ? (
            <>
              <PlayerRoster players={visiblePlayers} variant="list" />
              {hiddenPlayers > 0 ? (
                <span className="text-[11px] text-muted-foreground">+{hiddenPlayers}</span>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {playerCount > 0 ? `${playerCount} 位玩家在线` : "暂无在线玩家"}
            </span>
          )}
        </div>

        <div className="mt-auto flex gap-2">
          <JoinServerButton server={server} size="sm" className="flex-1" />
          <Button asChild variant="outline" size="sm">
            <Link href={`/servers#server-${server.id}`}>
              查看
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
