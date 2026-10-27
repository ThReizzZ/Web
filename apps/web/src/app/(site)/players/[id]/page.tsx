import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ChevronRight,
  Clock3,
  ExternalLink,
  Gamepad2,
  MapPin,
  MessageSquareText,
  Server,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KzMapsCard, KzMapsCardSkeleton } from "@/features/account/components/kz-maps-card";
import { TopicRow } from "@/features/forum/components/topic-row";
import { decodePlayerIdentifier, playerIdSchema } from "@/features/players/lib/params";
import { getServerApiClient } from "@/lib/api/server";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { fetchCommunityPlayer } from "@/services/content";
import {
  KZ_MODES,
  kzgoProfileUrl,
  parseKzMapView,
  parseKzMode,
  parseKzPage,
  parseKzTier,
} from "@/services/kzgo";

export const dynamic = "force-dynamic";

interface PlayerPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = playerIdSchema.safeParse(decodePlayerIdentifier(id));
  if (!parsed.success) {
    return { title: "玩家未找到" };
  }

  try {
    const client = await getServerApiClient();
    const player = await fetchCommunityPlayer(client, parsed.data);
    return {
      title: `${player.name} 的社区资料`,
      description: `查看 ${player.name} 的 ThRei 论坛数据、游戏在线状态与 KZ 地图记录。`,
      alternates: { canonical: `/players/${player.id}` },
    };
  } catch {
    return { title: "玩家未找到" };
  }
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const { id } = await params;
  const parsed = playerIdSchema.safeParse(decodePlayerIdentifier(id));
  if (!parsed.success) {
    notFound();
  }

  const query = await searchParams;
  const kzMode = parseKzMode(query.kz);
  const kzView = parseKzMapView(query.view);
  const kzPage = parseKzPage(query.page);
  const kzTier = parseKzTier(query.tier);

  const client = await getServerApiClient();
  let player;
  try {
    player = await fetchCommunityPlayer(client, parsed.data);
  } catch {
    notFound();
  }

  const basePath = `/players/${player.id}`;
  const steamProfileUrl = `https://steamcommunity.com/profiles/${player.steamId64}`;
  const kzProfileUrl = kzgoProfileUrl(player.steamId64);
  const modeName = KZ_MODES.find((mode) => mode.value === kzMode)?.name ?? "KZTimer";

  return (
    <PageContainer className="space-y-6 py-10">
      <nav
        aria-label="面包屑"
        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/players" className="transition-colors hover:text-foreground">
          社区玩家
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="max-w-[24rem] truncate text-foreground">{player.name}</span>
      </nav>

      <Card className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <UserAvatar
              name={player.name}
              avatarUrl={player.avatarUrl}
              size="xl"
              className="ring-4"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">{player.name}</h1>
                <Badge variant={roleVariant(player.role)}>{roleLabel(player.role)}</Badge>
                {player.latestServer?.online ? (
                  <Badge variant="success">
                    <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                    游戏中
                  </Badge>
                ) : (
                  <Badge variant="muted">离线</Badge>
                )}
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {player.bio || "这位玩家还没有填写个人简介。"}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  加入于 {formatDate(player.joinedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gamepad2 className="size-3.5" aria-hidden="true" />
                  最近登录 {formatRelativeTime(player.lastLoginAt)}
                </span>
                {player.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {player.location}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:w-40">
              <Button asChild variant="outline" size="sm">
                <a href={steamProfileUrl} target="_blank" rel="noopener noreferrer">
                  Steam 资料
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={kzProfileUrl} target="_blank" rel="noopener noreferrer">
                  KZ:GO 档案
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<MessageSquareText aria-hidden="true" />}
          label="论坛主题"
          value={player.stats.topics}
        />
        <StatCard
          icon={<MessageSquareText aria-hidden="true" />}
          label="论坛回复"
          value={player.stats.replies}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>最近主题</CardTitle>
              <CardDescription>该玩家最近在论坛发布的内容。</CardDescription>
            </CardHeader>
            <CardContent>
              {player.recentTopics.length > 0 ? (
                player.recentTopics.map((topic) => (
                  <TopicRow key={topic.slug} topic={topic} showCategory />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  该玩家还没有发布主题。
                </p>
              )}
            </CardContent>
          </Card>

          <Suspense
            fallback={
              <KzMapsCardSkeleton mode={kzMode} view={kzView} tier={kzTier} basePath={basePath} />
            }
          >
            <KzMapsCard
              steamId64={player.steamId64}
              mode={kzMode}
              view={kzView}
              tier={kzTier}
              page={kzPage}
              basePath={basePath}
            />
          </Suspense>

          <p className="text-xs leading-relaxed text-muted-foreground">
            KZ 数据来自 KZ:GO 的 {modeName} 模式；未安装计时器的服务器或未上传的记录不会显示。
          </p>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-4 text-primary" aria-hidden="true" />
                游戏状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              {player.latestServer ? (
                <div className="space-y-3 text-sm">
                  <Badge variant={player.latestServer.online ? "success" : "muted"}>
                    {player.latestServer.online ? "当前在线" : "最近在线"}
                  </Badge>
                  <div>
                    <p className="font-medium">{player.latestServer.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {player.latestServer.map}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(player.latestServer.lastSeenAt)}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/servers">查看服务器状态</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">还没有游戏服务器记录。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">账号信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="社区角色" value={roleLabel(player.role)} />
              <InfoRow label="SteamID64" value={player.steamId64} mono />
              <InfoRow label="加入社区" value={formatDate(player.joinedAt)} />
              <InfoRow label="最近登录" value={formatDate(player.lastLoginAt)} />
              <InfoRow label="论坛主题" value={player.stats.topics.toLocaleString("zh-CN")} />
              <InfoRow label="论坛回复" value={player.stats.replies.toLocaleString("zh-CN")} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">
            {value.toLocaleString("zh-CN")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "text-right font-mono text-xs" : "text-right font-medium"}>
        {value}
      </span>
    </div>
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
