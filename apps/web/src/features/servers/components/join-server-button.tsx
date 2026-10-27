"use client";

import { Gamepad2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getServerAddress, type KzServer } from "@/features/servers/data/servers";

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
  const address = getServerAddress(server);
  // "hibernating" means the empty server paused game frames and cannot run the
  // plugin, while "offline" means the plugin stopped reporting entirely. Both
  // can still be reachable, so let visitors try to connect. Maintenance is an
  // explicit admin choice.
  const enabled = server.status !== "maintenance";

  if (!enabled) {
    return (
      <Button type="button" variant={variant} size={size} className={className} disabled>
        <Gamepad2 aria-hidden="true" />
        维护中
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a
        href={`steam://connect/${address}`}
        title={`启动 CS:GO 并连接 ${server.name}`}
        aria-label={`加入 ${server.name}`}
      >
        <Gamepad2 aria-hidden="true" />
        加入游戏
      </a>
    </Button>
  );
}
