"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Check,
  Copy,
  FolderTree,
  Gamepad2,
  KeyRound,
  LoaderCircle,
  Plus,
  Radio,
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
import type {
  AdminCommunity,
  AdminServer,
  ServerAdminOverview,
  ServerBan,
} from "@/features/admin/types";
import { formatDate } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import { siteConfig } from "@/lib/site-config";
import { useToast } from "@/components/ui/toast";
import {
  banServerPlayer,
  clearAdminServerPluginToken,
  clearAdminServerRconPassword,
  createAdminServer,
  deleteAdminServer,
  fetchAdminServers,
  fetchAdminServerPluginToken,
  kickServerPlayer,
  liftServerBan,
  rotateAdminServerPluginToken,
  setAdminServerActive,
  setAdminServerCommunity,
  setAdminServerRconPassword,
} from "@/services/content";

const initialForm = {
  host: "",
  port: "27015",
  communityId: "",
};

function pluginStateLabel(state: AdminServer["pluginState"]): string {
  if (state === "connected") {
    return "插件已连接";
  }
  if (state === "waiting") {
    return "等待插件上报";
  }
  return "未接入插件";
}

function rconBadge(
  server: AdminServer,
): { label: string; variant: "success" | "warning" | "destructive" } | null {
  if (!server.hasRconPassword) {
    return null;
  }
  if (server.lastRconAt === null) {
    return { label: "RCON 待检测", variant: "warning" };
  }
  if (server.rconFailures === 0) {
    return { label: "RCON 兜底", variant: "success" };
  }
  if (server.rconFailures < 3) {
    return { label: `RCON 重试 ${server.rconFailures}/3`, variant: "warning" };
  }
  return { label: "RCON 不可达", variant: "destructive" };
}

