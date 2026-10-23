import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileClock,
  Info,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  adminStats,
  auditLog,
  moderationQueue,
  recentUsers,
  roleDistribution,
  systemSettings,
  weeklyActivity,
} from "@/features/admin/data/dashboard";
import { SystemStatusCard } from "@/features/admin/components/system-status-card";
import { getCategory, forumTopics } from "@/features/forum/data/forum";
import { ServerStatusBadge } from "@/features/servers/components/server-status-badge";
import { gameServers } from "@/features/servers/data/servers";
import { getServerApiClient } from "@/lib/api/server";
import { fetchSystemInfo } from "@/services/system";
import type { SystemInfo } from "@/types/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "运营概览",
  description: "ThRei 社区运营管理面板。",
  robots: { index: false, follow: false },
};

const statIcons = [Users, Activity, MessageSquareText, ShieldCheck] as const;

const severityVariant = {
  低: "muted",
  中: "warning",
  高: "destructive",
} as const;

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
  const maxPlayers = Math.max(...weeklyActivity.map((point) => point.players));
  const maxPosts = Math.max(...weeklyActivity.map((point) => point.posts));
  const recentTopics = forumTopics.slice(0, 5);

  return (
    <>
      <header id="overview" className="scroll-mt-24 space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">管理面板</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">运营概览</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              ThRei 社区今天的运行情况与待办事项。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <CheckCircle2 aria-hidden="true" />
              全部服务正常
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/servers">查看服务器页</Link>
            </Button>
          </div>
        </div>
        <Alert variant="info">
          <Info aria-hidden="true" />
          <AlertTitle>预览数据</AlertTitle>
          <AlertDescription>
            以下内容为模拟运营数据，用于预览上线后的管理面板。认证与权限尚未接入，生产环境请勿公开管理面板。
          </AlertDescription>
        </Alert>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminStats.map((stat, index) => {
          const Icon = statIcons[index] ?? Activity;
          return (
            <Card key={stat.label} className="py-5">
              <CardContent className="px-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
                  <Badge variant={stat.trend === "up" ? "success" : "muted"}>
                    {stat.trend === "up" ? (
                      <ArrowUpRight aria-hidden="true" />
                    ) : (
                      <ArrowDownRight aria-hidden="true" />
                    )}
                    {stat.change}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>最近 7 天活跃度</CardTitle>
              <CardDescription>在线玩家与新主题的每日变化。</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" aria-hidden="true" />
                在线
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary/25" aria-hidden="true" />
                新主题
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-2 sm:gap-4">
              {weeklyActivity.map((point) => (
                <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end justify-center gap-1">
                    <div
                      className="w-2.5 rounded-t bg-primary sm:w-3"
                      style={{ height: `${(point.players / maxPlayers) * 100}%` }}
                      title={`${point.players} 位在线玩家`}
                    />
                    <div
                      className="w-2.5 rounded-t bg-primary/25 sm:w-3"
                      style={{ height: `${(point.posts / maxPosts) * 100}%` }}
                      title={`${point.posts} 个新主题`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{point.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>角色分布</CardTitle>
            <CardDescription>当前成员在社区中的角色构成。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleDistribution.map((role) => (
              <div key={role.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{role.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {role.count.toLocaleString("zh-CN")} · {role.percent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${role.percent}%` }}
                  />
                </div>
              </div>
            ))}
            <Separator />
            <p className="text-xs text-muted-foreground">
              过去 30 天新增 286 位成员，其中 34 位成为创作者或版主。
            </p>
          </CardContent>
        </Card>
      </div>

      <section id="users" className="scroll-mt-24">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>最近注册</CardTitle>
              <CardDescription>新加入社区的成员与当前状态。</CardDescription>
            </div>
            <span className="text-xs text-muted-foreground">本周新增 96 人</span>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">成员</th>
                    <th className="pb-2 font-medium">角色</th>
                    <th className="pb-2 font-medium">加入时间</th>
                    <th className="pb-2 text-right font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.handle} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={user.name} avatar={user.avatar} />
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {user.handle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">{user.role}</td>
                      <td className="py-3 text-muted-foreground">{user.joinedAt}</td>
                      <td className="py-3 text-right">
                        <Badge
                          variant={
                            user.status === "正常"
                              ? "success"
                              : user.status === "观察中"
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section id="content" className="scroll-mt-24">
          <Card className="h-full">
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>最近主题</CardTitle>
                <CardDescription>社区中最新发布或更新的讨论。</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/forum">进入论坛</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTopics.map((topic) => {
                const category = getCategory(topic.categorySlug);
                return (
                  <Link
                    key={topic.id}
                    href={`/forum/topic/${topic.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{topic.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {category?.name} · {topic.author.name} · {topic.lastActivity}
                      </p>
                    </div>
                    <Badge variant="muted">{topic.replies.length} 回复</Badge>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section id="moderation" className="scroll-mt-24">
          <Card className="h-full">
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>待审核内容</CardTitle>
                <CardDescription>自动检测和成员举报汇总。</CardDescription>
              </div>
              <Badge variant="warning">{moderationQueue.length} 项待处理</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {moderationQueue.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.target}</p>
                    <Badge variant={severityVariant[item.severity]}>{item.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{item.reporter}</span>
                    <span>{item.time}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      <section id="audit" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileClock className="size-4 text-primary" aria-hidden="true" />
              管理操作审计
            </CardTitle>
            <CardDescription>最近的管理动作与系统自动处理记录。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">操作者</th>
                    <th className="pb-2 font-medium">动作</th>
                    <th className="pb-2 font-medium">对象</th>
                    <th className="pb-2 text-right font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2.5">{entry.actor}</td>
                      <td className="py-2.5 text-muted-foreground">{entry.action}</td>
                      <td className="py-2.5">{entry.target}</td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">
                        {entry.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section id="settings" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>系统设置摘要</CardTitle>
              <CardDescription>当前社区运行策略的只读概览。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {systemSettings.map((setting) => (
                <div key={setting.label} className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{setting.label}</p>
                  <p className="mt-1 text-sm font-medium">{setting.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{setting.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section id="status" className="scroll-mt-24 space-y-4">
          <SystemStatusCard initialInfo={initialInfo} />
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>服务器节点</CardTitle>
                <CardDescription>KZ 服务器与在线玩家。</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/servers">服务器页</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {gameServers.slice(0, 6).map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{server.name}</p>
                      <ServerStatusBadge status={server.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {server.map} · {server.region}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm tabular-nums">
                    {server.players.length}/{server.maxPlayers}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      在线
                    </span>
                  </p>
                </div>
              ))}
              {gameServers.length > 6 ? (
                <Link
                  href="/servers"
                  className="flex items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                >
                  查看全部 {gameServers.length} 个服务器
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
