"use client";

import { useEffect, useState } from "react";
import {
  Ban as BanIcon,
  Globe2,
  LoaderCircle,
  Network,
  Plus,
  Server as ServerIcon,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { AdminServer, ServerBan, ServerIpBan } from "@/features/admin/types";
import { formatDate } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import {
  createServerBan,
  createServerIpBan,
  fetchServerBans,
  fetchServerIpBans,
  liftServerBan,
  liftServerIpBan,
} from "@/services/content";

const durations = [
  { label: "永久", value: "permanent" },
  { label: "24 小时", value: "24" },
  { label: "7 天", value: "168" },
  { label: "30 天", value: "720" },
] as const;

type BanTab = "server" | "ip";
type BanStatusFilter = "active" | "ended" | "all";

function isValidIp(value: string): boolean {
  const trimmed = value.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return trimmed.split(".").every((part) => Number(part) <= 255);
  }
  return /^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(":");
}

function expiryHours(value: string): number | null {
  return value === "permanent" ? null : Number(value);
}

function banStatus(ban: Pick<ServerBan, "isActive" | "expiresAt" | "liftedAt">): {
  label: string;
  variant: "warning" | "muted";
} {
  if (ban.isActive) return { label: "生效中", variant: "warning" };
  if (ban.liftedAt) return { label: "已解封", variant: "muted" };
  if (ban.expiresAt) return { label: "已过期", variant: "muted" };
  return { label: "已结束", variant: "muted" };
}

