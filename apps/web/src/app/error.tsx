"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center gap-5 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">页面暂时无法加载</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          请求处理过程中出现异常。可以重试，或返回首页继续浏览。错误标识：
          <span className="font-mono">{error.digest ?? "unknown"}</span>
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          重试
        </Button>
        <Button asChild variant="outline">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
