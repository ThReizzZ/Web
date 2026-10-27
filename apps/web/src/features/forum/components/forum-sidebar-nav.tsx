"use client";

import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ForumCategoryIcon, categoryTone } from "@/features/forum/components/forum-category-icon";
import type { ForumCategory } from "@/features/forum/types";
import { cn } from "@/lib/utils";

export function ForumSidebarNav({ categories }: { categories: ForumCategory[] }) {
  const pathname = usePathname();
  const totalTopics = categories.reduce((total, category) => total + category.topicCount, 0);
  const allActive =
    pathname === "/forum" || pathname === "/forum/new" || pathname.startsWith("/forum/topic/");

  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-1 lg:gap-0.5">
      <li>
        <Link
          href="/forum"
          aria-current={allActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
            allActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-foreground/70">
            <MessageSquareText className="size-3.5" aria-hidden="true" />
          </span>
          <span className="truncate">全部主题</span>
          <span className="ml-auto text-[11px] tabular-nums">{totalTopics}</span>
        </Link>
      </li>
      {categories.map((category) => {
        const active = pathname === `/forum/${category.slug}`;
        return (
          <li key={category.slug}>
            <Link
              href={`/forum/${category.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md",
                  categoryTone[category.icon],
                )}
              >
                <ForumCategoryIcon icon={category.icon} className="size-3.5" />
              </span>
              <span className="truncate">{category.name}</span>
              <span className="ml-auto text-[11px] tabular-nums">{category.topicCount}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
