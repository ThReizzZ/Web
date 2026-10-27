import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Gamepad2, MessageSquareText, Server, Sparkles, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TopicRow } from "@/features/forum/components/topic-row";
import type { ForumTopic } from "@/features/forum/types";
import { ServerCard } from "@/features/servers/components/server-card";
import { getMaxPlayerTotal, getOnlinePlayerTotal } from "@/features/servers/data/servers";
import { getServerApiClient } from "@/lib/api/server";
import { formatRelativeTime } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import { fetchCommunityStats, fetchForumTopics, fetchMe, fetchServers } from "@/services/content";
import { applyEstimatedLatencies, clientIpFromHeaders } from "@/services/latency";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const client = await getServerApiClient();
  const [baseServers, stats, latestTopics, announcements, me] = await Promise.all([
    fetchServers(client),
    fetchCommunityStats(client),
    fetchForumTopics(client, { limit: 5 }),
    fetchForumTopics(client, { category: "announcements", limit: 3 }),
    fetchMe(client),
  ]);
  const clientIp = me.user ? clientIpFromHeaders(await headers()) : null;
  const servers = await applyEstimatedLatencies(baseServers, clientIp);

  const featuredServers = servers.filter((server) => server.featured).slice(0, 3);
  const displayedServers = featuredServers.length > 0 ? featuredServers : servers.slice(0, 3);
  const onlineTotal = getOnlinePlayerTotal(servers);
  const maxTotal = getMaxPlayerTotal(servers);

  return (
    <>
      <section className="relative overflow-hidden border-b bg-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 80% at 50% -10%, rgba(16,185,129,0.14) 0%, transparent 65%), radial-gradient(40% 60% at 88% 10%, rgba(59,130,246,0.08) 0%, transparent 70%)",
          }}
        />

        <PageContainer className="relative py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              {announcements[0] ? (
                <Link href={`/forum/topic/${announcements[0].slug}`} className="inline-flex">
                  <Badge variant="success" className="max-w-full">
                    <Sparkles className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{announcements[0].title}</span>
                  </Badge>
                </Link>
              ) : (
                <Badge variant="success">
                  <Sparkles aria-hidden="true" />
                  ThRei KZ 社区
                </Badge>
              )}
            </div>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              欢迎来到<span className="text-emerald-600 dark:text-emerald-400">最神权</span>
              的服务器
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              请遵守服务器规则
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/servers">
                  <Gamepad2 aria-hidden="true" />
                  浏览服务器
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/api/v1/auth/steam/login">使用Steam登录</a>
              </Button>
            </div>

            <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
              <Stat label="在线玩家" value={onlineTotal} detail={`/ ${maxTotal}`} />
              <Stat label="开放服务器" value={servers.length} />
              <Stat label="本周新主题" value={stats.newTopicsWeek} />
              <Stat label="社区成员" value={stats.members} />
            </dl>
          </div>
        </PageContainer>
      </section>

      <section className="py-16 sm:py-20">
        <PageContainer className="space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">服务器</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">推荐 KZ 服务器</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                新手教学、连跳、长跳和极限攀爬，每个服务器都有自己的地图与节奏。
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/servers">
                查看全部服务器
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          {displayedServers.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayedServers.map((server) => (
                <ServerCard key={server.id} server={server} compact />
              ))}
            </div>
          ) : (
            <EmptyCard
              icon={<Server aria-hidden="true" />}
              title="还没有服务器记录"
              description="服务器接入后会在这里显示地图、在线玩家和连接地址。"
            />
          )}
        </PageContainer>
      </section>

      <section className="border-y bg-muted/30 py-16 sm:py-20">
        <PageContainer>
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
                    社区动态
                  </CardTitle>
                  <CardDescription>来自 KZ 地图、技巧教学和新手区的最新讨论。</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/forum">进入论坛</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {latestTopics.length > 0 ? (
                  latestTopics.map((topic) => (
                    <TopicRow key={topic.slug} topic={topic} showCategory />
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">论坛还没有主题。</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>公告与活动</CardTitle>
                  <CardDescription>开服、赛季和社区活动安排。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {announcements.length > 0 ? (
                    announcements.map((topic) => (
                      <AnnouncementLink key={topic.slug} topic={topic} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂时没有公告。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>社区数据</CardTitle>
                  <CardDescription>来自数据库的实时统计。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <CommunityStat label="社区成员" value={stats.members} />
                    <CommunityStat label="主题讨论" value={stats.topics} />
                    <CommunityStat label="累计回复" value={stats.replies} />
                    <CommunityStat label="在线人数" value={stats.onlinePlayers} />
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    本周有 {stats.activeMembersWeek} 位成员在社区活跃
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-16 sm:py-20">
        <PageContainer>
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-12 text-center text-white sm:px-12">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(16,185,129,0.28),transparent_70%)]"
            />
            <div className="relative mx-auto max-w-2xl">
              <Badge variant="success" className="bg-emerald-400/15 text-emerald-200">
                <Server aria-hidden="true" />
                使用Steam登录
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                使用Steam登录，查看你的社区资料。
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">
                ThRei 只使用Steam登录。登录后可以查看自己的社区资料和 Steam 身份。
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
                  <a href="/api/v1/auth/steam/login">
                    <Gamepad2 aria-hidden="true" />
                    使用Steam登录
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/forum">浏览社区论坛</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="bg-card px-4 py-4 sm:px-5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">
        {value.toLocaleString("zh-CN")}
        {detail ? (
          <span className="text-xs font-normal text-muted-foreground"> {detail}</span>
        ) : null}
      </dd>
    </div>
  );
}

function CommunityStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString("zh-CN")}</p>
    </div>
  );
}

function AnnouncementLink({ topic }: { topic: ForumTopic }) {
  return (
    <Link
      href={`/forum/topic/${topic.slug}`}
      className="block rounded-lg border bg-muted/20 p-3 transition-colors hover:border-primary/25 hover:bg-accent/40"
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{formatRelativeTime(topic.lastActivityAt)}</span>
        <span className="text-border">·</span>
        <span>{topic.categoryName}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-medium">{topic.title}</p>
    </Link>
  );
}

function EmptyCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
