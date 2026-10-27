import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gamepad2, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTopicForm } from "@/features/forum/components/new-topic-form";
import { getServerApiClient } from "@/lib/api/server";
import { fetchForumCategories, fetchMe } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "发布主题",
  description: "在 ThRei 论坛发布新主题。",
  alternates: { canonical: "/forum/new" },
};

interface NewTopicPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTopicPage({ searchParams }: NewTopicPageProps) {
  const params = await searchParams;
  const requestedCategory = typeof params.category === "string" ? params.category : undefined;
  const client = await getServerApiClient();
  const [categories, me] = await Promise.all([fetchForumCategories(client), fetchMe(client)]);

  if (!me.user) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>使用Steam登录后发布主题</CardTitle>
          <CardDescription>
            ThRei 只使用 Steam 登录。登录后可以发帖、回复和参与社区讨论。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full">
            <a href="/api/v1/auth/steam/login">
              <Gamepad2 aria-hidden="true" />
              使用Steam登录
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/forum">返回论坛</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableCategories = categories.filter(
    (category) => category.slug !== "announcements" || me.user?.role === "admin",
  );

  return (
    <div className="space-y-6">
      <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/forum" className="transition-colors hover:text-foreground">
          论坛
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground">发布主题</span>
      </nav>

      <header>
        <Badge variant="secondary">
          <PenLine aria-hidden="true" />
          新主题
        </Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">发布主题</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          选择分类并填写标题和正文。请勿发布广告、无关内容或他人隐私信息。
        </p>
      </header>

      <Card>
        <CardContent>
          {availableCategories.length > 0 ? (
            <NewTopicForm categories={availableCategories} defaultCategory={requestedCategory} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              当前没有可发布的分类。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
