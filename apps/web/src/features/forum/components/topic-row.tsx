import { Eye, MessageCircle, Pin } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { getCategory, type ForumTopic } from "@/features/forum/data/forum";
import { cn } from "@/lib/utils";

export function TopicRow({
  topic,
  showCategory = false,
  className,
}: {
  topic: ForumTopic;
  showCategory?: boolean;
  className?: string;
}) {
  const category = getCategory(topic.categorySlug);

  return (
    <article className={cn("flex gap-3 border-b py-4 last:border-b-0", className)}>
      <UserAvatar name={topic.author.name} avatar={topic.author.avatar} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {topic.pinned ? (
            <Pin className="size-3.5 shrink-0 text-primary" aria-label="置顶主题" />
          ) : null}
          <Link
            href={`/forum/topic/${topic.id}`}
            className="font-medium transition-colors hover:text-primary"
          >
            {topic.title}
          </Link>
          {topic.hot ? <Badge variant="warning">热门</Badge> : null}
          {showCategory && category ? <Badge variant="muted">{category.name}</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{topic.excerpt}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span>{topic.author.name}</span>
            <span className="text-border">·</span>
            <span>{topic.author.role}</span>
          </span>
          <span>{topic.lastActivity}</span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            {topic.replies.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" aria-hidden="true" />
            {topic.views.toLocaleString("zh-CN")}
          </span>
        </div>
      </div>
    </article>
  );
}
