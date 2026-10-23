import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, UserRound } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { topicIdSchema } from "@/features/forum/lib/params";

interface TopicPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = topicIdSchema.safeParse(id);

  if (!parsed.success) {
    return { title: "帖子未找到" };
  }

  return {
    title: `帖子：${parsed.data}`,
    description: "threi 论坛帖子详情页骨架。",
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const parsed = topicIdSchema.safeParse(id);
  if (!parsed.success) {
    notFound();
  }

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
        <span>主题</span>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="font-mono text-foreground">{parsed.data}</span>
      </nav>

      <header className="space-y-3">
        <Badge variant="secondary">帖子详情骨架</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">帖子 {parsed.data}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          标题、正文、作者信息、回复列表和审核状态将由论坛 API
          与权限系统共同决定。当前页面不包含任何真实内容。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>正文与回复</CardTitle>
              <CardDescription>
                主贴与回复将使用同一套内容模型，并接入审核状态、编辑历史和举报入口。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="size-4" aria-hidden="true" />
                  <span>作者信息待接入</span>
                </div>
                <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                  内容接口尚未实现。
                </p>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="size-4" aria-hidden="true" />
                <span>回复功能待实现</span>
              </div>
            </CardContent>
          </Card>

          <Alert variant="warning">
            <AlertTitle>示例帖子标识</AlertTitle>
            <AlertDescription>
              标识来自 URL，仅用于验证路由与布局。接入数据层后，未知帖子应返回 404。
            </AlertDescription>
          </Alert>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">操作</CardTitle>
              <CardDescription>权限检查将在 API 与页面两侧同时生效。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>回复、编辑、举报和审核操作均待实现。</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/forum">返回论坛首页</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
