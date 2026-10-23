import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquareText,
  Server,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AdminOverview } from "@/features/admin/types";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminOverview, fetchMe } from "@/services/content";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "运营概览",
  description: "ThRei 社区运营管理面板。",
  robots: { index: false, follow: false },
};

const statCards = [
  { key: "members", label: "注册成员", icon: Users },
  { key: "activeToday", label: "今日登录", icon: Activity },
  { key: "topics", label: "主题总数", icon: MessageSquareText },
  { key: "replies", label: "回复总数", icon: FileText },
  { key: "servers", label: "KZ 服务器", icon: Server },
  { key: "onlinePlayers", label: "在线玩家", icon: ShieldCheck },
  { key: "pendingWhitelist", label: "待审白名单", icon: ClipboardCheck },
  { key: "activeBans", label: "生效封禁", icon: Ban },
] as const;

export default async function AdminOverviewPage() {
  const client = await getServerApiClient();
  const me = await fetchMe(client);

  if (!me.user) {
    return (
      <AccessDenied title="需要登录" description="管理面板只允许使用Steam登录的管理员访问。" />
    );
  }
  if (me.user.role !== "admin") {
    return <AccessDenied title="没有访问权限" description="当前 Steam 账号不是 ThRei 管理员。" />;
  }

  const overview = await fetchAdminOverview(client);

  return (
    <>
      <header id="overview" className="scroll-mt-24 space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">管理面板</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">运营概览</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {me.user.name}，以下是当前运营数据。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <CheckCircle2 aria-hidden="true" />
              管理员已登录
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/servers">查看服务器页</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} className="py-5">
              <CardContent className="px-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                  {overview.stats[card.key].toLocaleString("zh-CN")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <QuickAction
          href="/admin/admins"
          icon={UserCog}
          title="管理员管理"
          description="新增管理员、取消权限或禁用账号。"
          meta={`${overview.roles.find((role) => role.role === "admin")?.count ?? 0} 位管理员`}
        />
        <QuickAction
          href="/admin/bans"
          icon={Ban}
          title="封禁管理"
          description="记录违规原因、查看封禁历史并解封。"
          meta={`${overview.stats.activeBans} 条生效封禁`}
        />
        <QuickAction
          href="/admin/whitelist"
          icon={ClipboardCheck}
          title="白名单审核"
          description="审核申请、配置服务器白名单和移除权限。"
          meta={`${overview.stats.pendingWhitelist} 条待审核`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <WeeklyActivityCard overview={overview} />
        <RoleDistribution overview={overview} />
      </div>

      <section id="users" className="min-w-0 scroll-mt-24">
        <RecentUsers overview={overview} />
      </section>

      <section id="content" className="scroll-mt-24">
        <RecentTopics overview={overview} />
      </section>
    </>
  );
}

function AccessDenied({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/v1/auth/steam/login">使用Steam登录</a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">返回官网</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: typeof UserCog;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        进入管理
      </p>
    </Link>
  );
}

function WeeklyActivityCard({ overview }: { overview: AdminOverview }) {
  const max = Math.max(
    1,
    ...overview.weeklyActivity.flatMap((point) => [point.users, point.topics, point.replies]),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>最近 7 天活跃度</CardTitle>
          <CardDescription>新成员、新主题和新回复的每日变化。</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Legend tone="bg-primary" label="新成员" />
          <Legend tone="bg-primary/60" label="主题" />
          <Legend tone="bg-primary/25" label="回复" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-2 sm:gap-4">
          {overview.weeklyActivity.map((point) => (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <Bar
                  value={point.users}
                  max={max}
                  className="bg-primary"
                  title={`${point.users} 位新成员`}
                />
                <Bar
                  value={point.topics}
                  max={max}
                  className="bg-primary/60"
                  title={`${point.topics} 个新主题`}
                />
                <Bar
                  value={point.replies}
                  max={max}
                  className="bg-primary/25"
                  title={`${point.replies} 条新回复`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{point.date}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Bar({
  value,
  max,
  className,
  title,
}: {
  value: number;
  max: number;
  className: string;
  title: string;
}) {
  return (
    <div
      className={`w-2.5 rounded-t sm:w-3 ${className}`}
      style={{ height: `${(value / max) * 100}%` }}
      title={title}
    />
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-sm ${tone}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function RoleDistribution({ overview }: { overview: AdminOverview }) {
  const total = Math.max(1, overview.stats.members);
  return (
    <Card>
      <CardHeader>
        <CardTitle>角色分布</CardTitle>
        <CardDescription>当前成员在社区中的角色构成。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.roles.length > 0 ? (
          overview.roles.map((role) => (
            <div key={role.role} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{roleLabel(role.role)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {role.count.toLocaleString("zh-CN")} · {((role.count / total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{
                    width: `${Math.max((role.count / total) * 100, role.count > 0 ? 2 : 0)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">还没有成员记录。</p>
        )}
        <Separator />
        <p className="text-xs text-muted-foreground">
          总成员 {overview.stats.members.toLocaleString("zh-CN")} 人，今日登录{" "}
          {overview.stats.activeToday.toLocaleString("zh-CN")} 人。
        </p>
      </CardContent>
    </Card>
  );
}

function RecentUsers({ overview }: { overview: AdminOverview }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>最近注册</CardTitle>
          <CardDescription>通过 Steam 登录加入社区的最新成员。</CardDescription>
        </div>
        <span className="text-xs text-muted-foreground">最近 8 位</span>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {overview.recentUsers.length > 0 ? (
            overview.recentUsers.map((user) => (
              <div
                key={user.steamId64}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 font-medium break-words">{user.name}</p>
                      <Badge variant={user.role === "admin" ? "success" : "muted"}>
                        {roleLabel(user.role)}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                      {user.steamId64}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground sm:justify-end">
                  <span>{formatDate(user.createdAt)} 加入</span>
                  <span>最近登录 {formatRelativeTime(user.lastLoginAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">还没有成员记录。</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentTopics({ overview }: { overview: AdminOverview }) {
  return (
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
        {overview.recentTopics.length > 0 ? (
          overview.recentTopics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/forum/topic/${topic.slug}`}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{topic.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {topic.categoryName} · {topic.author.name} ·{" "}
                  {formatRelativeTime(topic.lastActivityAt)}
                </p>
              </div>
              <Badge variant="muted">{topic.replyCount} 回复</Badge>
            </Link>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">还没有主题记录。</p>
        )}
      </CardContent>
    </Card>
  );
}
