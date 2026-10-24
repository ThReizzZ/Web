"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardCheck,
  LoaderCircle,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type {
  ServerWhitelistSetting,
  WhitelistApplication,
  WhitelistEntry,
  WhitelistOverview,
} from "@/features/admin/types";
import { formatDate } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import { useToast } from "@/components/ui/toast";
import {
  addWhitelistEntry,
  removeWhitelistEntry,
  reviewWhitelistApplication,
  setServerWhitelist,
} from "@/services/content";

const statusVariant = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
} as const;

const statusLabel = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
} as const;

export function WhitelistManager({ initial }: { initial: WhitelistOverview }) {
  const router = useRouter();
  const [applications, setApplications] = useState(initial.applications);
  const [entries, setEntries] = useState(initial.entries);
  const [servers, setServers] = useState(initial.servers);
  const [serverId, setServerId] = useState(initial.servers[0]?.id ?? "");
  const [steamId64, setSteamId64] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WhitelistEntry | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    application: WhitelistApplication;
    decision: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [, startTransition] = useTransition();

  const pending = applications.filter((item) => item.status === "pending");
  const reviewed = applications.filter((item) => item.status !== "pending").slice(0, 10);
  const whitelisted = new Set(entries.map((entry) => `${entry.serverId}:${entry.steamId64}`));

  function refresh() {
    startTransition(() => router.refresh());
  }

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "操作失败，请稍后重试。";
  }

  const { toast } = useToast();

  function review(application: WhitelistApplication, decision: "approve" | "reject") {
    setReviewNote("");
    setReviewTarget({ application, decision });
  }

  async function submitReview() {
    if (!reviewTarget) {
      return;
    }
    const { application, decision } = reviewTarget;
    const note = reviewNote.trim();
    setBusy(application.id);
    setFeedback(null);
    try {
      await reviewWhitelistApplication(getBrowserApiClient(), application.id, decision, note);
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? {
                ...item,
                status: decision === "approve" ? "approved" : "rejected",
                reviewedAt: new Date().toISOString(),
                reviewNote: note || null,
              }
            : item,
        ),
      );
      if (decision === "approve") {
        setEntries((current) => [
          {
            serverId: application.serverId,
            serverName: application.serverName,
            steamId64: application.steamId64,
            playerName: application.playerName,
            avatarUrl: application.avatarUrl,
            createdAt: new Date().toISOString(),
            addedBy: "白名单审核",
          },
          ...current,
        ]);
      }
      setReviewTarget(null);
      setFeedback(decision === "approve" ? "申请已通过并加入白名单。" : "申请已拒绝。");
      refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!serverId) {
      setFeedback("请先选择一个服务器。");
      return;
    }
    if (!/^\d{17}$/.test(steamId64.trim())) {
      setFeedback("SteamID64 必须是 17 位数字。");
      return;
    }
    setBusy("add");
    try {
      await addWhitelistEntry(getBrowserApiClient(), {
        serverId,
        steamId64: steamId64.trim(),
        playerName: playerName.trim() || undefined,
      });
      const server = servers.find((item) => item.id === serverId);
      setEntries((current) => [
        {
          serverId,
          serverName: server?.name ?? serverId,
          steamId64: steamId64.trim(),
          playerName: playerName.trim() || steamId64.trim(),
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          addedBy: "手动添加",
        },
        ...current,
      ]);
      setSteamId64("");
      setPlayerName("");
      setFeedback("已加入白名单。");
      setShowManual(false);
      refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function removeEntry(entry: WhitelistEntry) {
    setBusy(`${entry.serverId}:${entry.steamId64}`);
    setFeedback(null);
    try {
      await removeWhitelistEntry(getBrowserApiClient(), entry.serverId, entry.steamId64);
      setEntries((current) =>
        current.filter(
          (item) => !(item.serverId === entry.serverId && item.steamId64 === entry.steamId64),
        ),
      );
      setFeedback("已从白名单移除。");
      refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function toggleServer(server: ServerWhitelistSetting) {
    setBusy(`server:${server.id}`);
    setFeedback(null);
    try {
      await setServerWhitelist(getBrowserApiClient(), server.id, !server.requiresWhitelist);
      setServers((current) =>
        current.map((item) =>
          item.id === server.id ? { ...item, requiresWhitelist: !server.requiresWhitelist } : item,
        ),
      );
      setFeedback(
        !server.requiresWhitelist
          ? `${server.name} 已开启白名单要求。`
          : `${server.name} 已关闭白名单要求。`,
      );
      refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
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
          <p className="text-sm font-medium text-primary">白名单</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">白名单审核</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            管理需要白名单的服务器、审核玩家申请并维护已授权名单。实际服务器拦截由游戏服务器插件读取白名单数据。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">{pending.length} 条待审核</Badge>
          <Badge variant="secondary">{entries.length} 条授权</Badge>
          <Button type="button" size="sm" onClick={() => setShowManual((value) => !value)}>
            <Plus /> {showManual ? "收起表单" : "手动添加"}
          </Button>
        </div>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
              待审核申请
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              只有待审核申请会出现操作按钮；审核备注会保留在申请记录中。
            </p>
          </div>
          <Badge variant={pending.length > 0 ? "warning" : "success"}>
            {pending.length} 条待处理
          </Badge>
        </div>
        <div className="divide-y">
          {pending.length > 0 ? (
            pending.map((application) => (
              <article key={application.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <UserAvatar
                      name={application.playerName}
                      avatarUrl={application.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium break-words">{application.playerName}</p>
                        <Badge variant="muted">{application.serverName}</Badge>
                        <span className="font-mono text-[11px] break-all text-muted-foreground">
                          {application.steamId64}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        {application.message}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        提交于 {formatDate(application.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy === application.id}
                      onClick={() => void review(application, "approve")}
                    >
                      {busy === application.id ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Check aria-hidden="true" />
                      )}
                      通过
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === application.id}
                      onClick={() => void review(application, "reject")}
                    >
                      <X aria-hidden="true" />
                      拒绝
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              当前没有待审核的白名单申请。
            </p>
          )}
        </div>
      </section>

      {reviewed.length > 0 ? (
        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">最近审核记录</h2>
            <p className="mt-1 text-xs text-muted-foreground">最近处理的白名单申请。</p>
          </div>
          <div className="divide-y">
            {reviewed.map((application) => (
              <div
                key={application.id}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{application.playerName}</span>
                    <Badge variant={statusVariant[application.status]}>
                      {statusLabel[application.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{application.serverName}</span>
                  </div>
                  {application.reviewNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      备注：{application.reviewNote}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(application.reviewedAt ?? application.createdAt)}
                  {application.reviewedBy ? ` · ${application.reviewedBy}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Server className="size-4 text-primary" aria-hidden="true" />
                  服务器白名单设置
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  开启后，未授权玩家需要先提交申请；服务器插件应在连接前检查白名单表。
                </p>
              </div>
            </div>
            <div className="divide-y">
              {servers.length > 0 ? (
                servers.map((server) => (
                  <div
                    key={server.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{server.name}</p>
                        {server.requiresWhitelist ? (
                          <Badge variant="warning">需要白名单</Badge>
                        ) : (
                          <Badge variant="muted">公开</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {server.whitelistCount} 条授权 · {server.pendingCount} 条待审核
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={server.requiresWhitelist ? "outline" : "default"}
                      disabled={busy === `server:${server.id}`}
                      onClick={() => void toggleServer(server)}
                    >
                      {busy === `server:${server.id}` ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <ShieldCheck aria-hidden="true" />
                      )}
                      {server.requiresWhitelist ? "关闭白名单" : "开启白名单"}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  还没有服务器记录。添加服务器后才能配置白名单。
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">已授权名单</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                按服务器管理白名单；移除后玩家需要重新申请。
              </p>
            </div>
            <div className="divide-y">
              {entries.length > 0 ? (
                entries.map((entry) => (
                  <article
                    key={`${entry.serverId}:${entry.steamId64}`}
                    className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <UserAvatar name={entry.playerName} avatarUrl={entry.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="font-medium break-words">{entry.playerName}</p>
                        <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                          {entry.steamId64}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground md:justify-end">
                      <Badge variant="muted">{entry.serverName}</Badge>
                      <span>{formatDate(entry.createdAt)}</span>
                      {entry.addedBy ? <span>由 {entry.addedBy}</span> : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="self-start md:self-auto"
                      disabled={busy === `${entry.serverId}:${entry.steamId64}`}
                      onClick={() => setRemoveTarget(entry)}
                    >
                      <Trash2 aria-hidden="true" />
                      移除
                    </Button>
                  </article>
                ))
              ) : (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  还没有已授权玩家。
                </p>
              )}
            </div>
          </section>
        </div>

        <Modal
          open={showManual}
          onOpenChange={setShowManual}
          title="手动添加白名单"
          description="适用于已在其他渠道核实过的玩家。"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowManual(false)}>
                取消
              </Button>
              <Button
                type="submit"
                form="whitelist-add-form"
                disabled={busy === "add" || servers.length === 0}
              >
                {busy === "add" ? <LoaderCircle className="animate-spin" /> : <Plus />}
                加入白名单
              </Button>
            </div>
          }
        >
          <form id="whitelist-add-form" onSubmit={addEntry} className="grid gap-4 md:grid-cols-2">
            <Alert variant="info" className="md:col-span-2">
              <AlertDescription>
                白名单写入后，需由游戏服务器插件在连接前读取并执行拦截。
              </AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <Label htmlFor="whitelist-server">服务器</Label>
              <select
                id="whitelist-server"
                value={serverId}
                onChange={(event) => setServerId(event.target.value)}
                disabled={servers.length === 0}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
              >
                {servers.length === 0 ? <option value="">没有可用服务器</option> : null}
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whitelist-steam-id">SteamID64</Label>
              <Input
                id="whitelist-steam-id"
                inputMode="numeric"
                pattern="[0-9]{17}"
                maxLength={17}
                placeholder="76561198000000000"
                value={steamId64}
                onChange={(event) => setSteamId64(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="whitelist-player-name">玩家昵称（可选）</Label>
              <Input
                id="whitelist-player-name"
                maxLength={80}
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </div>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            已授权：{whitelisted.size} 条。服务器插件接入后，连接时按 SteamID64 校验这里的记录。
          </p>
        </Modal>

        <ConfirmDialog
          open={reviewTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setReviewTarget(null);
            }
          }}
          title={
            reviewTarget
              ? `${reviewTarget.decision === "approve" ? "通过" : "拒绝"} ${reviewTarget.application.playerName} 的申请`
              : "审核白名单申请"
          }
          description={
            reviewTarget?.decision === "approve"
              ? "通过后会立即写入对应服务器的白名单。"
              : "拒绝后会在申请记录中保留审核备注。"
          }
          confirmLabel={reviewTarget?.decision === "approve" ? "通过申请" : "拒绝申请"}
          destructive={reviewTarget?.decision === "reject"}
          pending={reviewTarget !== null && busy === reviewTarget.application.id}
          onConfirm={() => void submitReview()}
        >
          <div className="space-y-2">
            <Label htmlFor="whitelist-review-note">审核备注（可选）</Label>
            <textarea
              id="whitelist-review-note"
              rows={3}
              maxLength={500}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          open={removeTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setRemoveTarget(null);
            }
          }}
          title={removeTarget ? `移除 ${removeTarget.playerName} 的白名单` : "移除白名单"}
          description="移除后该玩家需要重新申请或由管理员重新授权。"
          confirmLabel="移除白名单"
          destructive
          pending={
            removeTarget !== null && busy === `${removeTarget.serverId}:${removeTarget.steamId64}`
          }
          onConfirm={() => removeTarget && void removeEntry(removeTarget)}
        />
      </div>
    </div>
  );
}
