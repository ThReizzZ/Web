import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "页面不存在",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center gap-5 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">页面不存在</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          该地址尚未实现、已被移除，或者标识格式不正确。
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">返回首页</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/forum">前往论坛</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
