import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  MessageSquareText,
  SearchX,
  Server,
  TrendingUp,
  Users,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryCard } from "@/features/forum/components/category-card";
import { ForumSearchForm } from "@/features/forum/components/forum-search-form";
import { TopicRow } from "@/features/forum/components/topic-row";
import {
  forumCategories,
  forumTopics,
  getLatestTopics,
  searchForumTopics,
} from "@/features/forum/data/forum";
import { forumSearchParamsSchema } from "@/features/forum/lib/params";
import { gameServers, getOnlinePlayerTotal } from "@/features/servers/data/servers";

export const metadata: Metadata = {
  title: "论坛",
  description: "在 ThRei 论坛与社区成员交流 KZ 地图、技巧、服务器动态、活动与问题反馈。",
  alternates: { canonical: "/forum" },
};

interface ForumPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForumPage({ searchParams }: ForumPageProps) {
  const parsed = forumSearchParamsSchema.safeParse(await searchParams);
  const query = parsed.success && parsed.data.q ? parsed.data.q : undefined;
  const searchResults = query ? searchForumTopics(query) : [];
  const latestTopics = getLatestTopics(6);
  const onlineMembers = Array.from(
    new Map(
      [
        ...forumTopics.map((topic) => topic.author),
        ...forumTopics.flatMap((topic) => topic.replies.map((reply) => reply.author)),
      ].map((user) => [user.name, user]),
    ).values(),
  ).slice(0, 8);

  return (
    <PageContainer className="space-y-8 py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary">ThRei 社区论坛</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">论坛</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            分享你的建造进度、服务器故事和玩法心得。遇到问题时，也欢迎在这里向社区求助。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            696 主题
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            1,236 位本周活跃
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Server className="size-3.5" aria-hidden="true" />
            {gameServers.length} 个服务器
          </span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>搜索社区内容</CardTitle>
          <CardDescription>按标题、标签、作者或分类查找主题。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForumSearchForm defaultQuery={query} />
          {query ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted-foreground">
                搜索「<span className="font-medium text-foreground">{query}</span>」找到{" "}
                <span className="font-medium text-foreground">{searchResults.length}</span> 个结果
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
        <div className="space-y-6">
          {query ? (
            <Card>
              <CardHeader>
                <CardTitle>搜索结果</CardTitle>
                <CardDescription>匹配标题、摘要、标签、作者或分类。</CardDescription>
              </CardHeader>
              <CardContent>
                {searchResults.length > 0 ? (
                  searchResults.map((topic) => (
                    <TopicRow key={topic.id} topic={topic} showCategory />
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                      <SearchX aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium">没有找到相关主题</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        试试更短的关键词，或者浏览下方分类。
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/forum">返回全部讨论</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-primary">分类</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">浏览讨论区</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    共 {forumCategories.length} 个分类
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {forumCategories.map((category) => (
                    <CategoryCard key={category.slug} category={category} />
                  ))}
                  <Link
                    href="/servers"
                    className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Server className="size-5" aria-hidden="true" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="mt-4 font-semibold">服务器状态</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {gameServers.length} 个世界正在运行，{getOnlinePlayerTotal()} 位玩家在线。
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                        全部在线
                      </span>
                      <span className="ml-auto">查看服务器</span>
                    </div>
                  </Link>
                </div>
              </section>

              <Card>
                <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                      最新讨论
                    </CardTitle>
                    <CardDescription>社区里正在发生的事。</CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground">最近更新</span>
                </CardHeader>
                <CardContent>
                  {latestTopics.map((topic) => (
                    <TopicRow key={topic.id} topic={topic} showCategory />
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">社区概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">注册成员</span>
                <span className="font-medium tabular-nums">2,846</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">主题 / 回复</span>
                <span className="font-medium tabular-nums">696 / 4,598</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">今日在线</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  412
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近活跃</CardTitle>
              <CardDescription>正在社区里出现的人。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {onlineMembers.map((member) => (
                  <span
                    key={member.name}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs"
                  >
                    <UserAvatar name={member.name} avatar={member.avatar} size="sm" />
                    {member.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-primary" aria-hidden="true" />
                新手指南
              </CardTitle>
              <CardDescription>第一次来？从这里开始。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/forum/topic/new-player-bind"
                className="block text-sm font-medium transition-colors hover:text-primary"
              >
                如何加入服务器并绑定账号
              </Link>
              <Link
                href="/forum/topic/welcome-to-threi"
                className="block text-sm font-medium transition-colors hover:text-primary"
              >
                社区规则与新人自我介绍
              </Link>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/servers">
                  查看服务器状态
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Alert variant="info">
            <AlertTitle>文明讨论</AlertTitle>
            <AlertDescription>
              请尊重不同玩法与创作风格。遇到纠纷或违规内容，可以在帖子内举报或联系在线管理员。
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    </PageContainer>
  );
}
