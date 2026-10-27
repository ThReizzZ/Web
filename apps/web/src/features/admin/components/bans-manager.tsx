"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban as BanIcon, LoaderCircle, Plus, ShieldCheck, Undo2 } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import type { Ban, ServerBan } from "@/features/admin/types";
import { formatDate } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import { useToast } from "@/components/ui/toast";
import { createBan, fetchBans, fetchServerBans, liftBan, liftServerBan } from "@/services/content";

const durations = [
  { label: "永久", value: "permanent" },
  { label: "24 小时", value: "24" },
  { label: "7 天", value: "168" },
  { label: "30 天", value: "720" },
] as const;

function isValidIp(value: string): boolean {
  const trimmed = value.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return trimmed.split(".").every((part) => Number(part) <= 255);
  }
  return /^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(":");
}

export function BansManager({
  bans: initialBans,
  serverBans: initialServerBans,
}: {
  bans: Ban[];
  serverBans: ServerBan[];
}) {
  const router = useRouter();
  const [bans, setBans] = useState(initialBans);
  const [serverBans, setServerBans] = useState(initialServerBans);
  const [banType, setBanType] = useState<"steam" | "ip">("steam");
  const [steamId64, setSteamId64] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<(typeof durations)[number]["value"]>("permanent");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [liftTarget, setLiftTarget] = useState<Ban | null>(null);
  const [, startTransition] = useTransition();

  const activeCount =
    bans.filter((ban) => ban.isActive).length + serverBans.filter((ban) => ban.isActive).length;

  function refresh() {
    startTransition(() => router.refresh());
  }

  const { toast } = useToast();

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (banType === "steam" && !/^\d{17}$/.test(steamId64.trim())) {
      setFeedback("SteamID64 必须是 17 位数字。");
      return;
    }
    if (banType === "ip" && !isValidIp(ipAddress)) {
      setFeedback("请输入合法的 IPv4 或 IPv6 地址。");
      return;
    }
    if (!reason.trim()) {
      setFeedback("请填写封禁原因。");
      return;
    }
    setBusy("create");
    try {
      const client = getBrowserApiClient();
      const ban = await createBan(client, {
        banType,
        steamId64: banType === "steam" ? steamId64.trim() : undefined,
        ipAddress: banType === "ip" ? ipAddress.trim() : undefined,
        playerName: playerName.trim() || undefined,
        reason: reason.trim(),
        expiresInHours: duration === "permanent" ? null : Number(duration),
      });
      setBans((current) => [ban, ...current]);
      // A SteamID ban may also create an IP ban on the server; re-fetch so it
      // appears immediately instead of only after a full page reload.
      try {
        const [freshBans, freshServerBans] = await Promise.all([
          fetchBans(client),
          fetchServerBans(client),
        ]);
        setBans(freshBans);
        setServerBans(freshServerBans);
      } catch {
        // Keep the optimistic entry; a later refresh still shows server state.
      }
      setSteamId64("");
      setIpAddress("");
      setPlayerName("");
      setReason("");
      setDuration("permanent");
      setFeedback(
        banType === "ip"
          ? "IP 封禁已创建，该 IP 下已知的普通账号已自动封禁。"
          : "封禁已创建，该玩家的现有会话已失效；如存在已知 IP，也已自动创建 IP 封禁。",
      );
      setShowCreate(false);
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "封禁失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function handleLift(ban: Ban) {
    setBusy(ban.id);
    setFeedback(null);
    try {
      await liftBan(getBrowserApiClient(), ban.id);
      setBans((current) =>
        current.map((item) =>
          item.id === ban.id || (ban.banType === "ip" && item.sourceBanId === ban.id)
            ? {
                ...item,
                isActive: false,
                liftedAt: new Date().toISOString(),
                liftReason: null,
              }
            : item,
        ),
      );
      setLiftTarget(null);
      setFeedback(
        ban.banType === "ip"
          ? "IP 封禁已解除，由该 IP 自动关联的账号封禁也已解除。"
          : "封禁已解除。",
      );
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "解封失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function handleLiftServerBan(ban: ServerBan) {
    setBusy(ban.id);
    setFeedback(null);
    try {
      await liftServerBan(getBrowserApiClient(), ban.id);
      setServerBans((current) =>
        current.map((item) =>
          item.id === ban.id
            ? {
                ...item,
                isActive: false,
                liftedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setFeedback("游戏服务器封禁已解除。");
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "解封失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (feedback) {
      const tone = /失败|错误|不能|请先|无效|不符合/.test(feedback) ? "error" : "success";
      toast(feedback, tone);
    }
  }, [feedback, toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">封禁</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">封禁管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            网站账号封禁会立即撤销该 Steam 账号的网站会话，并自动尝试封禁其最近 IP；IP 封禁会拦截该
            IP 的网站登录并自动关联普通账号。游戏服务器封禁显示在下方，由插件在游戏内执行。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={activeCount > 0 ? "warning" : "success"}>{activeCount} 条生效封禁</Badge>
          <Button type="button" size="sm" onClick={() => setShowCreate((value) => !value)}>
            <Plus /> {showCreate ? "收起表单" : "新增封禁"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="min-w-0 rounded-xl border bg-card">
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
                          <Badge variant={ban.banType === "ip" ? "destructive" : "outline"}>
                            {ban.banType === "ip" ? "IP 封禁" : "Steam 封禁"}
                          </Badge>
                          {ban.sourceBanId ? <Badge variant="warning">IP 自动关联</Badge> : null}
                          <span className="font-mono text-[11px] break-all text-muted-foreground">
                            {ban.banType === "ip" ? `IP: ${ban.ipAddress}` : ban.steamId64}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatDate(ban.createdAt)}由 {ban.createdBy}创建
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
                          onClick={() => setLiftTarget(ban)}
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

        <div className="min-w-0 rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">游戏服务器封禁</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              全服封禁对所有服务器生效；单服封禁只影响对应服务器。游戏内封禁由服务器插件执行。
            </p>
          </div>
          <div className="divide-y">
            {serverBans.length > 0 ? (
              serverBans.map((ban) => (
                <article key={ban.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <UserAvatar name={ban.playerName} avatarUrl={ban.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <p className="font-medium break-words">{ban.playerName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              ban.isActive ? (ban.expiresAt ? "warning" : "destructive") : "muted"
                            }
                          >
                            {ban.isActive ? (ban.expiresAt ? "临时封禁" : "永久封禁") : "已结束"}
                          </Badge>
                          <Badge variant="outline">
                            {ban.scope === "global" ? "全服" : ban.serverName}
                          </Badge>
                          <span className="font-mono text-[11px] break-all text-muted-foreground">
                            {ban.steamId64}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatDate(ban.createdAt)}由 {ban.createdBy}创建
                        </p>
                        <p className="mt-2 text-sm break-words">{ban.reason}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                      <span className="text-xs text-muted-foreground">
                        {ban.expiresAt ? `${formatDate(ban.expiresAt)} 到期` : "永久"}
                      </span>
                      {ban.isActive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy === ban.id}
                          onClick={() => void handleLiftServerBan(ban)}
                        >
                          {busy === ban.id ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Undo2 aria-hidden="true" />
                          )}
                          解封
                        </Button>
                      ) : (
                        <Badge variant="success">已失效</Badge>
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                还没有游戏服务器封禁记录。
              </p>
            )}
          </div>
        </div>

        <Modal
          open={showCreate}
          onOpenChange={setShowCreate}
          title="新增封禁"
          description="按 SteamID64 或 IP 执行临时/永久封禁。"
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit" form="ban-create-form" disabled={busy === "create"}>
                {busy === "create" ? <LoaderCircle className="animate-spin" /> : <BanIcon />}
                创建封禁
              </Button>
            </div>
          }
        >
          <form id="ban-create-form" onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <Alert variant="warning" className="md:col-span-2">
              <AlertDescription>
                管理员账号不能直接被封禁；请先在管理员页面取消其权限。封禁会撤销目标网站会话。 IP
                封禁会同时封禁该 IP 下已知的普通账号；管理员账号不会被自动封禁。
              </AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <Label htmlFor="ban-type">封禁类型</Label>
              <select
                id="ban-type"
                value={banType}
                onChange={(event) => setBanType(event.target.value as "steam" | "ip")}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="steam">SteamID64</option>
                <option value="ip">IP 地址</option>
              </select>
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
            {banType === "steam" ? (
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
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ban-ip-address">IP 地址</Label>
                <Input
                  id="ban-ip-address"
                  inputMode="text"
                  placeholder="203.0.113.10 或 IPv6 地址"
                  value={ipAddress}
                  onChange={(event) => setIpAddress(event.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
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
          </form>
        </Modal>

        <ConfirmDialog
          open={liftTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setLiftTarget(null);
            }
          }}
          title={liftTarget ? `解封 ${liftTarget.playerName}` : "解除封禁"}
          description={
            liftTarget?.banType === "ip"
              ? "解封后该 IP 可以重新登录，且由该 IP 自动关联的账号封禁会一并解除。"
              : "解封后该玩家可以重新登录网站；游戏服务器封禁需要在下方单独解除。"
          }
          confirmLabel="解除封禁"
          pending={liftTarget !== null && busy === liftTarget.id}
          onConfirm={() => liftTarget && void handleLift(liftTarget)}
        />
      </div>
    </div>
  );
}
