import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Pin, Search, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { playerSearchParamsSchema } from "@/features/players/lib/params";
import type { CommunityPlayer } from "@/features/players/types";
import { getServerApiClient } from "@/lib/api/server";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { fetchCommunityPlayers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "社区玩家",
  description: "查找 ThRei 社区玩家，查看论坛数据、游戏在线状态和 KZ 记录。",
  alternates: { canonical: "/players" },
};

interface PlayersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const params = await searchParams;
  const parsed = playerSearchParamsSchema.safeParse({
    q: typeof params.q === "string" ? params.q : undefined,
  });
  const query = parsed.success ? parsed.data.q : undefined;
  const client = await getServerApiClient();
  const players = await fetchCommunityPlayers(client, { q: query, limit: 100 });
  const onlineCount = players.filter((player) => player.onlineServer !== null).length;

  return (
    <PageContainer className="space-y-8 py-10">
      <header className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary">
              <Users aria-hidden="true" />
              社区玩家
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">社区玩家</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              查找 ThRei 成员，查看论坛活跃度、最近登录、当前所在服务器和 KZ 地图记录。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="muted">{players.length} 位玩家</Badge>
            <Badge variant="success">{onlineCount} 位在游戏中</Badge>
          </div>
        </div>

        <form action="/players" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              name="q"
              maxLength={80}
              defaultValue={query ?? ""}
              placeholder="搜索昵称、SteamID64 或 SteamID2/3"
              aria-label="搜索昵称、SteamID64 或 SteamID2/3"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">
              <Search aria-hidden="true" />
              搜索
            </Button>
            {query ? (
              <Button asChild variant="outline">
                <Link href="/players">清除</Link>
              </Button>
            ) : null}
          </div>
        </form>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          支持昵称、SteamID64、SteamID2（如 STEAM_0:0:914966745）和 SteamID3（如
          [U:1:1829933490]）；也可以直接访问 /players/STEAM_0:0:914966745 查询玩家资料。
        </p>

        {query ? (
          <p className="mt-3 text-sm text-muted-foreground">
            搜索「<span className="font-medium text-foreground">{query}</span>」找到{" "}
            {players.length} 位玩家。
          </p>
        ) : null}
      </header>

      {players.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Search aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">{query ? "没有找到匹配的玩家" : "还没有社区玩家"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query
                  ? "可以尝试更短的昵称，或使用完整 SteamID64 / SteamID2 / SteamID3。"
                  : "玩家登录网站后会出现在这里。"}
              </p>
            </div>
            {query ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/players">查看全部玩家</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        玩家数据来自网站账号、论坛记录与游戏服务器插件上报；这里不会公开登录 IP、会话或封禁记录。
      </p>
    </PageContainer>
  );
}

function PlayerCard({ player }: { player: CommunityPlayer }) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={player.name} avatarUrl={player.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {player.role === "admin" ? (
              <Pin className="size-3.5 shrink-0 text-primary" aria-label="管理员置顶" />
            ) : null}
            <h2 className="truncate font-semibold">{player.name}</h2>
            <Badge variant={roleVariant(player.role)}>{roleLabel(player.role)}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {player.onlineServer ? (
              <Badge variant="success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                在线 · {player.onlineServer.name}
              </Badge>
            ) : (
              <Badge variant="muted">当前离线</Badge>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">主题</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {player.topics.toLocaleString("zh-CN")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">回复</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {player.replies.toLocaleString("zh-CN")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">加入社区</dt>
          <dd className="mt-0.5">{formatDate(player.joinedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">最近登录</dt>
          <dd className="mt-0.5">{formatRelativeTime(player.lastLoginAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {player.onlineServer ? `正在游玩 ${player.onlineServer.map}` : "查看详细资料"}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
          查看资料
          <ChevronRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

function roleVariant(role: string): "success" | "warning" | "muted" {
  if (role === "admin") {
    return "success";
  }
  if (role === "moderator") {
    return "warning";
  }
  return "muted";
}
