import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminNav } from "@/features/admin/components/admin-nav";
import { Brand } from "@/components/layout/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "管理面板",
  description: "ThRei 社区运营管理面板。",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/25">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Brand />
            <Badge variant="outline">管理面板</Badge>
            <Badge variant="warning">演示数据</Badge>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              返回官网
            </Link>
          </Button>
        </div>
        <div className="mx-auto max-w-7xl border-t px-4 py-2 sm:px-6 lg:hidden lg:px-8">
          <AdminNav className="flex gap-1 overflow-x-auto pb-1" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 rounded-xl border bg-background p-3 shadow-sm">
            <AdminNav />
          </div>
        </aside>

        <main id="main-content" className="min-w-0 flex-1 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