export function BansManager({
  serverBans: initialServerBans,
  ipBans: initialIpBans,
  servers,
}: {
  serverBans: ServerBan[];
  ipBans: ServerIpBan[];
  servers: Pick<AdminServer, "id" | "name">[];
}) {
  const [serverBans, setServerBans] = useState(initialServerBans);
  const [ipBans, setIpBans] = useState(initialIpBans);
  const [tab, setTab] = useState<BanTab>("server");
  const [statusFilter, setStatusFilter] = useState<BanStatusFilter>("active");
  const [showBan, setShowBan] = useState(false);
  const [showIpBan, setShowIpBan] = useState(false);
  const [steamId64, setSteamId64] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [scope, setScope] = useState<"global" | "server">("global");
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<(typeof durations)[number]["value"]>("permanent");
  const [ipAddress, setIpAddress] = useState("");
  const [ipReason, setIpReason] = useState("");
  const [ipDuration, setIpDuration] = useState<(typeof durations)[number]["value"]>("permanent");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [liftServerTarget, setLiftServerTarget] = useState<ServerBan | null>(null);
  const [liftIpTarget, setLiftIpTarget] = useState<ServerIpBan | null>(null);
  const { toast } = useToast();

  const activeServerBans = serverBans.filter((ban) => ban.isActive).length;
  const activeIpBans = ipBans.filter((ban) => ban.isActive).length;
  const endedServerBans = serverBans.length - activeServerBans;
  const endedIpBans = ipBans.length - activeIpBans;
  const activeTabBans = tab === "server" ? activeServerBans : activeIpBans;
  const endedTabBans = tab === "server" ? endedServerBans : endedIpBans;
  const totalTabBans = tab === "server" ? serverBans.length : ipBans.length;

  function matchesStatus(isActive: boolean): boolean {
    if (statusFilter === "all") return true;
    return statusFilter === "active" ? isActive : !isActive;
  }

  const visibleServerBans = serverBans.filter((ban) => matchesStatus(ban.isActive));
  const visibleIpBans = ipBans.filter((ban) => matchesStatus(ban.isActive));

  async function reload() {
    const client = getBrowserApiClient();
    const [nextServerBans, nextIpBans] = await Promise.all([
      fetchServerBans(client),
      fetchServerIpBans(client),
    ]);
    setServerBans(nextServerBans);
    setIpBans(nextIpBans);
  }

  async function handleCreateServerBan(event: React.FormEvent<HTMLFormElement>) {
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
    if (scope === "server" && !serverId) {
      setFeedback("请选择要封禁的服务器。");
      return;
    }
    setBusy("create-server-ban");
    try {
      await createServerBan(getBrowserApiClient(), {
        steamId64: steamId64.trim(),
        playerName: playerName.trim() || undefined,
        reason: reason.trim(),
        expiresInHours: expiryHours(duration),
        scope,
        serverId: scope === "server" ? serverId : undefined,
      });
      setSteamId64("");
      setPlayerName("");
      setReason("");
      setDuration("permanent");
      setShowBan(false);
      setTab("server");
      setStatusFilter("active");
      setFeedback("游戏服务器封禁已创建，网站账号仍可正常登录。");
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "封禁失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateIpBan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!isValidIp(ipAddress)) {
      setFeedback("请输入合法的 IPv4 或 IPv6 地址。");
      return;
    }
    if (!ipReason.trim()) {
      setFeedback("请填写封禁原因。");
      return;
    }
    setBusy("create-ip-ban");
    try {
      await createServerIpBan(getBrowserApiClient(), {
        ipAddress: ipAddress.trim(),
        reason: ipReason.trim(),
        expiresInHours: expiryHours(ipDuration),
      });
      setIpAddress("");
      setIpReason("");
      setIpDuration("permanent");
      setShowIpBan(false);
      setTab("ip");
      setStatusFilter("active");
      setFeedback("游戏 IP 封禁已创建；网站账号仍可正常登录。");
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "IP 封禁失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function handleLiftServerBan() {
    const target = liftServerTarget;
    if (!target) return;
    setBusy(target.id);
    try {
      await liftServerBan(getBrowserApiClient(), target.id);
      setLiftServerTarget(null);
      setFeedback("游戏服务器封禁已解除，玩家可以立即重新进入。");
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "解封失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function handleLiftIpBan() {
    const target = liftIpTarget;
    if (!target) return;
    setBusy(target.id);
    try {
      await liftServerIpBan(getBrowserApiClient(), target.id);
      setLiftIpTarget(null);
      setFeedback("游戏 IP 封禁已解除。");
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "解封失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!feedback) return;
    const tone = /失败|错误|不能|请先|无效|不符合|必须|请填写|请选择/.test(feedback)
      ? "error"
      : "success";
    toast(feedback, tone);
  }, [feedback, toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">游戏封禁</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">封禁管理</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            封禁只作用于游戏服务器，不会阻止网站登录。解封后插件会立即删除本地封禁，玩家无需等待。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={activeServerBans + activeIpBans > 0 ? "warning" : "success"}>
            {activeServerBans + activeIpBans} 条生效封禁
          </Badge>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowIpBan(true)}>
            <Network /> IP 封禁
          </Button>
          <Button type="button" size="sm" onClick={() => setShowBan(true)}>
            <Plus /> 封禁玩家
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="封禁类型"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "server"}
                onClick={() => setTab("server")}
                className={
                  tab === "server"
                    ? "inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                    : "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                }
              >
                <BanIcon aria-hidden="true" className="size-3.5" />
                游戏封禁
                <span className="tabular-nums">{serverBans.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "ip"}
                onClick={() => setTab("ip")}
                className={
                  tab === "ip"
                    ? "inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                    : "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                }
              >
                <Network aria-hidden="true" className="size-3.5" />
                IP 封禁
                <span className="tabular-nums">{ipBans.length}</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tab === "server"
                ? "全服封禁对所有服务器生效；单服封禁只影响对应服务器。"
                : "IP 封禁只阻止该 IP 进入游戏服务器，不影响网站登录。"}
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="封禁状态筛选"
          >
            <StatusFilterButton
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            >
              生效中 {activeTabBans}
            </StatusFilterButton>
            <StatusFilterButton
              active={statusFilter === "ended"}
              onClick={() => setStatusFilter("ended")}
            >
              已结束 {endedTabBans}
            </StatusFilterButton>
            <StatusFilterButton
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              全部 {totalTabBans}
            </StatusFilterButton>
          </div>
        </div>

        {tab === "server" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">玩家</th>
                  <th className="px-4 py-3 font-medium">范围</th>
                  <th className="px-4 py-3 font-medium">封禁原因</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">创建</th>
                  <th className="px-4 py-3 font-medium">到期</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleServerBans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-muted-foreground"
                    >
                      {statusFilter === "active"
                        ? "暂无生效中的游戏封禁。"
                        : "当前筛选下暂无游戏封禁记录。"}
                    </td>
                  </tr>
                ) : (
                  visibleServerBans.map((ban) => (
                    <ServerBanRow
                      key={ban.id}
                      ban={ban}
                      busy={busy === ban.id}
                      onLift={() => setLiftServerTarget(ban)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">IP 地址</th>
                  <th className="px-4 py-3 font-medium">封禁原因</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">创建</th>
                  <th className="px-4 py-3 font-medium">到期</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleIpBans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-muted-foreground"
                    >
                      {statusFilter === "active"
                        ? "暂无生效中的 IP 封禁。"
                        : "当前筛选下暂无 IP 封禁记录。"}
                    </td>
                  </tr>
                ) : (
                  visibleIpBans.map((ban) => (
                    <IpBanRow
                      key={ban.id}
                      ban={ban}
                      busy={busy === ban.id}
                      onLift={() => setLiftIpTarget(ban)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showBan}
        onOpenChange={setShowBan}
        title="封禁玩家"
        description="只封禁游戏服务器，网站账号仍可登录。"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowBan(false)}>
              取消
            </Button>
            <Button type="submit" form="game-ban-form" disabled={busy === "create-server-ban"}>
              {busy === "create-server-ban" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <BanIcon />
              )}
              创建封禁
            </Button>
          </div>
        }
      >
        <form
          id="game-ban-form"
          onSubmit={handleCreateServerBan}
          className="grid gap-4 md:grid-cols-2"
        >
          <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed md:col-span-2">
            游戏内封禁默认全服；这里可选择全服或单服。封禁不会影响网站登录，用户中心会显示原因。
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="game-ban-steam-id">SteamID64</Label>
            <Input
              id="game-ban-steam-id"
              inputMode="numeric"
              pattern="[0-9]{17}"
              maxLength={17}
              placeholder="76561198000000000"
              value={steamId64}
              onChange={(event) => setSteamId64(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-ban-player-name">玩家昵称（可选）</Label>
            <Input
              id="game-ban-player-name"
              value={playerName}
              maxLength={80}
              onChange={(event) => setPlayerName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-ban-scope">封禁范围</Label>
            <select
              id="game-ban-scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as "global" | "server")}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="global">全服</option>
              <option value="server">仅指定服务器</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-ban-server">服务器</Label>
            <select
              id="game-ban-server"
              value={serverId}
              disabled={scope === "global"}
              onChange={(event) => setServerId(event.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
            >
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-ban-duration">封禁时长</Label>
            <select
              id="game-ban-duration"
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
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="game-ban-reason">封禁原因</Label>
            <textarea
              id="game-ban-reason"
              required
              maxLength={1000}
              rows={4}
              placeholder="记录违规行为、时间或证据。"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={showIpBan}
        onOpenChange={setShowIpBan}
        title="游戏 IP 封禁"
        description="只阻止该 IP 进入游戏服务器，不影响网站登录。"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowIpBan(false)}>
              取消
            </Button>
            <Button type="submit" form="game-ip-ban-form" disabled={busy === "create-ip-ban"}>
              {busy === "create-ip-ban" ? <LoaderCircle className="animate-spin" /> : <Network />}
              创建 IP 封禁
            </Button>
          </div>
        }
      >
        <form id="game-ip-ban-form" onSubmit={handleCreateIpBan} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="game-ip-address">IP 地址</Label>
            <Input
              id="game-ip-address"
              placeholder="203.0.113.10 或 IPv6 地址"
              value={ipAddress}
              onChange={(event) => setIpAddress(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-ip-duration">封禁时长</Label>
            <select
              id="game-ip-duration"
              value={ipDuration}
              onChange={(event) => setIpDuration(event.target.value as typeof ipDuration)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {durations.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-ip-reason">封禁原因</Label>
            <textarea
              id="game-ip-reason"
              required
              maxLength={1000}
              rows={4}
              value={ipReason}
              onChange={(event) => setIpReason(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={liftServerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLiftServerTarget(null);
        }}
        title={liftServerTarget ? `解封 ${liftServerTarget.playerName}` : "解除游戏封禁"}
        description="解封后插件会立即删除对应封禁，玩家可以马上重新进入服务器；网站账号不受影响。"
        confirmLabel="解除封禁"
        pending={liftServerTarget !== null && busy === liftServerTarget.id}
        onConfirm={() => void handleLiftServerBan()}
      />

      <ConfirmDialog
        open={liftIpTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLiftIpTarget(null);
        }}
        title={liftIpTarget ? `解封 IP ${liftIpTarget.ipAddress}` : "解除 IP 封禁"}
        description="解封后该 IP 可以重新进入游戏服务器；网站登录不受影响。"
        confirmLabel="解除 IP 封禁"
        pending={liftIpTarget !== null && busy === liftIpTarget.id}
        onConfirm={() => void handleLiftIpBan()}
      />
    </div>
  );
}

function StatusFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          : "rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
      }
    >
      {children}
    </button>
  );
}

function ServerBanRow({
  ban,
  busy,
  onLift,
}: {
  ban: ServerBan;
  busy: boolean;
  onLift: () => void;
}) {
  const status = banStatus(ban);
  return (
    <tr className={ban.isActive ? undefined : "bg-muted/20"}>
      <td className="px-5 py-3">
        <p className="font-medium break-words">{ban.playerName}</p>
        <p className="mt-0.5 font-mono text-[11px] break-all text-muted-foreground">
          {ban.steamId64}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline">
          {ban.scope === "global" ? (
            <>
              <Globe2 aria-hidden="true" /> 全服
            </>
          ) : (
            <>
              <ServerIcon aria-hidden="true" /> {ban.serverName}
            </>
          )}
        </Badge>
      </td>
      <td className="max-w-72 px-4 py-3">
        <p className="line-clamp-2 text-xs break-words" title={ban.reason}>
          {ban.reason}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
        {formatDate(ban.createdAt)}
        <br />由 {ban.createdBy}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
        {ban.expiresAt ? formatDate(ban.expiresAt) : "永久"}
      </td>
      <td className="px-5 py-3 text-right">
        {ban.isActive ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onLift}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Undo2 aria-hidden="true" />}
            解封
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function IpBanRow({ ban, busy, onLift }: { ban: ServerIpBan; busy: boolean; onLift: () => void }) {
  const status = banStatus(ban);
  return (
    <tr className={ban.isActive ? undefined : "bg-muted/20"}>
      <td className="px-5 py-3">
        <p className="font-mono text-xs break-all">{ban.ipAddress}</p>
      </td>
      <td className="max-w-72 px-4 py-3">
        <p className="line-clamp-2 text-xs break-words" title={ban.reason}>
          {ban.reason}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
        {formatDate(ban.createdAt)}
        <br />由 {ban.createdBy}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
        {ban.expiresAt ? formatDate(ban.expiresAt) : "永久"}
      </td>
      <td className="px-5 py-3 text-right">
        {ban.isActive ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onLift}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Undo2 aria-hidden="true" />}
            解封
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
