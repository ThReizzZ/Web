"use client";

import { Ban, Check, Clock3, Globe2, LoaderCircle, Server as ServerIcon } from "lucide-react";
import { useState } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { AdminServerPlayer } from "@/features/admin/types";
import { cn } from "@/lib/utils";

const durations = [
  { label: "永久", value: "permanent" },
  { label: "24 小时", value: "24" },
  { label: "7 天", value: "168" },
  { label: "30 天", value: "720" },
] as const;

type DurationValue = (typeof durations)[number]["value"];
type BanScope = "global" | "server";

export interface BanPlayerSubmission {
  reason: string;
  scope: BanScope;
  expiresInHours: number | null;
}

export function BanPlayerDialog({
  open,
  onOpenChange,
  serverName,
  player,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  player: AdminServerPlayer;
  pending: boolean;
  onConfirm: (values: BanPlayerSubmission) => void;
}) {
  const [scope, setScope] = useState<BanScope>("global");
  const [duration, setDuration] = useState<DurationValue>("permanent");
  const [reason, setReason] = useState("违反服务器规则");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    if (!reason.trim()) {
      setError("请填写封禁原因。");
      return;
    }
    setError(null);
    onConfirm({
      reason: reason.trim(),
      scope,
      expiresInHours: duration === "permanent" ? null : Number(duration),
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="封禁玩家"
      description="选择封禁范围和时长。封禁只影响游戏服务器，网站账号仍可正常登录。"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button type="submit" form="ban-player-form" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Ban />}
            创建封禁
          </Button>
        </div>
      }
    >
      <form id="ban-player-form" onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3.5">
          <UserAvatar name={player.name} avatarUrl={player.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{player.name}</p>
              <Badge variant="outline">{serverName}</Badge>
            </div>
            <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
              {player.steamId64}
              {player.ipAddress ? ` · ${player.ipAddress}` : ""}
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">封禁范围</legend>
          <div role="radiogroup" aria-label="封禁范围" className="grid gap-2 sm:grid-cols-2">
            <ScopeOption
              checked={scope === "global"}
              icon={<Globe2 aria-hidden="true" />}
              title="全服封禁"
              description="所有游戏服务器"
              onSelect={() => setScope("global")}
            />
            <ScopeOption
              checked={scope === "server"}
              icon={<ServerIcon aria-hidden="true" />}
              title="仅本服"
              description={serverName}
              onSelect={() => setScope("server")}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-sm font-medium">
            <Clock3 className="size-3.5 text-muted-foreground" aria-hidden="true" />
            封禁时长
          </legend>
          <div
            role="radiogroup"
            aria-label="封禁时长"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {durations.map((item) => (
              <label
                key={item.value}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  duration === item.value
                    ? "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "bg-background text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="ban-duration"
                  value={item.value}
                  checked={duration === item.value}
                  onChange={() => setDuration(item.value)}
                  className="sr-only"
                />
                {duration === item.value ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="server-ban-reason">封禁原因</Label>
          <textarea
            id="server-ban-reason"
            required
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="记录违规行为、时间或证据。"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          {player.ipAddress
            ? `创建封禁时会同时封禁该玩家当前 IP ${player.ipAddress}；`
            : "如果网站有该玩家的最近登录 IP，也会自动创建游戏 IP 封禁；"}
          网站账号不会被封禁。
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-foreground"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function ScopeOption({
  checked,
  icon,
  title,
  description,
  onSelect,
}: {
  checked: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
        checked
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "bg-background hover:bg-accent/50",
      )}
    >
      <input
        type="radio"
        name="ban-scope"
        value={title}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      {checked ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
    </label>
  );
}
