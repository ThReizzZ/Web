import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageSquareText, Server } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForumCategoryIcon, categoryTone } from "@/features/forum/components/forum-category-icon";
import { TopicRow } from "@/features/forum/components/topic-row";
import { categorySlugSchema } from "@/features/forum/lib/params";
import { getServerApiClient } from "@/lib/api/server";
import { formatRelativeTime } from "@/lib/format";
import { fetchForumCategories, fetchForumTopics } from "@/services/content";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const parsed = categorySlugSchema.safeParse(slug);
  if (!parsed.success) {
    return { title: "分类未找到" };
  }

  try {
    const client = await getServerApiClient();
    const categories = await fetchForumCategories(client);
    const category = categories.find((item) => item.slug === parsed.data);
    return category
      ? {
          title: category.name,
          description: category.description,
          alternates: { canonical: `/forum/${category.slug}` },
        }
      : { title: "分类未找到" };
  } catch {
    return { title: "分类未找到" };
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const parsed = categorySlugSchema.safeParse(slug);
  if (!parsed.success) {
    notFound();
  }

  const client = await getServerApiClient();
  const [categories, topics] = await Promise.all([
    fetchForumCategories(client),
    fetchForumTopics(client, { category: parsed.data, limit: 50 }),
  ]);
  const category = categories.find((item) => item.slug === parsed.data);
  if (!category) {
    notFound();
  }

  const otherCategories = categories.filter((item) => item.slug !== category.slug);

  return (
    <PageContainer className="space-y-8 py-10">
      <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/forum" className="transition-colors hover:text-foreground">
          论坛
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-2xl",
              categoryTone[category.icon],
            )}
          >
            <ForumCategoryIcon icon={category.icon} className="size-6" />
          </span>
          <div>
            <Badge variant="muted">讨论分类</Badge>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{category.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {category.description}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/forum">
            <ArrowLeft aria-hidden="true" />
            返回论坛
          </Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>主题列表</CardTitle>
              <CardDescription>
                {category.topicCount} 个主题 · {category.postCount.toLocaleString("zh-CN")} 条回复
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground">
              最后更新 {formatRelativeTime(category.lastActivityAt)}
            </span>
          </CardHeader>
          <CardContent>
            {topics.length > 0 ? (
              topics.map((topic) => <TopicRow key={topic.slug} topic={topic} />)
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <MessageSquareText className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">这个分类还没有主题。</p>
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">分类信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">主题</span>
                <span className="font-medium tabular-nums">{category.topicCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">回复</span>
                <span className="font-medium tabular-nums">
                  {category.postCount.toLocaleString("zh-CN")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">最近活跃</span>
                <span>{formatRelativeTime(category.lastActivityAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">其他分类</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {otherCategories.map((item) => (
                <Link
                  key={item.slug}
                  href={`/forum/${item.slug}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.name}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-4 text-primary" aria-hidden="true" />
                去游戏里看看
              </CardTitle>
              <CardDescription>把讨论变成一次真实的跳跃。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/servers">查看服务器</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
