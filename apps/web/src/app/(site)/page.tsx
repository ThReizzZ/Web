import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Gamepad2,
  MessageSquareText,
  Server,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAnnouncements, getLatestTopics, type ForumTopic } from "@/features/forum/data/forum";
import { TopicRow } from "@/features/forum/components/topic-row";
import { PlayerRoster } from "@/features/servers/components/player-roster";
import { ServerCard } from "@/features/servers/components/server-card";
import {
  gameServers,
  getFeaturedServer,
  getFeaturedServers,
  getMaxPlayerTotal,
  getOnlinePlayerTotal,
} from "@/features/servers/data/servers";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

const communityStats = [
  { label: "社区成员", value: "2,846" },
  { label: "主题讨论", value: "696" },
  { label: "累计回复", value: "4,598" },
  { label: "游戏时长", value: "18,420h" },
];

export default function HomePage() {
  const featured = getFeaturedServer();
  const featuredServers = getFeaturedServers();
  const onlineTotal = getOnlinePlayerTotal();
  const maxTotal = getMaxPlayerTotal();
  const latestTopics = getLatestTopics(5);
  const announcements = getAnnouncements(3);

  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 text-white">
        <Image
          src={featured.mapImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
        <PageContainer className="relative py-20 sm:py-28">
          <Link href="/forum/topic/season-three-rush" className="inline-flex">
            <Badge variant="success" className="bg-emerald-400/15 text-emerald-200">
              <Sparkles aria-hidden="true" />
              第三赛季「极速阶梯」已开启
            </Badge>
          </Link>
          <h1 className="mt-6 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="block">一个专注 KZ 的社区，</span>
            <span className="block text-emerald-300">找服务器，记录成绩。</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            这里整理 KZ
            服务器、地图和玩家记录。可以按难度、人数或延迟挑选，也可以到论坛交流路线与技巧。
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
              <Link href="/servers">
                <Gamepad2 aria-hidden="true" />
                加入服务器
                <ArrowRight aria-hidden="true" />
              </Link>
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

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-white/55">在线玩家</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {onlineTotal}
                <span className="text-sm font-normal text-white/45"> / {maxTotal}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">开放服务器</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{gameServers.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">本周新主题</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">96</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">社区成员</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">2,846</dd>
            </div>
          </dl>
        </PageContainer>
      </section>

      <section className="border-b bg-card py-4">
        <PageContainer className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{featured.map}</span> 当前有{" "}
              <span className="font-medium text-foreground">{featured.players.length} 位玩家</span>
              在线：
            </p>
            <PlayerRoster players={featured.players} variant="list" />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              全节点运行正常
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-3.5" aria-hidden="true" />
              十月 KZ 计时赛报名中
            </span>
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredServers.map((server) => (
              <ServerCard key={server.id} server={server} compact />
            ))}
          </div>
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
                {latestTopics.map((topic) => (
                  <TopicRow key={topic.id} topic={topic} showCategory />
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>公告与活动</CardTitle>
                  <CardDescription>开服、赛季和社区活动安排。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {announcements.map((topic) => (
                    <AnnouncementLink key={topic.id} topic={topic} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>社区数据</CardTitle>
                  <CardDescription>这个月，社区一直在生长。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {communityStats.map((stat) => (
                      <div key={stat.label}>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    过去 7 天有 1,236 位成员登录过
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
                服务器长期开放
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                准备好刷新你的第一个 KZ 记录了吗？
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">
                复制服务器地址，打开 CS:GO 控制台输入 connect，然后从起点开始。
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
                  <Link href="/servers">
                    <Gamepad2 aria-hidden="true" />
                    选择服务器
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/forum/topic/welcome-to-threi">阅读新手指南</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  );
}

function AnnouncementLink({ topic }: { topic: ForumTopic }) {
  return (
    <Link
      href={`/forum/topic/${topic.id}`}
      className="block rounded-lg border bg-muted/20 p-3 transition-colors hover:border-primary/25 hover:bg-accent/40"
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{topic.lastActivity}</span>
        <span className="text-border">·</span>
        <span>{topic.tags[0]}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-medium">{topic.title}</p>
    </Link>
  );
}
