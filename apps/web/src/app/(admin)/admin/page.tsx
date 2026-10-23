import type { Metadata } from "next";
import {
  Activity,
  BellRing,
  ClipboardCheck,
  FileClock,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SystemStatusCard } from "@/features/admin/components/system-status-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getServerApiClient } from "@/lib/api/server";
import { fetchSystemInfo } from "@/services/system";
import type { SystemInfo } from "@/types/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "系统概览",
  robots: { index: false, follow: false },
};

const plannedModules = [
  { icon: Users, name: "用户与身份认证", boundary: "账号、会话、登录限流" },
  { icon: ShieldCheck, name: "角色与权限", boundary: "RBAC、资源级授权" },
  { icon: ClipboardCheck, name: "内容审核", boundary: "举报、审核队列、处置记录" },
  { icon: BellRing, name: "通知", boundary: "站内通知、投递偏好" },
  { icon: FileClock, name: "管理操作审计", boundary: "写操作留痕、审计查询" },
  { icon: Settings2, name: "系统配置", boundary: "受控配置、变更记录" },
] as const;

async function loadInitialSystemInfo(): Promise<SystemInfo | null> {
  try {
    const client = await getServerApiClient();
    return await fetchSystemInfo(client);
  } catch {
    return null;
  }
}

export default async function AdminOverviewPage() {
  const initialInfo = await loadInitialSystemInfo();

  return (
    <>
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">管理面板</p>
        <h1 className="text-3xl font-semibold tracking-tight">系统概览</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          该页面同时验证了服务端到 API 的内部请求与浏览器端 TanStack Query
          请求。两类请求都使用统一的 API 客户端与错误结构。
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SystemStatusCard initialInfo={initialInfo} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" aria-hidden="true" />
              当前阶段
            </CardTitle>
            <CardDescription>项目处于架构初始化阶段，业务模块按计划逐步接入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">版本</span>
              <span className="font-mono">0.1.0</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">健康检查</span>
              <Badge variant="success">/health/live · /health/ready</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">API 前缀</span>
              <span className="font-mono">/api/v1</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">管理授权</span>
              <Badge variant="warning">未实现</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>后续业务模块边界</CardTitle>
          <CardDescription>
            后端采用模块化单体。每个模块拥有自己的路由、服务与数据访问逻辑，共享认证、错误处理和审计基础设施。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {plannedModules.map((module) => (
              <li
                key={module.name}
                className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                  <module.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{module.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{module.boundary}</p>
                </div>
                <Badge variant="muted" className="ml-auto">
                  待实现
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
