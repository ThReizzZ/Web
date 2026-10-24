"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Gamepad2,
  LoaderCircle,
  Plus,
  Server,
  Trash2,
  Undo2,
  UserMinus,
  Wifi,
  WifiOff,
} from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import type { AdminServer, ServerAdminOverview, ServerBan } from "@/features/admin/types";
import { formatDate } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import { useToast } from "@/components/ui/toast";
import {
  banServerPlayer,
  createAdminServer,
  deleteAdminServer,
  fetchAdminServers,
  kickServerPlayer,
  liftServerBan,
  setAdminServerActive,
} from "@/services/content";

const initialForm = {
  id: "",
  name: "",
  map: "",
  description: "",
  status: "online",
  host: "",
  port: "27015",
  region: "",
  tickrate: "128",
  maxPlayers: "32",
  tags: "",
  mapImage: "",
  featured: false,
  requiresWhitelist: false,
};

export function ServerAdminManager({ initial }: { initial: ServerAdminOverview }) {
  const [servers, setServers] = useState(initial.servers);
  const [bans, setBans] = useState(initial.bans);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminServer | null>(null);

  const { toast } = useToast();

  async function reload() {
    const data = await fetchAdminServers(getBrowserApiClient());
    setServers(data.servers);
    setBans(data.bans);
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add");
    setFeedback(null);
    try {
      await createAdminServer(getBrowserApiClient(), {
        ...form,
        port: Number(form.port),
        tickrate: Number(form.tickrate),
        maxPlayers: Number(form.maxPlayers),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setForm(initialForm);
      setShowAdd(false);
      setFeedback("服务器已添加。");
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "添加服务器失败。");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(server: AdminServer) {
    setBusy(`server-active-${server.id}`);
    setFeedback(null);
    try {
      await setAdminServerActive(getBrowserApiClient(), server.id, !server.isActive);
      setServers((current) =>
        current.map((item) =>
          item.id === server.id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
      setFeedback(server.isActive ? "服务器已停用。" : "服务器已启用。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setBusy(null);
    }
  }

  async function removeServer(server: AdminServer) {
    setBusy(`server-delete-${server.id}`);
    try {
      await deleteAdminServer(getBrowserApiClient(), server.id);
      setServers((current) => current.filter((item) => item.id !== server.id));
      setBans((current) => current.filter((item) => item.serverId !== server.id));
      setDeleteTarget(null);
      setFeedback("服务器已删除。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "删除服务器失败。");
    } finally {
      setBusy(null);
    }
  }

  async function kick(server: AdminServer, player: AdminServer["players"][number]) {
    const reason = window.prompt(`踢出 ${player.name} 的原因`, "管理员操作");
    if (!reason) {
      return;
    }
    setBusy(`kick-${server.id}-${player.steamId64}`);
    try {
      await kickServerPlayer(getBrowserApiClient(), server.id, player.steamId64, reason);
      setServers((current) =>
        current.map((item) =>
          item.id === server.id
            ? {
                ...item,
                players: item.players.filter((p) => p.steamId64 !== player.steamId64),
              }
            : item,
        ),
      );
      setFeedback(`已提交踢出 ${player.name} 的指令。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "踢出失败。");
    } finally {
      setBusy(null);
    }
  }

  async function ban(server: AdminServer, player: AdminServer["players"][number]) {
    const reason = window.prompt(`封禁 ${player.name} 的原因`, "违反服务器规则");
    if (!reason) {
      return;
    }
    if (!window.confirm(`确认在 ${server.name} 封禁 ${player.name}？`)) {
      return;
    }
    setBusy(`ban-${server.id}-${player.steamId64}`);
    try {
      await banServerPlayer(getBrowserApiClient(), server.id, player.steamId64, {
        reason,
        playerName: player.name,
        expiresInHours: null,
      });
      setServers((current) =>
        current.map((item) =>
          item.id === server.id
            ? {
                ...item,
                players: item.players.filter((p) => p.steamId64 !== player.steamId64),
              }
            : item,
        ),
      );
      setFeedback(`已在 ${server.name} 封禁 ${player.name}。`);
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "封禁失败。");
    } finally {
      setBusy(null);
    }
  }

  async function unban(ban: ServerBan) {
    setBusy(`unban-${ban.id}`);
    try {
      await liftServerBan(getBrowserApiClient(), ban.id);
      setBans((current) =>
        current.map((item) =>
          item.id === ban.id
            ? { ...item, isActive: false, liftedAt: new Date().toISOString() }
            : item,
        ),
      );
      setFeedback("服务器封禁已解除。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "解封失败。");
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
          <p className="text-sm font-medium text-primary">服务器</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">服务器管理</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            添加或删除服务器、启用/停用节点、查看在线玩家，并提交踢出或服务器封禁指令。
          </p>
        </div>
        <Button type="button" onClick={() => setShowAdd((value) => !value)}>
          <Plus /> {showAdd ? "收起表单" : "添加服务器"}
        </Button>
      </div>

      <Modal
        open={showAdd}
        onOpenChange={setShowAdd}
        title="添加服务器"
        description="添加后立即写入服务器目录，并可在白名单页面配置白名单要求。"
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
              取消
            </Button>
            <Button type="submit" form="server-add-form" disabled={busy === "add"}>
              {busy === "add" ? <LoaderCircle className="animate-spin" /> : <Plus />}
              确认添加
            </Button>
          </div>
        }
      >
        <form id="server-add-form" onSubmit={handleAdd} className="space-y-6">
          <Alert variant="info">
            <AlertDescription>
              踢出/封禁指令需要游戏服务器插件消费；服务器在线玩家由插件上报。
            </AlertDescription>
          </Alert>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">基本信息</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="服务器 ID" htmlFor="server-id">
                <Input
                  id="server-id"
                  placeholder="kz-beginner"
                  value={form.id}
                  onChange={(event) => setForm({ ...form, id: event.target.value })}
                  required
                />
              </Field>
              <Field label="服务器名称" htmlFor="server-name">
                <Input
                  id="server-name"
                  placeholder="KZ | Beginner"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="地图" htmlFor="server-map">
                <Input
                  id="server-map"
                  placeholder="kz_beginner"
                  value={form.map}
                  onChange={(event) => setForm({ ...form, map: event.target.value })}
                  required
                />
              </Field>
              <Field label="地区" htmlFor="server-region">
                <Input
                  id="server-region"
                  placeholder="华东"
                  value={form.region}
                  onChange={(event) => setForm({ ...form, region: event.target.value })}
                />
              </Field>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="server-description">描述</Label>
                <textarea
                  id="server-description"
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t pt-5">
            <h3 className="text-sm font-semibold">网络与运行状态</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Host / IP" htmlFor="server-host">
                <Input
                  id="server-host"
                  placeholder="kz01.example.com"
                  value={form.host}
                  onChange={(event) => setForm({ ...form, host: event.target.value })}
                  required
                />
              </Field>
              <Field label="端口" htmlFor="server-port">
                <Input
                  id="server-port"
                  type="number"
                  value={form.port}
                  onChange={(event) => setForm({ ...form, port: event.target.value })}
                  required
                />
              </Field>
              <Field label="状态" htmlFor="server-status">
                <select
                  id="server-status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="online">在线</option>
                  <option value="maintenance">维护中</option>
                  <option value="offline">离线</option>
                </select>
              </Field>
              <Field label="Tickrate" htmlFor="server-tickrate">
                <Input
                  id="server-tickrate"
                  type="number"
                  value={form.tickrate}
                  onChange={(event) => setForm({ ...form, tickrate: event.target.value })}
                />
              </Field>
              <Field label="最大玩家数" htmlFor="server-max-players">
                <Input
                  id="server-max-players"
                  type="number"
                  value={form.maxPlayers}
                  onChange={(event) => setForm({ ...form, maxPlayers: event.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t pt-5">
            <h3 className="text-sm font-semibold">展示与访问</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="标签（逗号分隔）" htmlFor="server-tags">
                <Input
                  id="server-tags"
                  placeholder="新手, 教学, 计时"
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                />
              </Field>
              <Field label="地图图片 URL" htmlFor="server-image">
                <Input
                  id="server-image"
                  placeholder="https://... 或 /images/..."
                  value={form.mapImage}
                  onChange={(event) => setForm({ ...form, mapImage: event.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => setForm({ ...form, featured: event.target.checked })}
                />
                推荐服务器
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.requiresWhitelist}
                  onChange={(event) =>
                    setForm({ ...form, requiresWhitelist: event.target.checked })
                  }
                />
                需要白名单
              </label>
            </div>
          </section>
        </form>
      </Modal>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Server className="size-4 text-primary" /> 服务器列表
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              在线玩家来自服务器插件上报；踢出/封禁会写入待处理指令队列。
            </p>
          </div>
          <Badge variant="secondary">{servers.length} 个服务器</Badge>
        </div>
        <div className="divide-y">
          {servers.length > 0 ? (
            servers.map((server) => (
              <article key={server.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Gamepad2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium break-words">{server.name}</p>
                        <Badge variant={server.isActive ? "success" : "muted"}>
                          {server.isActive ? "启用" : "停用"}
                        </Badge>
                        <Badge variant="muted">{server.map}</Badge>
                        {server.requiresWhitelist ? (
                          <Tooltip label="该服务器需要白名单审核">
                            <Badge variant="warning">白名单</Badge>
                          </Tooltip>
                        ) : null}
                        {server.featured ? <Badge variant="secondary">推荐</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {server.host}:{server.port} · {server.region || "未设置地区"} ·{" "}
                        {server.tickrate} tick · {server.players.length}/{server.maxPlayers} 在线
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {server.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === `server-active-${server.id}`}
                      onClick={() => void toggleActive(server)}
                    >
                      {server.isActive ? <WifiOff /> : <Wifi />}
                      {server.isActive ? "停用" : "启用"}
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/admin/whitelist">白名单</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy === `server-delete-${server.id}`}
                      onClick={() => setDeleteTarget(server)}
                    >
                      <Trash2 /> 删除
                    </Button>
                  </div>
                </div>

                {server.players.length > 0 ? (
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground">在线玩家</p>
                    <div className="mt-2 divide-y">
                      {server.players.map((player) => (
                        <div
                          key={player.steamId64}
                          className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <UserAvatar name={player.name} avatarUrl={player.avatarUrl} size="xs" />
                            <div className="min-w-0">
                              <p className="text-sm break-words">{player.name}</p>
                              <p className="font-mono text-[10px] break-all text-muted-foreground">
                                {player.steamId64}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy === `kick-${server.id}-${player.steamId64}`}
                              onClick={() => void kick(server, player)}
                            >
                              <UserMinus /> 踢出
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy === `ban-${server.id}-${player.steamId64}`}
                              onClick={() => void ban(server, player)}
                            >
                              <Ban /> 封禁
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              还没有服务器记录。点击“添加服务器”开始。
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Ban className="size-4 text-primary" /> 服务器封禁
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            服务器封禁只影响对应服务器；网站登录封禁仍由封禁管理页维护。
          </p>
        </div>
        <div className="divide-y">
          {bans.length > 0 ? (
            bans.map((ban) => (
              <article
                key={ban.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar name={ban.playerName} avatarUrl={ban.avatarUrl} size="md" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{ban.playerName}</p>
                      <Badge variant={ban.isActive ? "warning" : "muted"}>
                        {ban.isActive ? "生效中" : "已结束"}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                      {ban.steamId64}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ban.serverName} · {ban.reason}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:justify-end">
                  <span>
                    {formatDate(ban.createdAt)}由 {ban.createdBy}
                  </span>
                  <span>{ban.expiresAt ? `${formatDate(ban.expiresAt)} 到期` : "永久"}</span>
                  {ban.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === `unban-${ban.id}`}
                      onClick={() => void unban(ban)}
                    >
                      <Undo2 /> 解封
                    </Button>
                  ) : (
                    <Badge variant="success">已结束</Badge>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              还没有服务器封禁记录。
            </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={deleteTarget ? `删除服务器「${deleteTarget.name}」` : "删除服务器"}
        description="服务器及其白名单、服务器封禁和在线记录会一起删除，此操作不可撤销。"
        confirmLabel="删除服务器"
        destructive
        pending={deleteTarget !== null && busy === `server-delete-${deleteTarget.id}`}
        onConfirm={() => deleteTarget && void removeServer(deleteTarget)}
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
