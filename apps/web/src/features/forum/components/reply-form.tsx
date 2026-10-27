"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getBrowserApiClient } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { createForumReply } from "@/services/content";

const REPLY_MAX = 20_000;

export function ReplyForm({ topicSlug }: { topicSlug: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError("请填写回复内容。");
      return;
    }

    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      await createForumReply(getBrowserApiClient(), topicSlug, trimmed);
      setContent("");
      setFeedback("回复已发布。");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError && submitError.status === 401
          ? "登录状态已失效，请刷新页面后重新登录。"
          : submitError instanceof Error
            ? submitError.message
            : "回复失败，请稍后重试。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="forum-reply-content">回复</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {content.length}/{REPLY_MAX}
          </span>
        </div>
        <textarea
          id="forum-reply-content"
          required
          rows={5}
          maxLength={REPLY_MAX}
          placeholder="写下你的回复…"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-foreground"
        >
          {error}
        </p>
      ) : null}
      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
          {pending ? "发送中…" : "发表回复"}
        </Button>
      </div>
    </form>
  );
}
