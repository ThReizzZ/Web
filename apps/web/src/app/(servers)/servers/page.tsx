import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Copy, Globe2, Map, Server, Terminal, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ServerDirectory } from "@/features/servers/components/server-directory";
import {
  gameServers,
  getFeaturedServer,
  getMaxPlayerTotal,
  getOnlinePlayerTotal,
} from "@/features/servers/data/servers";

export const metadata: Metadata = {
  title: "服务器",
  description: "查看 ThRei CS:GO KZ 服务器状态、地图、在线玩家与连接地址，选择合适的服务器。",
  alternates: { canonical: "/servers" },
};

const steps = [
  {
    icon: Globe2,
    title: "绑定 Steam 账号",
    description: "在用户中心绑定 Steam，社区称号、计时记录和服务器身份会保持同步。",
  },
  {
    icon: Copy,
    title: "复制服务器地址",
    description: "选择想去的 KZ 服务器，复制 IP:PORT，或直接点击加入游戏。",
  },
  {
    icon: Terminal,
    title: "控制台连接",
    description: "在 CS:GO 开发者控制台输入 connect IP:PORT，即可进入服务器开始跳跃。",
  },
] as const;

export default function ServersPage() {
  const featured = getFeaturedServer();
  const onlineTotal = getOnlinePlayerTotal();
  const maxTotal = getMaxPlayerTotal();

  return (
    <PageContainer className="space-y-10 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white">
        <Image
          src={featured.mapImage}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 72rem, 100vw"
          className="object-cover opacity-45"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/25" />
        <div className="relative max-w-4xl p-7 sm:p-10 lg:p-12">
          <Badge variant="success" className="bg-emerald-400/15 text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
            {gameServers.length} 个 KZ 服务器开放中
          </Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            <span className="block">KZ 服务器目录</span>
            <span className="block text-emerald-300">地图、玩家与地址。</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            新手教学、连跳、长跳和进阶攀爬都有对应服务器。选择服务器后，可以查看完整玩家列表、复制地址或直接启动
            CS:GO。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
              <Link href="#servers">
                浏览服务器
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/forum/topic/new-player-bind">KZ 新手指南</Link>
            </Button>
          </div>
          <dl className="mt-9 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-white/55">在线玩家</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{onlineTotal}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">社区容量</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{maxTotal}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">服务器 tickrate</dt>
              <dd className="mt-1 text-2xl font-semibold">128</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">KZ 服务器</dt>
              <dd className="mt-1 text-2xl font-semibold">{gameServers.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <ServerDirectory />

      <section className="grid gap-4 rounded-2xl border bg-muted/25 p-6 sm:p-8 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <p className="text-sm font-medium text-primary">加入之前</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">三步进入 ThRei KZ 服务器</h2>
        </div>
        {steps.map((step, index) => (
          <Card key={step.title} className="border-0 bg-background/80 shadow-none">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Server className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">还没有社区账号？</p>
            <p className="text-xs text-muted-foreground">
              绑定 Steam 后可以保存服务器、同步 KZ 记录并参与论坛讨论。
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/account">
            <Users aria-hidden="true" />
            前往用户中心
          </Link>
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Map className="size-3.5" aria-hidden="true" />
        页面中的服务器状态、地图和在线玩家为预览数据。
      </p>
    </PageContainer>
  );
}
