import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Hash, MessagesSquare } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categorySlugSchema } from "@/features/forum/lib/params";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const parsed = categorySlugSchema.safeParse(category);

  if (!parsed.success) {
    return { title: "分类未找到" };
  }

  return {
    title: `分类：${parsed.data}`,
    description: `threi 论坛分类 ${parsed.data} 的页面骨架。`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const parsed = categorySlugSchema.safeParse(category);
  if (!parsed.success) {
    notFound();
  }

  return (
    <PageContainer className="space-y-8 py-10">
      <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/forum" className="transition-colors hover:text-foreground">
          论坛
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground">{parsed.data}</span>
      </nav>

      <header className="space-y-3">
        <Badge variant="secondary">分类模块骨架</Badge>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Hash className="size-6 text-muted-foreground" aria-hidden="true" />
          {parsed.data}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          分类元数据、主题列表和分页将由论坛 API 提供。分类标识已经过格式校验，非法标识会返回 404。
        </p>
      </header>

      <Card>
        <CardHeader>
          <span className="mb-2 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
            <MessagesSquare className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>主题列表尚未接入</CardTitle>
          <CardDescription className="leading-relaxed">
            后续将在这里展示主题标题、作者、回复数、最后活跃时间和分页控件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="muted">待实现</Badge>
        </CardContent>
      </Card>

      <Alert variant="warning">
        <AlertTitle>示例路由</AlertTitle>
        <AlertDescription>
          该分类标识来自 URL，不对应真实数据库记录。接入数据层后，未知分类应返回 404 而不是空列表。
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/forum">返回论坛首页</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/forum/topic/example-topic">查看帖子详情骨架</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
