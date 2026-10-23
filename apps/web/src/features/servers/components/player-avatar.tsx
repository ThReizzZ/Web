import { cn } from "@/lib/utils";

import type { OnlinePlayer } from "../data/servers";

export function PlayerAvatar({
  player,
  size = "sm",
  className,
}: {
  player: OnlinePlayer;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <span
      title={`${player.name} · ${player.role}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-background",
        size === "xs" ? "size-6 text-[10px]" : "size-8 text-xs",
        player.avatar,
        className,
      )}
    >
      {player.name.slice(0, 1)}
    </span>
  );
}
