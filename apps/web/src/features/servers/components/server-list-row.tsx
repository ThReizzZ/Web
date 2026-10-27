import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { CopyAddressButton } from "./copy-address-button";
import { JoinServerButton } from "./join-server-button";
import { PlayerRoster } from "./player-roster";
import { ServerMapImage } from "./server-map-image";
import { ServerStatusBadge } from "./server-status-badge";
import { getOnlinePlayerCount, getServerAddress, type KzServer } from "../data/servers";

export function ServerListRow({ server }: { server: KzServer }) {
  const address = getServerAddress(server);
  const playerCount = getOnlinePlayerCount(server);

  return (
    <Card
      id={`server-${server.id}`}
      data-server-id={server.id}
      className="scroll-mt-24 gap-0 overflow-hidden py-0"
    >
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-stretch">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-slate-900 sm:h-24 sm:w-44">
          <ServerMapImage
            src={server.mapImage}
            fallbackSrc={server.mapImageFallback}
            alt={`${server.map} 地图预览`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
          <div className="absolute bottom-2 left-2 font-mono text-xs font-medium text-white">
            {server.map}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <ServerStatusBadge status={server.status} />
            <h3 className="text-base font-semibold">{server.name}</h3>
            <Badge variant="muted">KZ</Badge>
            {server.mapTier !== null ? (
              <Badge variant="outline">Tier {server.mapTier}</Badge>
            ) : null}
            {server.requiresWhitelist ? <Badge variant="warning">白名单</Badge> : null}
            {server.region && server.region !== "未知" ? (
              <Badge variant="outline">{server.region}</Badge>
            ) : null}
          </div>
          <p className="line-clamp-1 text-sm text-muted-foreground">{server.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              在线{" "}
              <span className="font-medium text-foreground">
                {playerCount}/{server.maxPlayers}
              </span>
            </span>
            <span>{server.tickrate} tick</span>
            <span title="根据你的登录 IP 与服务器位置估算">
              {server.estimatedLatencyMs !== null
                ? `预估 ${server.estimatedLatencyMs} ms`
                : "延迟未知"}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">在线玩家</p>
            <PlayerRoster players={server.players} variant="list" className="mt-1.5" />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-64 lg:justify-end">
          <div className="grid grid-cols-2 gap-2">
            <CopyAddressButton address={address} label="复制" size="sm" className="w-full" />
            <JoinServerButton server={server} size="sm" className="w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
