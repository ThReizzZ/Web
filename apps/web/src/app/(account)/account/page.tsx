import type { Metadata } from "next";
import Link from "next/link";
import { Bell, KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "用户中心",
  description: "threi 用户中心骨架。登录、资料和安全设置尚未实现。",
  robots: { index: false, follow: false },
};

const pendingSections = [
  {
    icon: UserRound,
    title: "个人资料",
    description: "昵称、头像、个人简介和公开资料的可见性设置。",
  },
  {
    icon: ShieldCheck,
    title: "账号安全",
    description: "密码修改、会话管理、登录设备记录和二次验证。",
  },
  {
    icon: Bell,
    title: "通知偏好",
    description: "回复提醒、提及提醒和系统通知的投递方式。",
  },
] as const;

export default function AccountPage() {
  return (
    <PageContainer className="space-y-8 py-10">
      <header className="space-y-3">
        <Badge variant="secondary">用户中心骨架</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">用户中心</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          统一身份认证接入后，这里将展示当前用户资料、账号安全和通知设置。未认证访问将由服务端重定向到登录入口。
        </p>
      </header>

      <Alert variant="warning">
        <AlertTitle>认证尚未实现</AlertTitle>
        <AlertDescription>
          当前页面不读取任何用户信息，也没有登录状态。前端路由保护只能改善体验，真正的授权校验必须由
          Rust API 执行。
        </AlertDescription>
      </Alert>

      <div className="grid gap-5 md:grid-cols-3">
        {pendingSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <span className="mb-2 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <section.icon className="size-5" aria-hidden="true" />
              </span>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription className="leading-relaxed">{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="muted">待实现</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            统一认证入口规划
          </CardTitle>
          <CardDescription>
            登录、登出、会话刷新和 CSRF 令牌将由 API 提供；前端只保存服务端签发的安全 Cookie。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/forum">前往论坛</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">返回首页</Link>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
