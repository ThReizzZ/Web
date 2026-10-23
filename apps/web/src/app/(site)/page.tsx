import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Database,
  Fingerprint,
  Gauge,
  Layers3,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

const pillars = [
  {
    icon: Fingerprint,
    title: "统一身份边界",
    description: "用户、角色与权限由 Rust API 统一裁决。前端只负责呈现，不把隐藏菜单当作权限控制。",
    status: "设计已确定",
  },
  {
    icon: Layers3,
    title: "按业务切分的模块",
    description: "论坛、通知、审核与审计将在同一个模块化单体中独立演进，避免过早拆成微服务。",
    status: "目录已预留",
  },
  {
    icon: Gauge,
    title: "可运营的基础设施",
    description: "PostgreSQL 持久化、Redis 缓存、版本化迁移、健康检查和 Nginx 统一入口已经就位。",
    status: "骨架已就绪",
  },
] as const;

const dataFlow = [
  { label: "浏览器", detail: "Server / Client Components", icon: Boxes },
  { label: "Nginx", detail: "TLS 与反向代理边界", icon: ShieldCheck },
  { label: "Rust API", detail: "鉴权、业务规则、审计", icon: Workflow },
  { label: "PostgreSQL", detail: "权威数据与迁移", icon: Database },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.93_0.04_255)_0%,transparent_70%)]"
        />
        <PageContainer className="relative py-20 sm:py-28">
          <Badge variant="secondary" className="mb-6">
            <ServerCog aria-hidden="true" />
            架构初始化阶段 · v0.1.0
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            为长期运营而构建的
            <span className="text-primary">社区系统基础</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            threi 将官网、论坛、用户中心和管理面板放在同一个产品体验中，以统一身份、统一 API
            和清晰的服务边界支撑后续持续迭代。
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/forum">
                浏览论坛骨架
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/admin">查看管理面板</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            当前版本仅提供路由、布局、API 基础设施和健康检查；登录与业务数据尚未开放。
          </p>
        </PageContainer>
      </section>

      <section className="py-16 sm:py-20">
        <PageContainer>
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">基础原则</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              先把边界立稳，再逐步填入业务
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              这一阶段不追求页面数量，而是确保未来几个月新增功能时，改动总能落到明确的层和目录中。
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pillars.map((pillar) => (
              <Card key={pillar.title}>
                <CardHeader>
                  <span className="mb-2 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <pillar.icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle>{pillar.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {pillar.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{pillar.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="border-y bg-muted/30 py-16 sm:py-20">
        <PageContainer>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-medium text-primary">请求路径</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                一条清晰的请求链路
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                浏览器只在同源访问公开入口；Nginx 按路径转发到 Next.js 或 Rust API。数据库和 Redis
                不暴露公网端口，只加入内部网络。
              </p>
              <Button asChild variant="link" className="mt-4 px-0">
                <Link href="/forum">
                  查看论坛路由骨架
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {dataFlow.map((item, index) => (
                <li
                  key={item.label}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <item.icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                        0{index + 1}
                      </span>
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </PageContainer>
      </section>

      <section className="py-16 sm:py-20">
        <PageContainer>
          <div className="rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium">安全功能尚未实现，文档已如实标注</p>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  当前可验证的是基础设施，不是完整业务
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  认证、CSRF
                  防护、登录限流和管理审计已经在架构文档中规划，但尚未编码实现。管理面板目前只是公开可见的布局骨架，生产部署前必须先接入鉴权或限制访问。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button asChild>
                  <Link href="/account">查看用户中心骨架</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/forum">前往论坛</Link>
                </Button>
              </div>
            </div>
            <Separator className="my-8" />
            <dl className="grid gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">前端</dt>
                <dd className="mt-1 font-medium">Next.js · React · TypeScript</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">后端</dt>
                <dd className="mt-1 font-medium">Rust · Axum · SQLx</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">数据</dt>
                <dd className="mt-1 font-medium">PostgreSQL · Redis</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">交付</dt>
                <dd className="mt-1 font-medium">Docker Compose · Nginx</dd>
              </div>
            </dl>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
