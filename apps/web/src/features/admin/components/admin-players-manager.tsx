"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AdminPlayer } from "@/features/admin/types";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

export function AdminPlayersManager({ players }: { players: AdminPlayer[] }) {
  const [query, setQuery] = useState("");

  const filteredPlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return players;
    }
    return players.filter((player) =>
      [player.name, player.steamId64, player.lastLoginIp ?? "", player.role]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [players, query]);

  const activeSessionCount = players.reduce((total, player) => total + player.activeSessions, 0);
  const disabledCount = players.filter((player) => player.isDisabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">玩家</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">登录玩家</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            查看所有登录过网站的玩家、最近登录时间、IP 和当前活跃会话。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{players.length} 位玩家</Badge>
          <Badge variant="success">{activeSessionCount} 个活跃会话</Badge>
          {disabledCount > 0 ? <Badge variant="destructive">{disabledCount} 个已禁用</Badge> : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="size-4 text-primary" aria-hidden="true" />
              全部登录玩家
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">按最近登录时间倒序排列。</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索昵称、SteamID 或 IP"
              className="pl-9"
            />
          </div>
        </div>

        <div className="divide-y">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <article
                key={player.steamId64}
                className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar name={player.name} avatarUrl={player.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{player.name}</p>
                      <Badge variant={player.role === "admin" ? "success" : "muted"}>
                        {roleLabel(player.role)}
                      </Badge>
                      {player.isDisabled ? <Badge variant="destructive">已禁用</Badge> : null}
                    </div>
                    <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                      {player.steamId64}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      最近登录 {formatRelativeTime(player.lastLoginAt)} · 注册于{" "}
                      {formatDate(player.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3 xl:w-[30rem] xl:shrink-0">
                  <PlayerInfo label="最近登录时间" value={formatDate(player.lastLoginAt)} />
                  <PlayerInfo label="最近登录 IP" value={player.lastLoginIp ?? "未记录"} mono />
                  <PlayerInfo label="活跃会话" value={`${player.activeSessions} 个`} />
                </div>
              </article>
            ))
          ) : (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {query ? "没有匹配的玩家。" : "还没有玩家登录记录。"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerInfo({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={mono ? "mt-0.5 font-mono text-[11px] break-all" : "mt-0.5 font-medium"}>
        {value}
      </p>
    </div>
  );
}
