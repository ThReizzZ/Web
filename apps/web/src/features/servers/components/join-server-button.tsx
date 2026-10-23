"use client";

import { Gamepad2, X } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyAddressButton } from "@/features/servers/components/copy-address-button";
import { ServerStatusBadge } from "@/features/servers/components/server-status-badge";
import { getServerAddress, type GameServer } from "@/features/servers/data/servers";

export function JoinServerButton({
  server,
  className,
  variant = "default",
  size = "default",
}: {
  server: GameServer;
  className?: string;
  variant?: "default" | "outline";
  size?: "sm" | "default";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const address = getServerAddress(server);
  const enabled = server.status === "online";

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
            <Image
              src={server.mapImage}
              alt={`${server.map} 地图`}
              fill
              sizes="34rem"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
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
              <p className="text-xs text-white/70">{server.map}</p>
              <h2 id={`join-${server.id}-title`} className="text-xl font-semibold">
                {server.name}
              </h2>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{server.mode}</Badge>
              <Badge variant="outline">{server.version}</Badge>
              <Badge variant="outline">{server.region}</Badge>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">服务器地址（IP : PORT）</p>
              <p className="mt-1 font-mono text-sm font-medium break-all">{address}</p>
              <div className="mt-3 flex gap-2">
                <CopyAddressButton address={address} label="复制服务器地址" className="flex-1" />
                <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
                  关闭
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">如何加入</p>
              <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-primary">01</span>
                  启动 Minecraft Java 版 {server.version}，进入「多人游戏」。
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-primary">02</span>
                  选择「添加服务器」，把上方地址粘贴到服务器地址栏。
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-primary">03</span>
                  保存后双击服务器，即可进入 {server.map}。
                </li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              当前在线 {server.playerCount} / {server.maxPlayers} 人 · 延迟约 {server.latencyMs} ms
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
