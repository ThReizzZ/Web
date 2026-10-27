"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getBrowserApiClient } from "@/lib/api/browser";
import { submitWhitelistApplication } from "@/services/content";

export function WhitelistApplyCard() {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setFeedback("请填写申请说明。");
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      await submitWhitelistApplication(getBrowserApiClient(), {
        message: message.trim(),
      });
      setMessage("");
      setFeedback("申请已提交，等待管理员审核。审核通过后所有需要白名单的服务器通用。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "提交失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        白名单为全服共享：审核通过一次后，所有开启白名单的服务器都可以进入。
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="account-whitelist-message">申请说明</Label>
        <textarea
          id="account-whitelist-message"
          required
          rows={4}
          maxLength={2000}
          placeholder="说明你的 KZ 经验、常玩的服务器和希望加入的原因。"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
        提交全服白名单申请
      </Button>
    </form>
  );
}
