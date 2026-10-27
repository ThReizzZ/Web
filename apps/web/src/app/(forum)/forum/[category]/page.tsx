import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageSquareText, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/forum" className="transition-colors hover:text-foreground">
          论坛
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <header className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl",
                categoryTone[category.icon],
              )}
            >
              <ForumCategoryIcon icon={category.icon} className="size-5" />
            </span>
            <div>
              <Badge variant="muted">讨论分类</Badge>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{category.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {category.description}
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`/forum/new?category=${encodeURIComponent(category.slug)}`}>
              <PenLine aria-hidden="true" />
              发布主题
            </Link>
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
          <span>{category.topicCount} 个主题</span>
          <span>{category.postCount.toLocaleString("zh-CN")} 条回复</span>
          <span>最后更新 {formatRelativeTime(category.lastActivityAt)}</span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>主题列表</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length > 0 ? (
            topics.map((topic) => <TopicRow key={topic.slug} topic={topic} />)
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <MessageSquareText className="size-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">这个分类还没有主题</p>
                <p className="mt-1 text-sm text-muted-foreground">发布第一个主题，开启讨论。</p>
              </div>
              <Button asChild size="sm">
                <Link href={`/forum/new?category=${encodeURIComponent(category.slug)}`}>
                  发布主题
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
