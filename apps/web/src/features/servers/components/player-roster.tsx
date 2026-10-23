import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

import type { KzPlayer } from "../data/servers";

export function PlayerRoster({
  players,
  variant = "list",
  className,
}: {
  players: KzPlayer[];
  variant?: "card" | "list";
  className?: string;
}) {
  return (
    <ul
      className={cn("flex flex-wrap gap-1.5", variant === "card" && "grid grid-cols-2", className)}
    >
      {players.map((player) => (
        <li
          key={player.name}
          data-player-name={player.name}
          data-player-avatar={player.avatar}
          title={player.name}
          className={cn(
            "min-w-0 border bg-background/75",
            variant === "card"
              ? "flex items-center gap-2 rounded-lg py-1 pr-2 pl-1"
              : "inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5",
          )}
        >
          <UserAvatar
            name={player.name}
            avatar={player.avatar}
            size="xs"
            className={cn(
              "ring-1 ring-background",
              variant === "list" ? "size-5 text-[9px]" : "size-6 text-[10px]",
            )}
          />
          <span className="min-w-0 font-mono text-[11px] leading-tight break-all">
            {player.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
