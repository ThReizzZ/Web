import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  Gamepad2,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  currentUser,
  favoriteServerIds,
  notifications,
  profileBadges,
  profileStats,
  recentActivity,
  securityOverview,
  type ActivityItem,
} from "@/features/account/data/account";
import { forumTopics } from "@/features/forum/data/forum";
import { ServerStatusBadge } from "@/features/servers/components/server-status-badge";
import { gameServers } from "@/features/servers/data/servers";

export const metadata: Metadata = {
  title: "用户中心",
  description: "管理你的 ThRei 社区资料、通知、服务器收藏与账号安全。",
  robots: { index: false, follow: false },
};

const activityIcons = {
  reply: MessageCircle,
  topic: FileText,
  server: Gamepad2,
  badge: Award,
} as const;

export default function AccountPage() {
  const myTopics = forumTopics.filter((topic) => topic.author.name === currentUser.name);
  const favoriteServers = favoriteServerIds
    .map((id) => gameServers.find((server) => server.id === id))
    .filter((server): server is (typeof gameServers)[number] => Boolean(server));
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  return (
    <PageContainer className="space-y-6 py-10">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="relative h-36 overflow-hidden bg-slate-950">
          <Image
            src="/images/servers/elysium-valley.svg"
            alt=""
            fill
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover opacity-45"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute inset-x-0 top-0 p-6">
            <p className="text-xs text-white/60">ThRei 社区成员</p>
            <p className="mt-1 text-lg font-medium text-white">欢迎回来，{currentUser.name}</p>
          </div>
        </div>
        <div className="relative px-6 pb-6">
          <div className="-mt-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <UserAvatar
                name={currentUser.name}
                avatar={currentUser.avatar}
                size="xl"
                className="size-20 text-2xl ring-4 ring-card"
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{currentUser.name}</h1>
                  <Badge variant="secondary">{currentUser.role}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{currentUser.handle}</p>
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
            {currentUser.bio}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {currentUser.joinedAt}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {currentUser.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5" aria-hidden="true" />
              资料完整度 {currentUser.completion}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${currentUser.completion}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {profileStats.map((stat) => (
          <Card key={stat.label} className="py-5">
            <CardContent className="px-5">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
              <CardDescription>你的回复、主题和游戏记录。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>我的主题</CardTitle>
                <CardDescription>最近发布或参与维护的社区主题。</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">{myTopics.length} 个主题</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {myTopics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/forum/topic/${topic.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <span className="truncate text-sm font-medium">{topic.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {topic.replies.length} 回复
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>我的服务器</CardTitle>
                <CardDescription>收藏的世界与当前在线状态。</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/servers">全部服务器</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {favoriteServers.map((server) => (
                <Link
                  key={server.id}
                  href="/servers"
                  className="group flex gap-3 rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-accent/40"
                >
                  <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={server.mapImage}
                      alt={`${server.map} 地图`}
                      fill
                      sizes="5rem"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{server.name}</p>
                      <ServerStatusBadge status={server.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {server.playerCount}/{server.maxPlayers} 在线 · {server.map}
                    </p>
                    <p className="mt-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      查看服务器
                    </p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4 text-primary" aria-hidden="true" />
                通知
              </CardTitle>
              {unreadCount > 0 ? <Badge variant="warning">{unreadCount} 条未读</Badge> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex gap-2.5">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${notification.unread ? "bg-primary" : "bg-border"}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {notification.detail}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{notification.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="size-4 text-primary" aria-hidden="true" />
                我的徽章
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {profileBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-lg p-2.5 ${badge.tone}`}
                  title={badge.description}
                >
                  <p className="text-xs font-medium">{badge.name}</p>
                  <p className="mt-0.5 text-[10px] opacity-75">{badge.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                账号与安全
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {securityOverview.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <Badge variant="success">
                      <CheckCircle2 aria-hidden="true" />
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/80">{item.value}</p>
                  <Separator className="mt-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const Icon = activityIcons[activity.type];
  const content = (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{activity.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {activity.detail}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{activity.time}</p>
      </div>
    </div>
  );

  if (activity.href) {
    return (
      <Link href={activity.href} className="block rounded-lg transition-colors hover:bg-accent/40">
        {content}
      </Link>
    );
  }

  return content;
}
