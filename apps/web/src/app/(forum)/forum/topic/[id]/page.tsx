import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Clock3,
  Eye,
  Hash,
  Heart,
  MessageCircle,
  Pin,
  Server,
  Sparkles,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ForumCategoryIcon, categoryTone } from "@/features/forum/components/forum-category-icon";
import type { ForumTopicDetail } from "@/features/forum/types";
import { topicIdSchema } from "@/features/forum/lib/params";
import { getServerApiClient } from "@/lib/api/server";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { fetchForumTopic, fetchForumTopics } from "@/services/content";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TopicPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = topicIdSchema.safeParse(id);
  if (!parsed.success) {
    return { title: "主题未找到" };
  }

  try {
    const client = await getServerApiClient();
    const topic = await fetchForumTopic(client, parsed.data);
    return {
      title: topic.title,
      description: topic.excerpt,
      alternates: { canonical: `/forum/topic/${topic.slug}` },
    };
  } catch {
    return { title: "主题未找到" };
  }
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const parsed = topicIdSchema.safeParse(id);
  if (!parsed.success) {
    notFound();
  }

  const client = await getServerApiClient();
  let topic: ForumTopicDetail;
  try {
    topic = await fetchForumTopic(client, parsed.data);
  } catch {
    notFound();
  }

  const relatedTopics = await fetchForumTopics(client, {
    category: topic.categorySlug,
    limit: 4,
  });
  const paragraphs = topic.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <PageContainer className="space-y-8 py-10">
      <nav
        aria-label="面包屑"
        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/forum" className="transition-colors hover:text-foreground">
          论坛
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <Link
          href={`/forum/${topic.categorySlug}`}
          className="transition-colors hover:text-foreground"
        >
          {topic.categoryName}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="max-w-[24rem] truncate text-foreground">{topic.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {topic.pinned ? (
                <Badge variant="secondary">
                  <Pin aria-hidden="true" />
                  置顶
                </Badge>
              ) : null}
              {topic.hot ? (
                <Badge variant="warning">
                  <Sparkles aria-hidden="true" />
                  热门
                </Badge>
              ) : null}
              <Link href={`/forum/${topic.categorySlug}`}>
                <Badge variant="outline">{topic.categoryName}</Badge>
              </Link>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {topic.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <UserAvatar name={topic.author.name} avatarUrl={topic.author.avatarUrl} size="sm" />
                <span className="font-medium text-foreground">{topic.author.name}</span>
                <span>{roleLabel(topic.author.role)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {formatDate(topic.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" aria-hidden="true" />
                {topic.views.toLocaleString("zh-CN")} 次浏览
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5" aria-hidden="true" />
                {topic.replyCount} 条回复
              </span>
            </div>
          </header>

          <Card>
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="space-y-4 text-[15px] leading-8 whitespace-pre-line text-foreground/90">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {topic.tags.map((tag) => (
                    <Badge key={tag} variant="muted">
                      <Hash aria-hidden="true" />
                      {tag}
                    </Badge>
                  ))}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Heart className="size-3.5" aria-hidden="true" />
                  最后更新 {formatRelativeTime(topic.lastActivityAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-primary">讨论</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  {topic.replies.length} 条回复
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">按时间排序</span>
            </div>

            {topic.replies.length > 0 ? (
              <div className="space-y-3">
                {topic.replies.map((reply) => (
                  <Card key={reply.id} className="py-0">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <UserAvatar name={reply.author.name} avatarUrl={reply.author.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="font-medium">{reply.author.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {reply.author.role}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              · {formatRelativeTime(reply.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-foreground/85">
                            {reply.content}
                          </p>
                          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                            <Heart className="size-3.5" aria-hidden="true" />
                            {reply.likes}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  还没有回复。
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">关于作者</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={topic.author.name} avatarUrl={topic.author.avatarUrl} size="lg" />
                <div>
                  <p className="font-medium">{topic.author.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel(topic.author.role)}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                该主题由 {topic.author.name} 发布，当前共有 {topic.replyCount} 条回复。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">所在分类</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/forum/${topic.categorySlug}`}
                className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-accent/50"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    categoryTone[topic.categoryIcon],
                  )}
                >
                  <ForumCategoryIcon icon={topic.categoryIcon} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{topic.categoryName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    查看该分类下的全部主题
                  </span>
                </span>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">相关主题</CardTitle>
              <CardDescription>同分类下的其他讨论。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedTopics.filter((item) => item.slug !== topic.slug).length > 0 ? (
                relatedTopics
                  .filter((item) => item.slug !== topic.slug)
                  .map((item) => (
                    <Link
                      key={item.slug}
                      href={`/forum/topic/${item.slug}`}
                      className="block text-sm font-medium transition-colors hover:text-primary"
                    >
                      {item.title}
                    </Link>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">暂时没有相关主题。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-4 text-primary" aria-hidden="true" />
                去游戏里看看
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/servers">查看服务器状态</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
