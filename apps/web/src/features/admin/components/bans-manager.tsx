"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban as BanIcon, LoaderCircle, ShieldCheck, Undo2 } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Ban } from "@/features/admin/types";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import { createBan, liftBan } from "@/services/content";

const durations = [
  { label: "永久", value: "permanent" },
  { label: "24 小时", value: "24" },
  { label: "7 天", value: "168" },
  { label: "30 天", value: "720" },
] as const;

export function BansManager({ bans: initialBans }: { bans: Ban[] }) {
  const router = useRouter();
  const [bans, setBans] = useState(initialBans);
  const [steamId64, setSteamId64] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<(typeof durations)[number]["value"]>("permanent");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const activeCount = bans.filter((ban) => ban.isActive).length;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!/^\d{17}$/.test(steamId64.trim())) {
      setFeedback("SteamID64 必须是 17 位数字。");
      return;
    }
    if (!reason.trim()) {
      setFeedback("请填写封禁原因。");
      return;
    }
    setBusy("create");
    try {
      const ban = await createBan(getBrowserApiClient(), {
        steamId64: steamId64.trim(),
        playerName: playerName.trim() || undefined,
        reason: reason.trim(),
        expiresInHours: duration === "permanent" ? null : Number(duration),
      });
      setBans((current) => [ban, ...current]);
      setSteamId64("");
      setPlayerName("");
      setReason("");
      setDuration("permanent");
      setFeedback("封禁已创建，该玩家的现有会话已失效。");
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "封禁失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function handleLift(ban: Ban) {
    const reasonText = window.prompt(`解封 ${ban.playerName} 的原因（可选）`) ?? undefined;
    if (reasonText === undefined) {
      return;
    }
    setBusy(ban.id);
    setFeedback(null);
    try {
      await liftBan(getBrowserApiClient(), ban.id, reasonText);
      setBans((current) =>
        current.map((item) =>
          item.id === ban.id
            ? {
                ...item,
                isActive: false,
                liftedAt: new Date().toISOString(),
                liftReason: reasonText || null,
              }
            : item,
        ),
      );
      setFeedback("封禁已解除。");
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "解封失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">封禁</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">封禁管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            对违规玩家执行临时或永久封禁。封禁会立即撤销该 Steam 账号的网站会话，登录也会被拒绝。
          </p>
        </div>
        <Badge variant={activeCount > 0 ? "warning" : "success"}>{activeCount} 条生效封禁</Badge>
      </div>

      {feedback ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{feedback}</div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-1 min-w-0 rounded-xl border bg-card 2xl:order-1">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">封禁记录</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              有效封禁排在前面；过期或已解封的记录保留用于追溯。
            </p>
          </div>
          <div className="divide-y">
            {bans.length > 0 ? (
              bans.map((ban) => (
                <article key={ban.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <UserAvatar name={ban.playerName} avatarUrl={ban.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <p className="font-medium break-words">{ban.playerName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {ban.isActive ? (
                            <Badge variant={ban.expiresAt ? "warning" : "destructive"}>
                              <BanIcon aria-hidden="true" />
                              {ban.expiresAt ? "临时封禁" : "永久封禁"}
                            </Badge>
                          ) : (
                            <Badge variant="muted">已结束</Badge>
                          )}
                          <span className="font-mono text-[11px] break-all text-muted-foreground">
                            {ban.steamId64}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatRelativeTime(ban.createdAt)}由 {ban.createdBy}创建
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {ban.isActive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy === ban.id}
                          onClick={() => void handleLift(ban)}
                        >
                          {busy === ban.id ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Undo2 aria-hidden="true" />
                          )}
                          解封
                        </Button>
                      ) : (
                        <Badge variant="success">
                          <ShieldCheck aria-hidden="true" />
                          已失效
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">封禁原因</p>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{ban.reason}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/25 p-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">期限</dt>
                        <dd className="mt-1 font-medium">
                          {ban.expiresAt
                            ? formatDate(ban.expiresAt)
                            : ban.isActive
                              ? "永久"
                              : "已结束"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">解封信息</dt>
                        <dd className="mt-1 font-medium">
                          {ban.liftedAt
                            ? `${formatDate(ban.liftedAt)} · ${ban.liftedBy ?? "管理员"}`
                            : "未解封"}
                        </dd>
                      </div>
                      {ban.liftReason ? (
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">解封原因</dt>
                          <dd className="mt-1 break-words">{ban.liftReason}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </article>
              ))
            ) : (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                还没有封禁记录。
              </p>
            )}
          </div>
        </div>

        <div className="order-2 h-fit rounded-xl border bg-card p-5 shadow-sm 2xl:order-2">
          <h2 className="font-semibold">新增封禁</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            管理员账号不能直接被封禁；请先取消其管理员权限。
          </p>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <div className="space-y-1.5">
              <Label htmlFor="ban-steam-id">SteamID64</Label>
              <Input
                id="ban-steam-id"
                inputMode="numeric"
                pattern="[0-9]{17}"
                maxLength={17}
                placeholder="76561198000000000"
                value={steamId64}
                onChange={(event) => setSteamId64(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ban-player-name">玩家昵称（可选）</Label>
              <Input
                id="ban-player-name"
                placeholder="用于封禁记录显示"
                value={playerName}
                maxLength={80}
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2 2xl:col-span-1">
              <Label htmlFor="ban-duration">封禁时长</Label>
              <select
                id="ban-duration"
                value={duration}
                onChange={(event) => setDuration(event.target.value as typeof duration)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {durations.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2 2xl:col-span-1">
              <Label htmlFor="ban-reason">封禁原因</Label>
              <textarea
                id="ban-reason"
                required
                maxLength={2000}
                rows={4}
                placeholder="记录具体违规行为、时间、证据或服务器日志摘要。"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button
              type="submit"
              className="w-full md:col-span-2 2xl:col-span-1"
              disabled={busy === "create"}
            >
              {busy === "create" ? <LoaderCircle className="animate-spin" /> : <BanIcon />}
              创建封禁
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
