import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Download,
  Gamepad2,
  Megaphone,
  MessageSquareText,
  Server,
  Sparkles,
  Users,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { TopicRow } from "@/features/forum/components/topic-row";
import type { ForumTopic } from "@/features/forum/types";
import { HomeLiveServerStat } from "@/features/servers/components/home-live-server-stat";
import { LiveServerGrid } from "@/features/servers/components/live-server-grid";
import { ServerMapImage } from "@/features/servers/components/server-map-image";
import { getServerApiClient } from "@/lib/api/server";
import { formatRelativeTime } from "@/lib/format";
import { qqGroupUrl, siteConfig } from "@/lib/site-config";
import {
  fetchActiveUsers,
  fetchCommunityStats,
  fetchForumTopics,
  fetchMe,
  fetchServers,
} from "@/services/content";
import { applyEstimatedLatencies, clientIpFromHeaders } from "@/services/latency";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const client = await getServerApiClient();
  const [baseServers, stats, latestTopics, announcements, activeUsers, me] = await Promise.all([
    fetchServers(client),
    fetchCommunityStats(client),
    fetchForumTopics(client, { limit: 5 }),
    fetchForumTopics(client, { category: "announcements", limit: 3 }),
    fetchActiveUsers(client, 6),
    fetchMe(client),
  ]);
  const clientIp = me.user ? clientIpFromHeaders(await headers()) : null;
  const servers = await applyEstimatedLatencies(baseServers, clientIp);
  const heroServer = servers.find((server) => server.featured) ?? servers[0];
  const announcement = announcements[0];
  const isLoggedIn = Boolean(me.user);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div aria-hidden="true" className="absolute inset-0">
          <ServerMapImage
            src={heroServer?.mapImage ?? ""}
            fallbackSrc={heroServer?.mapImageFallback}
            alt=""
            loading="eager"
            className="scale-105 opacity-30"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(70%_100%_at_50%_-20%,rgba(16,185,129,0.28),transparent_62%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/80 to-slate-950"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(to bottom, black, transparent 72%)",
          }}
        />

        <PageContainer className="relative py-16 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            {announcement ? (
              <Link
                href={`/forum/topic/${announcement.slug}`}
                className="group inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
              >
                <Megaphone className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="truncate">{announcement.title}</span>
                <ArrowRight
                  className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white/75 backdrop-blur">
                <Sparkles className="size-3.5 text-emerald-300" aria-hidden="true" />
                ThRei KZ 社区
              </span>
            )}

            <p className="mt-8 text-[10px] font-semibold tracking-[0.38em] text-emerald-300/80 uppercase">
              ThRei KZ Community
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              欢迎来到
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
                最神权
              </span>
              的服务器
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/65 sm:text-lg">
              请遵守服务器规则
            </p>
            <p className="mt-2 text-[10px] tracking-[0.25em] text-white/35 uppercase">
              攀爬 · 连跳 · 长跳 · 计时挑战
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-300"
              >
                <Link href="/servers">
                  <Gamepad2 aria-hidden="true" />
                  浏览服务器
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                {isLoggedIn ? (
                  <Link href="/account">进入用户中心</Link>
                ) : (
                  <a href="/api/v1/auth/steam/login">使用Steam登录</a>
                )}
              </Button>
            </div>

            <a
              href={qqGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white"
            >
              <Users className="size-3.5" aria-hidden="true" />
              或加入 ThRei QQ 群
            </a>

            <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
              <HomeLiveServerStat initialServers={servers} />
              <Stat label="开放服务器" value={servers.length} />
              <Stat label="本周新主题" value={stats.newTopicsWeek} />
              <Stat label="社区成员" value={stats.members} />
            </dl>
          </div>
        </PageContainer>
      </section>

      <section className="py-16 sm:py-20">
        <PageContainer className="space-y-8">
          <SectionHeading
            eyebrow="KZ Servers"
            title="服务器预览"
            action={
              <Button asChild variant="outline">
                <Link href="/servers">
                  全部服务器
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />
          {servers.length > 0 ? (
            <LiveServerGrid initialServers={servers} />
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
        <PageContainer className="space-y-8">
          <SectionHeading
            eyebrow="Community"
            title="社区正在发生"
            description="看看大家最近在讨论什么，或者读一读最新的服务器与社区公告。"
            action={
              <Button asChild variant="outline">
                <Link href="/forum">
                  进入论坛
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          <div className="grid items-start gap-6 lg:grid-cols-[1.55fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
                      最新讨论
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">来自论坛的最新主题。</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/forum">全部主题</Link>
                  </Button>
                </div>
                <div className="mt-3">
                  {latestTopics.length > 0 ? (
                    latestTopics.map((topic) => (
                      <TopicRow key={topic.slug} topic={topic} showCategory />
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      论坛还没有主题。
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">最近活跃</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      最近在论坛发帖或回复的成员。
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/players">社区玩家</Link>
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeUsers.length > 0 ? (
                    activeUsers.map((member) => (
                      <span
                        key={member.name}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
                      >
                        <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                        {member.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂时没有活跃记录。</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Megaphone className="size-4 text-emerald-300" aria-hidden="true" />
                    公告
                  </p>
                  <Link
                    href="/forum/announcements"
                    className="text-xs text-white/45 transition-colors hover:text-white"
                  >
                    全部公告
                  </Link>
                </div>
                <div className="mt-4 space-y-2">
                  {announcements.length > 0 ? (
                    announcements.map((topic) => (
                      <AnnouncementLink key={topic.slug} topic={topic} />
                    ))
                  ) : (
                    <p className="text-sm text-white/50">暂时没有公告。</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">社区数据</p>
                  <span className="text-[11px] text-muted-foreground">来自数据库</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <CommunityStat label="社区成员" value={stats.members} />
                  <CommunityStat label="主题讨论" value={stats.topics} />
                  <CommunityStat label="累计回复" value={stats.replies} />
                  <CommunityStat label="在线人数" value={stats.onlinePlayers} />
                </div>
                <div className="my-4 h-px bg-border" />
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  本周有 {stats.activeMembersWeek} 位成员在社区活跃
                </p>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-16 sm:py-20">
        <PageContainer>
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,rgba(16,185,129,0.28),transparent_70%)]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
                backgroundSize: "52px 52px",
                maskImage: "linear-gradient(to bottom, black, transparent 80%)",
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-[10px] font-semibold tracking-[0.38em] text-emerald-300/80 uppercase">
                Join ThRei
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                下一张地图，和社区一起跳。
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
                登录后参与论坛、查看 KZ 记录、申请白名单；也可以加入 QQ
                群，和服务器里的玩家一起交流。
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {isLoggedIn ? (
                  <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
                    <Link href="/account">进入用户中心</Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
                    <a href="/api/v1/auth/steam/login">
                      <Gamepad2 aria-hidden="true" />
                      使用Steam登录
                    </a>
                  </Button>
                )}
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <a href={qqGroupUrl} target="_blank" rel="noopener noreferrer">
                    <Users aria-hidden="true" />
                    加入 QQ 群
                  </a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/50">
                <Link
                  href="/players"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
                >
                  <Users className="size-3.5" aria-hidden="true" />
                  社区玩家
                </Link>
                <Link
                  href="/forum"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
                >
                  <MessageSquareText className="size-3.5" aria-hidden="true" />
                  论坛
                </Link>
                <a
                  href="https://cdn.threi.cn/csgo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  下载站
                </a>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.28em] text-primary uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
      <dt className="text-[11px] text-white/55">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-white tabular-nums">
        {value.toLocaleString("zh-CN")}
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
      className="group block rounded-lg border border-white/10 bg-white/[0.06] p-3 transition-colors hover:border-emerald-300/25 hover:bg-white/10"
    >
      <div className="flex items-center gap-2 text-[11px] text-white/40">
        <span>{formatRelativeTime(topic.lastActivityAt)}</span>
        <span className="text-white/20">·</span>
        <span>{topic.categoryName}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-medium text-white/85 transition-colors group-hover:text-white">
        {topic.title}
      </p>
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-14 text-center">
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
