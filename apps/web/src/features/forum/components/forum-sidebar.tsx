import { PenLine } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ForumSidebarNav } from "@/features/forum/components/forum-sidebar-nav";
import type { ForumCategory } from "@/features/forum/types";

export function ForumSidebar({ categories }: { categories: ForumCategory[] }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <Button asChild className="w-full">
        <Link href="/forum/new">
          <PenLine aria-hidden="true" />
          发布主题
        </Link>
      </Button>

      <nav aria-label="论坛分类" className="rounded-xl border bg-card p-2.5 shadow-sm">
        <p className="px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground">
          分类
        </p>
        <ForumSidebarNav categories={categories} />
      </nav>

      <div className="hidden rounded-xl border bg-muted/25 p-4 text-xs leading-relaxed text-muted-foreground lg:block">
        <p className="font-medium text-foreground">文明讨论</p>
        <p className="mt-1.5">
          请尊重不同玩法与创作风格。遇到作弊、辱骂或刷屏，可在玩家举报分类发帖，并附上截图和服务器信息。
        </p>
      </div>
    </aside>
  );
}
