import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { CopyAddressButton } from "./copy-address-button";
import { JoinServerButton } from "./join-server-button";
import { PlayerAvatar } from "./player-avatar";
import { ServerStatusBadge } from "./server-status-badge";
import { getServerAddress, type GameServer } from "../data/servers";

export function ServerListRow({ server }: { server: GameServer }) {
  const address = getServerAddress(server);
  const visiblePlayers = server.players.slice(0, 5);
  const remainingPlayers = server.playerCount - visiblePlayers.length;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-44">
          <Image
            src={server.mapImage}
            alt={`${server.map} 地图预览`}
            fill
            sizes="(min-width: 640px) 11rem, 100vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
          <div className="absolute bottom-2 left-2 text-xs font-medium text-white">
            {server.map}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ServerStatusBadge status={server.status} />
            <h3 className="text-base font-semibold">{server.name}</h3>
            <Badge variant="muted">{server.mode}</Badge>
          </div>
          <p className="line-clamp-1 text-sm text-muted-foreground">{server.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              在线{" "}
              <span className="font-medium text-foreground">
                {server.playerCount}/{server.maxPlayers}
              </span>
            </span>
            <span>{server.region}</span>
            <span>{server.version}</span>
            <span>{server.latencyMs} ms</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
            {visiblePlayers.map((player) => (
              <span key={player.name} className="inline-flex items-center gap-1.5 text-xs">
                <PlayerAvatar player={player} size="xs" />
                {player.name}
              </span>
            ))}
            {remainingPlayers > 0 ? (
              <span className="text-xs text-muted-foreground">+{remainingPlayers} 位</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-56">
          <div className="rounded-md border bg-muted/25 px-2.5 py-2">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">IP : PORT</p>
            <p className="mt-0.5 font-mono text-xs break-all">{address}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CopyAddressButton address={address} label="复制" size="sm" className="w-full" />
            <JoinServerButton server={server} size="sm" className="w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
