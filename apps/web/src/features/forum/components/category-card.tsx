import { ArrowUpRight, MessageSquareText } from "lucide-react";
import Link from "next/link";

import { ForumCategoryIcon, categoryTone } from "@/features/forum/components/forum-category-icon";
import type { ForumCategory } from "@/features/forum/types";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CategoryCard({ category }: { category: ForumCategory }) {
  return (
    <Link
      href={`/forum/${category.slug}`}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn("grid size-10 place-items-center rounded-lg", categoryTone[category.icon])}
        >
          <ForumCategoryIcon icon={category.icon} />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>
      <h3 className="mt-4 font-semibold">{category.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MessageSquareText className="size-3.5" aria-hidden="true" />
          {category.topicCount} 主题
        </span>
        <span>{category.postCount.toLocaleString("zh-CN")} 回复</span>
        <span className="ml-auto">{formatRelativeTime(category.lastActivityAt)}</span>
      </div>
    </Link>
  );
}
