import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminNav } from "@/features/admin/components/admin-nav";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getServerApiClient } from "@/lib/api/server";
import { fetchMe } from "@/services/content";

export const metadata: Metadata = {
  title: "管理面板",
  description: "ThRei 社区运营管理面板。",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const client = await getServerApiClient();
  let user;
  try {
    user = (await fetchMe(client)).user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/account");
  }
  if (user.role !== "admin") {
    redirect("/");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col bg-muted/25">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 2xl:px-10">
            <div className="flex items-center gap-3">
              <Brand />
              <Badge variant="outline">管理面板</Badge>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                {user.name}
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link href="/">
                  <ArrowLeft aria-hidden="true" />
                  返回官网
                </Link>
              </Button>
            </div>
          </div>
          <div className="w-full border-t px-4 py-2 sm:px-6 lg:hidden lg:px-8">
            <AdminNav className="flex flex-wrap gap-1 pb-1" />
          </div>
        </header>

        <div className="flex w-full flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8 2xl:gap-8 2xl:px-10">
          <aside className="hidden w-56 shrink-0 xl:block 2xl:w-60">
            <div className="sticky top-24 rounded-xl border bg-background p-3 shadow-sm">
              <AdminNav />
            </div>
          </aside>

          <main id="main-content" className="min-w-0 flex-1 space-y-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
