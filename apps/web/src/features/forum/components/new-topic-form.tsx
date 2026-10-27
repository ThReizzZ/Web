"use client";

import { LoaderCircle, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ForumCategory } from "@/features/forum/types";
import { getBrowserApiClient } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { createForumTopic } from "@/services/content";

const TITLE_MAX = 200;
const CONTENT_MAX = 100_000;

export function NewTopicForm({
  categories,
  defaultCategory,
}: {
  categories: ForumCategory[];
  defaultCategory?: string;
}) {
  const router = useRouter();
  const initialCategory =
    categories.find((category) => category.slug === defaultCategory)?.slug ??
    categories[0]?.slug ??
    "";
  const [categorySlug, setCategorySlug] = useState(initialCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const parsedTags = tags
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (!categorySlug) {
      setError("请选择分类。");
      return;
    }
    if (!trimmedTitle) {
      setError("请填写标题。");
      return;
    }
    if (!trimmedContent) {
      setError("请填写正文。");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const topic = await createForumTopic(getBrowserApiClient(), {
        categorySlug,
        title: trimmedTitle,
        content: trimmedContent,
        tags: parsedTags,
      });
      router.push(`/forum/topic/${encodeURIComponent(topic.slug)}`);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError && submitError.status === 401
          ? "登录状态已失效，请刷新页面后重新登录。"
          : submitError instanceof Error
            ? submitError.message
            : "发布失败，请稍后重试。",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="forum-topic-category">分类</Label>
        <select
          id="forum-topic-category"
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="forum-topic-title">标题</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {title.length}/{TITLE_MAX}
          </span>
        </div>
        <Input
          id="forum-topic-title"
          required
          maxLength={TITLE_MAX}
          placeholder="用一句话概括你的主题"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="forum-topic-content">正文</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {content.length}/{CONTENT_MAX}
          </span>
        </div>
        <textarea
          id="forum-topic-content"
          required
          rows={14}
          maxLength={CONTENT_MAX}
          placeholder="写下你想讨论的内容。支持换行，暂不支持 Markdown。"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="forum-topic-tags">标签（可选）</Label>
        <Input
          id="forum-topic-tags"
          maxLength={140}
          placeholder="例如：地图推荐, 连跳, 求助"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">最多 5 个标签，用逗号或空格分隔。</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-foreground"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href="/forum">取消</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <PenLine />}
          {pending ? "发布中…" : "发布主题"}
        </Button>
      </div>
    </form>
  );
}
