"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { KzServer } from "@/features/servers/data/servers";
import { getBrowserApiClient } from "@/lib/api/browser";
import { submitWhitelistApplication } from "@/services/content";

export function WhitelistApplyCard({ servers }: { servers: Pick<KzServer, "id" | "name">[] }) {
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serverId || !message.trim()) {
      setFeedback("请选择服务器并填写申请说明。");
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      await submitWhitelistApplication(getBrowserApiClient(), {
        serverId,
        message: message.trim(),
      });
      setMessage("");
      setFeedback("申请已提交，等待管理员审核。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "提交失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="account-whitelist-server">服务器</Label>
        <select
          id="account-whitelist-server"
          value={serverId}
          onChange={(event) => setServerId(event.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-whitelist-message">申请说明</Label>
        <textarea
          id="account-whitelist-message"
          required
          rows={4}
          maxLength={2000}
          placeholder="说明你常玩的服务器、KZ 经验和希望加入的原因。"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
        提交白名单申请
      </Button>
    </form>
  );
}