export function ServerAdminManager({
  initial,
  communities,
}: {
  initial: ServerAdminOverview;
  communities: AdminCommunity[];
}) {
  const [servers, setServers] = useState(initial.servers);
  const [bans, setBans] = useState(initial.bans);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminServer | null>(null);
  const [pluginTarget, setPluginTarget] = useState<AdminServer | null>(null);
  const [pluginToken, setPluginToken] = useState<string | null>(null);
  const [pluginTokenLoading, setPluginTokenLoading] = useState(false);
  const [pluginTokenError, setPluginTokenError] = useState<string | null>(null);
  const [pluginApiUrl, setPluginApiUrl] = useState(`${siteConfig.url}/api/v1/plugin/report`);
  const [configCopied, setConfigCopied] = useState(false);
  const [communityTarget, setCommunityTarget] = useState<AdminServer | null>(null);
  const [communityValue, setCommunityValue] = useState("");
  const [rconTarget, setRconTarget] = useState<AdminServer | null>(null);
  const [rconPassword, setRconPassword] = useState("");
  const [rconError, setRconError] = useState<string | null>(null);

  const { toast } = useToast();

  async function reload() {
    const data = await fetchAdminServers(getBrowserApiClient());
    setServers(data.servers);
    setBans(data.bans);
    return data;
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add");
    setFeedback(null);
    try {
      const created = await createAdminServer(getBrowserApiClient(), {
        host: form.host.trim(),
        port: Number(form.port),
        communityId: form.communityId.trim() || undefined,
      });
      setForm(initialForm);
      setShowAdd(false);
      setFeedback("服务器已添加。请生成插件令牌，并把配置复制到游戏服务器。");
      try {
        const data = await reload();
        const server = data.servers.find((item) => item.id === created.id);
        if (server) {
          openPluginDialog(server);
        }
      } catch {
        // The inventory refresh is best-effort; creation already succeeded.
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "添加服务器失败。");
    } finally {
      setBusy(null);
    }
  }

  function openPluginDialog(server: AdminServer) {
    setPluginTarget(server);
    setPluginToken(null);
    setPluginTokenError(null);
    setConfigCopied(false);
    setPluginApiUrl(`${siteConfig.url}/api/v1/plugin/report`);
    void loadPluginToken(server.id);
  }

  function closePluginDialog() {
    setPluginTarget(null);
    setPluginToken(null);
    setPluginTokenError(null);
    setPluginTokenLoading(false);
  }

  async function loadPluginToken(serverId: string) {
    setPluginTokenLoading(true);
    setPluginTokenError(null);
    try {
      const token = await fetchAdminServerPluginToken(getBrowserApiClient(), serverId);
      setPluginToken(token);
    } catch (error) {
      setPluginTokenError(error instanceof Error ? error.message : "读取插件令牌失败。");
    } finally {
      setPluginTokenLoading(false);
    }
  }

  async function generatePluginToken() {
    if (!pluginTarget) {
      return;
    }
    const targetId = pluginTarget.id;
    setBusy(`plugin-token-${targetId}`);
    setFeedback(null);
    try {
      const token = await rotateAdminServerPluginToken(getBrowserApiClient(), targetId);
      setPluginToken(token);
      setPluginTokenError(null);
      setConfigCopied(false);
      setFeedback("插件令牌已生成。旧令牌立即失效，请更新服务器配置。");
      try {
        const data = await reload();
        const updated = data.servers.find((server) => server.id === targetId);
        if (updated) {
          setPluginTarget(updated);
        }
      } catch {
        // Token creation succeeded; the list will refresh on the next action.
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "生成插件令牌失败。");
    } finally {
      setBusy(null);
    }
  }

  async function revokePluginToken() {
    if (!pluginTarget) {
      return;
    }
    const target = pluginTarget;
    if (
      !window.confirm(`撤销「${target.name}」的插件令牌？插件将立即无法上报，在线状态会变为离线。`)
    ) {
      return;
    }
    setBusy(`plugin-token-${target.id}`);
    setFeedback(null);
    try {
      await clearAdminServerPluginToken(getBrowserApiClient(), target.id);
      setPluginToken(null);
      setPluginTokenError(null);
      setConfigCopied(false);
      setFeedback("插件令牌已撤销。");
      try {
        const data = await reload();
        const updated = data.servers.find((server) => server.id === target.id);
        if (updated) {
          setPluginTarget(updated);
        }
      } catch {
        // Revocation already succeeded.
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "撤销插件令牌失败。");
    } finally {
      setBusy(null);
    }
  }

  async function copyPluginConfig() {
    if (!pluginTarget || !pluginToken) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pluginConfig);
      setConfigCopied(true);
      setFeedback("插件配置已复制。");
    } catch {
      setFeedback("复制失败，请手动选择配置文本。");
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

  function openCommunityDialog(server: AdminServer) {
    setCommunityTarget(server);
    setCommunityValue(server.communityId ?? "");
  }

  async function saveCommunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!communityTarget) {
      return;
    }
    const target = communityTarget;
    setBusy(`community-${target.id}`);
    setFeedback(null);
    try {
      const communityId = communityValue.trim() || null;
      await setAdminServerCommunity(getBrowserApiClient(), target.id, communityId);
      const community = communities.find((item) => item.id === communityId)?.name ?? "";
      setServers((current) =>
        current.map((item) => (item.id === target.id ? { ...item, communityId, community } : item)),
      );
      setCommunityTarget(null);
      setFeedback(community ? `社区组已设置为「${community}」。` : "已清除社区组。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存社区组失败。");
    } finally {
      setBusy(null);
    }
  }

  function openRconDialog(server: AdminServer) {
    setRconTarget(server);
    setRconPassword("");
    setRconError(null);
  }

  async function saveRconPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rconTarget) {
      return;
    }
    const target = rconTarget;
    setBusy(`rcon-${target.id}`);
    setRconError(null);
    try {
      await setAdminServerRconPassword(getBrowserApiClient(), target.id, rconPassword);
      setRconPassword("");
      setFeedback(
        "RCON 密码已保存。下一次检测最多 30 秒后开始；密码不会再次显示，也不会用于白名单或踢封。",
      );
      try {
        const data = await reload();
        const updated = data.servers.find((server) => server.id === target.id);
        if (updated) {
          setRconTarget(updated);
        }
      } catch {
        // The credential was stored successfully.
      }
    } catch (error) {
      setRconError(error instanceof Error ? error.message : "保存 RCON 密码失败。");
    } finally {
      setBusy(null);
    }
  }

  async function removeRconPassword() {
    if (!rconTarget) {
      return;
    }
    const target = rconTarget;
    if (
      !window.confirm(
        `移除「${target.name}」的 RCON 密码？空服休眠时将无法自动判断服务器是否仍在运行。`,
      )
    ) {
      return;
    }
    setBusy(`rcon-${target.id}`);
    setRconError(null);
    try {
      await clearAdminServerRconPassword(getBrowserApiClient(), target.id);
      setRconTarget(null);
      setRconPassword("");
      setFeedback("RCON 密码已移除。");
      await reload();
    } catch (error) {
      setRconError(error instanceof Error ? error.message : "移除 RCON 密码失败。");
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
    const steamId64 = player.steamId64;
    const reason = window.prompt(`踢出 ${player.name} 的原因`, "管理员操作");
    if (!reason) {
      return;
    }
    setBusy(`kick-${server.id}-${steamId64}`);
    try {
      await kickServerPlayer(getBrowserApiClient(), server.id, steamId64, reason);
      setFeedback(
        `踢出 ${player.name} 的指令已进入队列；ThRei_Players 1.4.0+ 会在下一次轮询时执行。`,
      );
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "踢出失败。");
    } finally {
      setBusy(null);
    }
  }

  async function ban(server: AdminServer, player: AdminServer["players"][number]) {
    const steamId64 = player.steamId64;
    const reason = window.prompt(`封禁 ${player.name} 的原因`, "违反服务器规则");
    if (!reason) {
      return;
    }
    if (!window.confirm(`确认在 ${server.name} 封禁 ${player.name}？`)) {
      return;
    }
    setBusy(`ban-${server.id}-${steamId64}`);
    try {
      await banServerPlayer(getBrowserApiClient(), server.id, steamId64, {
        reason,
        playerName: player.name,
        expiresInHours: null,
      });
      setFeedback(
        `封禁 ${player.name} 的指令已进入队列；插件会踢出在线目标，并在后续连接时依据封禁名单拦截。`,
      );
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

  const pluginConfig =
    pluginTarget && pluginToken
      ? [
          `sm_threi_api_url "${pluginApiUrl.trim()}"`,
          `sm_threi_interval "30"`,
          `sm_threi_access_enabled "1"`,
          `sm_threi_actions_enabled "1"`,
          "",
          `// 每个实例一行；端口必须等于该实例的 hostport`,
          `sm_threi_instance ${pluginTarget.port} "${pluginToken}"`,
        ].join("\n")
      : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">服务器</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">服务器管理</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            添加或删除服务器、启用/停用节点、查看插件上报的在线玩家，并通过插件队列执行白名单、踢出和封禁。
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
        description="只需填写游戏服务器的 IP 和端口，服务器 ID 由系统自动生成。"
        size="lg"
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
              服务器状态与在线玩家由游戏服务器插件 ThRei_Players 上报。确认添加后会生成服务器 ID
              并打开插件配置，复制令牌与配置到游戏服务器即可接入。白名单和踢封也走插件队列；RCON
              仅是空服休眠时的可选状态兜底。
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Host / IP" htmlFor="server-host">
              <Input
                id="server-host"
                placeholder="kz01.example.com 或 1.2.3.4"
                value={form.host}
                onChange={(event) => setForm({ ...form, host: event.target.value })}
                required
              />
            </Field>
            <Field label="端口" htmlFor="server-port">
              <Input
                id="server-port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(event) => setForm({ ...form, port: event.target.value })}
                required
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="社区组（可选）" htmlFor="server-community">
                <select
                  id="server-community"
                  value={form.communityId}
                  onChange={(event) => setForm({ ...form, communityId: event.target.value })}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">不分组</option>
                  {communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="mt-1 text-xs text-muted-foreground">
                需要新的社区组？前往{" "}
                <Link
                  href="/admin/communities"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  社区组管理
                </Link>{" "}
                创建。
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            同一台主机上的多个实例可以加入同一个社区组，网站会按组筛选；IP
            与端口用于展示和玩家连接。名称、地图和在线人数由插件上报后自动更新。
          </p>
        </form>
      </Modal>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Server className="size-4 text-primary" /> 服务器列表
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              插件每 30 秒上报一次；配置 RCON 后，空服休眠会显示为“休眠/待上报”，连续 3 次 RCON
              检测失败才标记离线。
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
                        <Badge
                          variant={
                            server.status === "online"
                              ? "success"
                              : server.status === "maintenance" || server.status === "hibernating"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {server.status === "online"
                            ? "在线"
                            : server.status === "maintenance"
                              ? "维护中"
                              : server.status === "hibernating"
                                ? "休眠/待上报"
                                : "离线"}
                        </Badge>
                        <Badge variant={server.isActive ? "success" : "muted"}>
                          {server.isActive ? "启用" : "停用"}
                        </Badge>
                        <Badge variant="muted">{server.map}</Badge>
                        {server.community ? (
                          <Badge variant="outline" className="gap-1">
                            <FolderTree className="size-3" aria-hidden="true" />
                            {server.community}
                          </Badge>
                        ) : null}
                        {server.requiresWhitelist ? (
                          <Tooltip label="该服务器需要白名单审核">
                            <Badge variant="warning">白名单</Badge>
                          </Tooltip>
                        ) : null}
                        {server.featured ? <Badge variant="secondary">推荐</Badge> : null}
                        <Badge
                          variant={
                            server.pluginState === "connected"
                              ? "success"
                              : server.pluginState === "waiting"
                                ? "warning"
                                : "outline"
                          }
                        >
                          {pluginStateLabel(server.pluginState)}
                        </Badge>
                        <RconBadge server={server} />
                        {server.pendingActions > 0 ? (
                          <Tooltip label="等待 ThRei_Players 轮询执行的踢出/封禁指令">
                            <Badge variant="warning">待执行 {server.pendingActions}</Badge>
                          </Tooltip>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {server.host}:{server.port} · {server.region || "未设置地区"} ·{" "}
                        {server.tickrate} tick · {server.playerCount ?? server.players.length}/
                        {server.maxPlayers} 在线
                        {server.latencyMs === null ? "" : ` · ${server.latencyMs} ms`}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {server.id}
                        {server.lastReportedAt
                          ? ` · 最近上报 ${formatDate(server.lastReportedAt)}`
                          : " · 尚未收到插件上报"}
                      </p>
                      {server.hasRconPassword ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          RCON{" "}
                          {server.lastRconAt
                            ? `最近检测 ${formatDate(server.lastRconAt)}`
                            : "等待首次检测"}
                          {server.rconFailures >= 3
                            ? " · 连续失败 ≥3 次"
                            : server.rconFailures > 0
                              ? ` · 连续失败 ${server.rconFailures}/3`
                              : " · 检测正常"}
                          {server.pendingActions > 0
                            ? ` · ${server.pendingActions} 条指令待插件执行`
                            : ""}
                        </p>
                      ) : null}
                      {server.pluginState === "disabled" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          点击“插件配置”生成令牌，并在游戏服务器安装 ThRei_Players。
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === `plugin-token-${server.id}`}
                      onClick={() => openPluginDialog(server)}
                    >
                      {busy === `plugin-token-${server.id}` ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <KeyRound />
                      )}
                      插件配置
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openRconDialog(server)}
                    >
                      <Radio /> RCON 兜底
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openCommunityDialog(server)}
                    >
                      <FolderTree /> 社区组
                    </Button>
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
                    <p className="text-xs font-medium text-muted-foreground">
                      在线玩家 · {server.playerCount ?? server.players.length}
                      <span className="ml-2 font-normal">
                        踢出/封禁会写入执行队列，ThRei_Players 1.4.0+ 轮询后执行。
                      </span>
                    </p>
                    <div className="mt-2 divide-y">
                      {server.players.map((player) => (
                        <div
                          key={player.steamId64}
                          className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <UserAvatar name={player.name} avatarUrl={player.avatarUrl} size="xs" />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm break-words">{player.name}</p>
                                <Badge variant="outline">插件</Badge>
                              </div>
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
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    {server.pluginState === "disabled"
                      ? "尚未接入插件，生成令牌并安装 ThRei_Players 后会显示在线玩家。"
                      : server.status === "hibernating"
                        ? "服务器处于空服休眠，插件暂停上报；玩家连接后会自动唤醒。"
                        : "当前未检测到在线玩家；插件每 30 秒上报一次。"}
                  </p>
                )}
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

      <Modal
        open={pluginTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            closePluginDialog();
          }
        }}
        title={pluginTarget ? `ThRei_Players · ${pluginTarget.name}` : "ThRei_Players"}
        description="生成服务器专用令牌，并在游戏服务器安装 SourceMod 插件。插件会上报地图、人数和已登录 Steam 的玩家名单。"
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={closePluginDialog}>
              关闭
            </Button>
            {pluginToken ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pluginTarget !== null && busy === `plugin-token-${pluginTarget.id}`}
                onClick={() => void revokePluginToken()}
              >
                撤销令牌
              </Button>
            ) : null}
            {pluginToken ? (
              <Button
                type="button"
                disabled={pluginTarget !== null && busy === `plugin-token-${pluginTarget.id}`}
                onClick={() => void generatePluginToken()}
              >
                {pluginTarget !== null && busy === `plugin-token-${pluginTarget.id}` ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <KeyRound />
                )}
                重新生成
              </Button>
            ) : pluginTokenLoading || pluginTokenError ? null : (
              <Button
                type="button"
                disabled={pluginTarget !== null && busy === `plugin-token-${pluginTarget.id}`}
                onClick={() => void generatePluginToken()}
              >
                {pluginTarget !== null && busy === `plugin-token-${pluginTarget.id}` ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <KeyRound />
                )}
                生成令牌
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <Alert variant="info">
            <AlertDescription>
              需要 SourceMod 1.11 或更高版本，以及 SteamWorks 扩展。插件通过 HTTP
              上报；请使用游戏服务器可访问的 HTTPS 地址，令牌只应写入服务器配置文件。
            </AlertDescription>
          </Alert>

          {pluginTarget ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">当前状态</span>
              <Badge
                variant={
                  pluginTarget.pluginState === "connected"
                    ? "success"
                    : pluginTarget.pluginState === "waiting"
                      ? "warning"
                      : "outline"
                }
              >
                {pluginStateLabel(pluginTarget.pluginState)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {pluginTarget.lastReportedAt
                  ? `最近上报 ${formatDate(pluginTarget.lastReportedAt)}`
                  : "尚未收到上报"}
              </span>
            </div>
          ) : null}

          {pluginTokenLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> 正在读取插件令牌…
            </p>
          ) : pluginTokenError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {pluginTokenError}
                {pluginTarget ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-3"
                    onClick={() => void loadPluginToken(pluginTarget.id)}
                  >
                    重试
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : pluginToken ? (
            <>
              <Field label="上报地址" htmlFor="plugin-api-url">
                <Input
                  id="plugin-api-url"
                  value={pluginApiUrl}
                  onChange={(event) => {
                    setPluginApiUrl(event.target.value);
                    setConfigCopied(false);
                  }}
                  spellCheck={false}
                />
              </Field>
              <Field label="插件令牌" htmlFor="plugin-token">
                <Input
                  id="plugin-token"
                  className="font-mono text-xs"
                  value={pluginToken}
                  readOnly
                  spellCheck={false}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </Field>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">写入 cfg/sourcemod/threi_players.cfg</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyPluginConfig()}
                  >
                    {configCopied ? <Check /> : <Copy />}
                    {configCopied ? "已复制" : "复制配置"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                  {pluginConfig}
                </pre>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                多实例共用 <code className="font-mono">cfg/sourcemod/threi_players.cfg</code>{" "}
                时，为每个实例添加一行{" "}
                <code className="font-mono">
                  sm_threi_instance &lt;hostport&gt; &quot;令牌&quot;
                </code>
                。插件按实例端口选择令牌，API 再根据唯一令牌匹配服务器；端口必须与实例实际的{" "}
                <code className="font-mono">hostport</code> 一致。
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                将 <code className="font-mono">addons/sourcemod</code>{" "}
                下的插件文件复制到游戏服务器，编辑配置后重启地图或执行
                <code className="ml-1 font-mono">sm plugins reload ThRei_Players</code>
                。游戏服务器必须能访问上报地址；生产环境建议使用 HTTPS，避免令牌以明文传输。
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                该服务器还没有插件令牌。生成后请立即安装
                ThRei_Players，并把令牌写入服务器配置；令牌只显示给管理员。
              </p>
              <p className="text-xs text-muted-foreground">
                重新生成会使旧令牌立即失效；撤销令牌会同时清空在线名单并将服务器标记为离线（维护中状态保持不变）。
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={communityTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCommunityTarget(null);
          }
        }}
        title={communityTarget ? `设置社区组 · ${communityTarget.name}` : "设置社区组"}
        description="选择该实例所属的社区组；服务器目录会按组筛选，选择“不分组”表示不加入任何社区组。"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCommunityTarget(null)}>
              取消
            </Button>
            <Button
              type="submit"
              form="server-community-form"
              disabled={busy === `community-${communityTarget?.id}`}
            >
              {busy === `community-${communityTarget?.id}` ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Check />
              )}
              保存
            </Button>
          </div>
        }
      >
        <form id="server-community-form" onSubmit={saveCommunity} className="space-y-4">
          {communities.length > 0 ? (
            <Field label="社区组" htmlFor="server-community-edit">
              <select
                id="server-community-edit"
                value={communityValue}
                onChange={(event) => setCommunityValue(event.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">不分组</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Alert variant="info">
              <AlertDescription>
                还没有可用的社区组。请先前往{" "}
                <Link
                  href="/admin/communities"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  社区组管理
                </Link>{" "}
                创建社区组，再回来设置。
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">
            仅用于网站分组展示和筛选，不影响插件上报或服务器连接。
          </p>
        </form>
      </Modal>

      <Modal
        open={rconTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRconTarget(null);
            setRconPassword("");
            setRconError(null);
          }
        }}
        title={rconTarget ? `RCON 兜底 · ${rconTarget.name}` : "RCON 兜底"}
        description="仅在插件的空服休眠状态上报之外做存活检测；白名单和踢封不依赖 RCON。"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {rconTarget?.hasRconPassword ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy === `rcon-${rconTarget.id}`}
                onClick={() => void removeRconPassword()}
              >
                移除密码
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRconTarget(null);
                setRconPassword("");
                setRconError(null);
              }}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="server-rcon-form"
              disabled={
                !rconTarget || rconPassword.trim().length === 0 || busy === `rcon-${rconTarget.id}`
              }
            >
              {rconTarget && busy === `rcon-${rconTarget.id}` ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Check />
              )}
              保存
            </Button>
          </div>
        }
      >
        <form id="server-rcon-form" onSubmit={saveRconPassword} className="space-y-4">
          <Alert variant="info">
            <AlertDescription>
              密码只写入数据库，后台不会回显，也不用于白名单或踢封。API 只会对游戏服务器发送{" "}
              <code className="font-mono">status</code> 命令；请确保 API
              主机能访问服务器的游戏端口（RCON 默认同端口）。
            </AlertDescription>
          </Alert>

          {rconTarget ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">当前状态</span>
              <RconBadge server={rconTarget} />
              <span className="text-xs text-muted-foreground">
                {rconTarget.hasRconPassword
                  ? rconTarget.lastRconAt
                    ? `最近检测 ${formatDate(rconTarget.lastRconAt)}`
                    : "已保存，等待首次检测"
                  : "尚未配置，空服休眠时无法自动判断存活"}
              </span>
            </div>
          ) : null}

          <Field label="RCON 密码（rcon_password）" htmlFor="server-rcon-password">
            <Input
              id="server-rcon-password"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={rconPassword}
              onChange={(event) => setRconPassword(event.target.value)}
              placeholder={
                rconTarget?.hasRconPassword ? "输入新密码以替换" : "输入服务器 RCON 密码"
              }
              required
            />
          </Field>

          <p className="text-xs leading-relaxed text-muted-foreground">
            RCON 只用于空服休眠兜底：插件连续 90 秒未上报时，API 每 60 秒检测一次；连续 3
            次失败才会标记离线。没有 RCON 时仍可正常使用白名单、踢出和封禁。
          </p>

          {rconError ? (
            <Alert variant="destructive">
              <AlertDescription>{rconError}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </Modal>

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

function RconBadge({ server }: { server: AdminServer }) {
  const badge = rconBadge(server);
  if (!badge) {
    return null;
  }
  return (
    <Tooltip label="RCON 仅用于空服休眠时的存活检测；连续 3 次失败才标记离线">
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </Tooltip>
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
