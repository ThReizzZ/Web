import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Copy, Globe2, Map, Server, Terminal, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ServerDirectory } from "@/features/servers/components/server-directory";
import { ServerLiveSummary } from "@/features/servers/components/server-live-summary";
import { ServerMapImage } from "@/features/servers/components/server-map-image";
import { getServerApiClient } from "@/lib/api/server";
import { fetchMe, fetchServers } from "@/services/content";
import { applyEstimatedLatencies, clientIpFromHeaders } from "@/services/latency";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "服务器",
  description: "查看 ThRei CS:GO KZ 服务器状态、地图、在线玩家与连接地址，选择合适的服务器。",
  alternates: { canonical: "/servers" },
};

const steps = [
  {
    icon: Globe2,
    title: "使用Steam登录",
    description: "ThRei 只使用Steam登录。登录后可以查看个人资料并参与论坛讨论。",
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

export default async function ServersPage() {
  const client = await getServerApiClient();
  const [baseServers, me] = await Promise.all([fetchServers(client), fetchMe(client)]);
  const clientIp = me.user ? clientIpFromHeaders(await headers()) : null;
  const servers = await applyEstimatedLatencies(baseServers, clientIp);
  const featured = servers.find((server) => server.featured) ?? servers[0];

  return (
    <PageContainer className="space-y-10 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white">
        <ServerMapImage
          src={featured?.mapImage ?? ""}
          fallbackSrc={featured?.mapImageFallback}
          alt=""
          loading="eager"
          className="opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/25" />
        <div className="relative max-w-4xl p-7 sm:p-10 lg:p-12">
          <Badge variant="success" className="bg-emerald-400/15 text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
            {servers.length > 0 ? `${servers.length} 个 KZ 服务器开放中` : "等待服务器接入"}
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
              {me.user ? (
                <Link href="/account">进入用户中心</Link>
              ) : (
                <a href="/api/v1/auth/steam/login">使用Steam登录</a>
              )}
            </Button>
          </div>
          <ServerLiveSummary initialServers={servers} />
        </div>
      </section>

      <ServerDirectory servers={servers} />

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
            {me.user ? (
              <>
                <p className="text-sm font-medium">已使用Steam登录</p>
                <p className="text-xs text-muted-foreground">
                  当前身份：{me.user.name}。可以前往用户中心查看自己的记录。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">还没有登录？</p>
                <p className="text-xs text-muted-foreground">
                  ThRei 只使用Steam登录。登录后可以查看个人资料。
                </p>
              </>
            )}
          </div>
        </div>
        <Button asChild variant="outline">
          {me.user ? (
            <Link href="/account">
              <Users aria-hidden="true" />
              前往用户中心
            </Link>
          ) : (
            <a href="/api/v1/auth/steam/login">
              <Users aria-hidden="true" />
              使用Steam登录
            </a>
          )}
        </Button>
      </div>

      {servers.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Map className="size-3.5" aria-hidden="true" />
          当前数据库中没有服务器记录。管理员添加服务器后，这里会自动显示真实状态和地址。
        </p>
      ) : null}
    </PageContainer>
  );
}
