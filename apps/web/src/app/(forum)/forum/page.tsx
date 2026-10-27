import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, PenLine, SearchX, TrendingUp, Users } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForumSearchForm } from "@/features/forum/components/forum-search-form";
import { TopicRow } from "@/features/forum/components/topic-row";
import { forumSearchParamsSchema } from "@/features/forum/lib/params";
import { getServerApiClient } from "@/lib/api/server";
import { fetchActiveUsers, fetchCommunityStats, fetchForumTopics } from "@/services/content";

export const dynamic = "force-dynamic";

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
  const client = await getServerApiClient();
  const [latestTopics, stats, activeUsers, searchResults] = await Promise.all([
    fetchForumTopics(client, { limit: 10 }),
    fetchCommunityStats(client),
    fetchActiveUsers(client, 8),
    query ? fetchForumTopics(client, { q: query, limit: 50 }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary">ThRei 社区论坛</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">论坛</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              分享地图、路线和计时记录，讨论服务器与插件，也可以在这里提交建议或举报违规玩家。
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/forum/new">
              <PenLine aria-hidden="true" />
              发布主题
            </Link>
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            {stats.topics.toLocaleString("zh-CN")} 主题
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            {stats.replies.toLocaleString("zh-CN")} 回复
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {stats.members.toLocaleString("zh-CN")} 位成员
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            {stats.onlinePlayers} 位玩家在游戏
          </span>
        </div>
      </header>

      <Card className="py-4">
        <CardContent>
          <ForumSearchForm defaultQuery={query} />
        </CardContent>
      </Card>

      {query ? (
        <Card>
          <CardHeader>
            <CardTitle>
              「<span className="text-primary">{query}</span>」的搜索结果
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              共找到 {searchResults.length} 个主题，匹配标题、摘要、标签、作者或分类。
            </p>
          </CardHeader>
          <CardContent>
            {searchResults.length > 0 ? (
              searchResults.map((topic) => <TopicRow key={topic.slug} topic={topic} showCategory />)
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <SearchX aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">没有找到相关主题</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    试试更短的关键词，或者从左侧分类浏览。
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
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                  最新讨论
                </CardTitle>
                <p className="text-sm text-muted-foreground">按最近回复时间排序。</p>
              </div>
              <span className="text-xs text-muted-foreground">最近更新</span>
            </CardHeader>
            <CardContent>
              {latestTopics.length > 0 ? (
                latestTopics.map((topic) => (
                  <TopicRow key={topic.slug} topic={topic} showCategory />
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <MessageSquareText className="size-8 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="font-medium">论坛还没有主题</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      发布第一个主题，开启社区讨论。
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href="/forum/new">发布主题</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近活跃</CardTitle>
              <p className="text-sm text-muted-foreground">最近在论坛发帖或回复的成员。</p>
            </CardHeader>
            <CardContent>
              {activeUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeUsers.map((member) => (
                    <span
                      key={member.name}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
                    >
                      <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                      {member.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂时没有活跃记录。</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
