import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gamepad2,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/features/account/components/logout-button";
import { WhitelistApplyCard } from "@/features/account/components/whitelist-apply-card";
import type { AccountActivity, AccountOverview } from "@/features/account/types";
import { ServerStatusBadge } from "@/features/servers/components/server-status-badge";
import { getServerApiClient } from "@/lib/api/server";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { fetchAccount, fetchMe, fetchServers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "用户中心",
  description: "管理你的 ThRei 社区资料、Steam 登录状态与服务器收藏。",
  robots: { index: false, follow: false },
};

const activityIcons = {
  reply: MessageCircle,
  topic: FileText,
} as const;

interface AccountPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const steamError = typeof params.steam_error === "string" ? params.steam_error : undefined;
  const client = await getServerApiClient();
  const me = await fetchMe(client);

  if (!me.user) {
    return <LoginRequired steamError={steamError} />;
  }

  let account: AccountOverview;
  let whitelistServers: Awaited<ReturnType<typeof fetchServers>> = [];
  try {
    [account, whitelistServers] = await Promise.all([fetchAccount(client), fetchServers(client)]);
  } catch {
    return <LoginRequired />;
  }

  const activity = account.recentActivity;
  const user = account.user;
  const whitelistOptions = whitelistServers.filter((server) => server.requiresWhitelist);

  return (
    <PageContainer className="space-y-6 py-10">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="relative h-36 overflow-hidden bg-slate-950">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(80%_120%_at_15%_0%,rgba(16,185,129,0.32),transparent_65%)]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute inset-x-0 top-0 p-6">
            <p className="text-xs text-white/60">ThRei 社区成员</p>
            <p className="mt-1 text-lg font-medium text-white">欢迎回来，{user.name}</p>
          </div>
        </div>
        <div className="relative px-6 pb-6">
          <div className="flex flex-col gap-5 pt-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="xl"
                className="-mt-10 size-20 text-2xl ring-4 ring-card"
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
                  <Badge variant="secondary">{roleLabel(user.role)}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  SteamID64 {user.steamId64}
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/forum">
                前往论坛
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {user.bio || "还没有填写个人简介。"}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatDate(user.joinedAt)} 加入
            </span>
            {user.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                {user.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
              Steam 已登录
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="主题" value={account.stats.topics} detail="你发布的主题" />
        <StatCard label="回复" value={account.stats.replies} detail="你发表的回复" />
        <StatCard label="收藏服务器" value={account.stats.favorites} detail="已收藏的服务器" />
        <StatCard label="活跃会话" value={account.stats.sessions} detail="当前登录设备" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
              <CardDescription>你在论坛中的主题和回复。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activity.length > 0 ? (
                activity.map((item, index) => (
                  <ActivityRow key={`${item.kind}-${item.createdAt}-${index}`} activity={item} />
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  还没有活动记录。去论坛浏览讨论吧。
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>我的主题</CardTitle>
                <CardDescription>你最近发布或参与维护的社区主题。</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">
                {account.recentTopics.length} 个主题
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.recentTopics.length > 0 ? (
                account.recentTopics.map((topic) => (
                  <Link
                    key={topic.slug}
                    href={`/forum/topic/${topic.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <span className="truncate text-sm font-medium">{topic.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {topic.replyCount} 回复
                    </span>
                  </Link>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">还没有发布主题。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>我的服务器</CardTitle>
                <CardDescription>收藏的 KZ 服务器与当前在线状态。</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/servers">全部服务器</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {account.favorites.length > 0 ? (
                account.favorites.map((server) => (
                  <Link
                    key={server.id}
                    href="/servers"
                    className="group flex gap-3 rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="relative grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 text-xs text-white/60">
                      {server.mapImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={server.mapImage}
                          alt={`${server.map} 地图`}
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        server.map
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{server.name}</p>
                        <ServerStatusBadge status={server.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {server.onlinePlayers}/{server.maxPlayers} 在线 · {server.map}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground sm:col-span-2">
                  还没有收藏服务器。
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                账号与安全
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="登录方式" value="Steam OpenID" />
              <Separator />
              <InfoRow label="SteamID64" value={user.steamId64} mono />
              <Separator />
              <InfoRow label="最近登录" value={formatRelativeTime(user.lastLoginAt)} />
              <Separator />
              <LogoutButton />
            </CardContent>
          </Card>

          {whitelistOptions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
                  白名单申请
                </CardTitle>
                <CardDescription>
                  部分服务器需要管理员审核后才能进入。提交后可在论坛或服务器内联系管理员。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WhitelistApplyCard servers={whitelistOptions} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="size-4 text-primary" aria-hidden="true" />
                参与社区
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/forum">
                  <MessageCircle aria-hidden="true" />
                  浏览论坛
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/servers">
                  <Gamepad2 aria-hidden="true" />
                  查看服务器
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function LoginRequired({ steamError }: { steamError?: string }) {
  return (
    <PageContainer className="py-16">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>使用Steam登录</CardTitle>
          <CardDescription>
            ThRei 只使用Steam登录。登录后可以查看自己的社区资料、主题和服务器收藏。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steamError ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-foreground">
              Steam 登录未完成，请重新尝试。
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            如果无法打开 Steam 登录页，请先开启 Steam 社区加速器（例如 Watt Toolkit）后再试。
          </p>
          <Button asChild className="w-full">
            <a href="/api/v1/auth/steam/login">
              <Gamepad2 aria-hidden="true" />
              使用Steam登录
            </a>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card className="py-5">
      <CardContent className="px-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
          {value.toLocaleString("zh-CN")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: AccountActivity }) {
  const Icon = activityIcons[activity.kind];
  const content = (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {activity.kind === "topic" ? "发布了" : "回复了"}「{activity.title}」
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {activity.detail}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatRelativeTime(activity.createdAt)}
        </p>
      </div>
    </div>
  );

  return activity.href ? (
    <Link href={activity.href} className="block rounded-lg transition-colors hover:bg-accent/40">
      {content}
    </Link>
  ) : (
    content
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm font-medium"}>{value}</span>
    </div>
  );
}
