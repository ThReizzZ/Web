import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CopyAddressButton } from "./copy-address-button";
import { JoinServerButton } from "./join-server-button";
import { PlayerAvatar } from "./player-avatar";
import { ServerStatusBadge } from "./server-status-badge";
import { getServerAddress, type GameServer } from "../data/servers";

export function ServerCard({
  server,
  compact = false,
  className,
}: {
  server: GameServer;
  compact?: boolean;
  className?: string;
}) {
  const address = getServerAddress(server);
  const visiblePlayers = server.players.slice(0, compact ? 4 : 6);
  const remainingPlayers = server.playerCount - visiblePlayers.length;

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className="relative aspect-[16/7] overflow-hidden">
        <Image
          src={server.mapImage}
          alt={`${server.map} 地图预览`}
          fill
          sizes={
            compact
              ? "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              : "(min-width: 1280px) 50vw, 100vw"
          }
          className="object-cover transition-transform duration-700 hover:scale-[1.03]"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <div className="flex flex-wrap gap-2">
            <ServerStatusBadge status={server.status} />
            <Badge variant="secondary" className="bg-white/15 text-white backdrop-blur">
              {server.mode}
            </Badge>
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
            <p className="text-xs text-white/65">{server.map}</p>
            <h3 className="truncate text-xl font-semibold tracking-tight">{server.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {server.playerCount}
              <span className="text-sm font-normal text-white/65">/{server.maxPlayers}</span>
            </p>
            <p className="text-[11px] text-white/65">在线玩家</p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-5">
        {!compact ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{server.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>版本 {server.version}</span>
          <span>延迟 {server.latencyMs} ms</span>
          <span>{server.tags.slice(0, compact ? 2 : 3).join(" · ")}</span>
        </div>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">在线玩家</span>
            <span className="text-muted-foreground">
              显示 {visiblePlayers.length} / {server.playerCount}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            {visiblePlayers.map((player) => (
              <span key={player.name} className="inline-flex items-center gap-1.5 text-xs">
                <PlayerAvatar player={player} size="xs" />
                <span>{player.name}</span>
              </span>
            ))}
            {remainingPlayers > 0 ? (
              <span className="text-xs text-muted-foreground">+{remainingPlayers} 位玩家在线</span>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-3">
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">IP : PORT</p>
          <p className="mt-0.5 font-mono text-xs break-all sm:text-sm">{address}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <CopyAddressButton address={address} label="复制地址" className="w-full" />
            <JoinServerButton server={server} className="w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
