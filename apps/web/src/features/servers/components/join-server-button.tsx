"use client";

import { Gamepad2, X } from "lucide-react";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyAddressButton } from "@/features/servers/components/copy-address-button";
import { ServerMapImage } from "@/features/servers/components/server-map-image";
import { ServerStatusBadge } from "@/features/servers/components/server-status-badge";
import {
  getOnlinePlayerCount,
  getServerAddress,
  type KzServer,
} from "@/features/servers/data/servers";

export function JoinServerButton({
  server,
  className,
  variant = "default",
  size = "default",
}: {
  server: KzServer;
  className?: string;
  variant?: "default" | "outline";
  size?: "sm" | "default";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const address = getServerAddress(server);
  const playerCount = getOnlinePlayerCount(server);
  // "hibernating" means the empty server paused game frames and cannot run the
  // plugin, while "offline" means the plugin stopped reporting entirely. Both
  // can still be reachable, so let visitors try to connect. Maintenance is an
  // explicit admin choice.
  const enabled = server.status !== "maintenance";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={!enabled}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Gamepad2 aria-hidden="true" />
        {enabled ? "加入游戏" : "维护中"}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`join-${server.id}-title`}
        className="m-auto w-[min(92vw,34rem)] rounded-2xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-slate-950/70"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className="relative">
          <div className="relative h-36 overflow-hidden rounded-t-2xl">
            <ServerMapImage
              src={server.mapImage}
              fallbackSrc={server.mapImageFallback}
              alt={`${server.map} 地图`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
              <ServerStatusBadge status={server.status} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-white hover:bg-white/15 hover:text-white"
                onClick={() => dialogRef.current?.close()}
                aria-label="关闭加入游戏对话框"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-mono text-xs text-white/70">{server.map}</p>
              <h2 id={`join-${server.id}-title`} className="text-xl font-semibold">
                {server.name}
              </h2>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">CS:GO KZ</Badge>
              {server.mapTier !== null ? (
                <Badge variant="outline">Tier {server.mapTier}</Badge>
              ) : null}
              <Badge variant="outline">{server.tickrate} tick</Badge>
              {server.region && server.region !== "未知" ? (
                <Badge variant="outline">{server.region}</Badge>
              ) : null}
              <Badge variant="outline">
                {playerCount}/{server.maxPlayers} 在线
              </Badge>
            </div>

            {server.status === "hibernating" ? (
              <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
                空服休眠时游戏会暂停插件上报，但服务器仍在运行。可以直接连接唤醒服务器。
              </p>
            ) : server.status === "offline" ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                网站超过 90
                秒没有收到插件上报，服务器可能仍在运行（例如空服休眠）。可以直接尝试连接。
              </p>
            ) : null}

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">连接服务器</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button asChild>
                  <a href={`steam://connect/${address}`}>
                    <Gamepad2 aria-hidden="true" />
                    启动 CS:GO
                  </a>
                </Button>
                <CopyAddressButton address={address} label="复制服务器地址" className="w-full" />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                需要本机已安装 Steam 与 CS:GO；浏览器可能会询问是否打开 Steam。
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">如何加入</p>
              <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-primary">01</span>
                  启动 Steam，选择 Counter-Strike: Global Offensive。
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-primary">02</span>
                  打开开发者控制台，输入{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">
                    connect {address}
                  </code>
                  。
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-primary">03</span>
                  或直接点击上方“启动 CS:GO”，由 Steam 连接服务器。
                </li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              当前在线 {playerCount} / {server.maxPlayers} 人 ·{" "}
              {server.estimatedLatencyMs !== null
                ? `预估延迟约 ${server.estimatedLatencyMs} ms`
                : "延迟未知"}{" "}
              · KZ 计时器与检查点由服务器插件提供。
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
