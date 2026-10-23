import type { Metadata } from "next";
import { MessageSquareText, Tags, UsersRound } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForumSearchForm } from "@/features/forum/components/forum-search-form";
import { forumSearchParamsSchema } from "@/features/forum/lib/params";

export const metadata: Metadata = {
  title: "论坛",
  description: "threi 论坛首页。分类、主题与回复功能将在后续阶段接入。",
  alternates: { canonical: "/forum" },
};

const pendingFeatures = [
  {
    icon: Tags,
    title: "分类与主题列表",
    description: "分类由管理面板维护，帖子列表通过分页 API 加载。",
  },
  {
    icon: MessageSquareText,
    title: "发帖与回复",
    description: "提交内容需要通过身份认证、权限检查和内容审核策略。",
  },
  {
    icon: UsersRound,
    title: "用户资料与通知",
    description: "用户中心将展示公开资料、通知和账号安全设置。",
  },
] as const;

interface ForumPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForumPage({ searchParams }: ForumPageProps) {
  const parsed = forumSearchParamsSchema.safeParse(await searchParams);
  const query = parsed.success && parsed.data.q ? parsed.data.q : undefined;

  return (
    <PageContainer className="space-y-8 py-10">
      <header className="space-y-3">
        <Badge variant="secondary">论坛模块骨架</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">论坛</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          这里将承载分类浏览、主题列表、帖子详情和回复。当前只建立了页面路由和交互边界，尚未接入论坛数据接口。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>搜索</CardTitle>
          <CardDescription>
            表单使用 React Hook Form + Zod 校验，并通过 URL 查询参数表达搜索条件。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForumSearchForm defaultQuery={query} />
          {query ? (
            <Alert variant="info">
              <AlertTitle>已记录搜索条件</AlertTitle>
              <AlertDescription>
                当前查询为「{query}」。主题搜索接口尚未实现，因此不会返回任何数据。
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        {pendingFeatures.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <span className="mb-2 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <feature.icon className="size-5" aria-hidden="true" />
              </span>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="muted">待实现</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert variant="warning">
        <AlertTitle>路由示例</AlertTitle>
        <AlertDescription>
          可以访问{" "}
          <Link
            className="font-medium text-foreground underline underline-offset-4"
            href="/forum/general"
          >
            /forum/general
          </Link>{" "}
          和{" "}
          <Link
            className="font-medium text-foreground underline underline-offset-4"
            href="/forum/topic/example-topic"
          >
            /forum/topic/example-topic
          </Link>{" "}
          预览分类页与帖子详情页的布局边界。示例标识不对应真实数据。
        </AlertDescription>
      </Alert>

      <div>
        <Button asChild variant="outline">
          <Link href="/account">前往用户中心</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
