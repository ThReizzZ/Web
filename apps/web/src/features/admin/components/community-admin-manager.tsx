"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  FolderTree,
  Gamepad2,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { AdminCommunity, AdminCommunityServer, AdminServer } from "@/features/admin/types";
import { getBrowserApiClient } from "@/lib/api/browser";
import {
  addAdminCommunityServers,
  createAdminCommunity,
  deleteAdminCommunity,
  fetchAdminCommunities,
  fetchAdminServers,
  removeAdminCommunityServer,
  updateAdminCommunity,
} from "@/services/content";

const emptyGroupForm = { name: "", description: "" };

function pluginStateLabel(state: AdminServer["pluginState"]): string {
  if (state === "connected") {
    return "插件已连接";
  }
  if (state === "waiting") {
    return "等待插件上报";
  }
  return "未接入插件";
}

function statusLabel(status: string): string {
  if (status === "online") {
    return "在线";
  }
  if (status === "hibernating") {
    return "休眠/待上报";
  }
  if (status === "maintenance") {
    return "维护中";
  }
  return "离线";
}

export function CommunityAdminManager({
  initialCommunities,
  initialServers,
}: {
  initialCommunities: AdminCommunity[];
  initialServers: AdminServer[];
}) {
  const [communities, setCommunities] = useState(initialCommunities);
  const [servers, setServers] = useState(initialServers);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminCommunity | null>(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [addTarget, setAddTarget] = useState<AdminCommunity | null>(null);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AdminCommunity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { toast } = useToast();
  const ungroupedCount = servers.filter((server) => !server.communityId).length;
  const addableServers = addTarget
    ? servers
        .filter((server) => server.communityId !== addTarget.id)
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
    : [];

  async function reload() {
    const client = getBrowserApiClient();
    const [nextCommunities, overview] = await Promise.all([
      fetchAdminCommunities(client),
      fetchAdminServers(client),
    ]);
    setCommunities(nextCommunities);
    setServers(overview.servers);
  }

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
    setShowGroupForm(true);
  }

  function openEditGroup(group: AdminCommunity) {
    setEditingGroup(group);
    setGroupForm({ name: group.name, description: group.description });
    setShowGroupForm(true);
  }

  function closeGroupForm() {
    setShowGroupForm(false);
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
  }

  async function saveGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupForm.name.trim();
    if (!name) {
      toast("请填写社区组名称。", "error");
      return;
    }
    const wasEditing = editingGroup !== null;
    setBusy("group-save");
    try {
      const client = getBrowserApiClient();
      if (editingGroup) {
        await updateAdminCommunity(client, editingGroup.id, {
          name,
          description: groupForm.description.trim(),
        });
      } else {
        await createAdminCommunity(client, {
          name,
          description: groupForm.description.trim(),
        });
      }
      closeGroupForm();
      await reload();
      toast(wasEditing ? "社区组已更新。" : "社区组已创建。", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "保存社区组失败。", "error");
    } finally {
      setBusy(null);
    }
  }

  function openAddServers(group: AdminCommunity) {
    setAddTarget(group);
    setSelectedServerIds([]);
  }

  function toggleServer(serverId: string) {
    setSelectedServerIds((current) =>
      current.includes(serverId) ? current.filter((id) => id !== serverId) : [...current, serverId],
    );
  }

  async function saveServers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addTarget || selectedServerIds.length === 0) {
      return;
    }
    const target = addTarget;
    const count = selectedServerIds.length;
    setBusy(`add-${target.id}`);
    try {
      await addAdminCommunityServers(getBrowserApiClient(), target.id, selectedServerIds);
      setAddTarget(null);
      setSelectedServerIds([]);
      await reload();
      toast(`已将 ${count} 个实例加入「${target.name}」。`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "添加实例失败。", "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeServer(group: AdminCommunity, server: AdminCommunityServer) {
    setBusy(`remove-${group.id}-${server.id}`);
    try {
      await removeAdminCommunityServer(getBrowserApiClient(), group.id, server.id);
      await reload();
      toast(`已将「${server.name}」移出「${group.name}」。`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "移出实例失败。", "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeGroup() {
    if (!deleteTarget) {
      return;
    }
    const target = deleteTarget;
    setBusy(`delete-${target.id}`);
    try {
      await deleteAdminCommunity(getBrowserApiClient(), target.id);
      setDeleteTarget(null);
      await reload();
      toast(`社区组「${target.name}」已删除，实例已变为未分组。`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "删除社区组失败。", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">社区组</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">社区组管理</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            先创建社区组，再把服务器实例添加到组里。公开服务器目录会显示社区组标签，并支持按组筛选。
          </p>
        </div>
        <Button type="button" onClick={openCreateGroup}>
          <Plus /> 添加社区组
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          <FolderTree /> {communities.length} 个社区组
        </Badge>
        <Badge variant="muted">
          <Users /> {ungroupedCount} 个未分组实例
        </Badge>
      </div>

      <Alert variant="info">
        <AlertDescription>
          一个实例只能属于一个社区组；把实例加入新组时会自动从原组移出。删除社区组只会让组内实例变为未分组，
          不会删除服务器或插件令牌。
        </AlertDescription>
      </Alert>

      {communities.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-14 text-center">
          <FolderTree className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">还没有社区组</p>
            <p className="mt-1 text-sm text-muted-foreground">
              创建一个社区组，然后把服务器管理中的实例添加进来。
            </p>
          </div>
          <Button type="button" onClick={openCreateGroup}>
            <Plus /> 添加社区组
          </Button>
        </section>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {communities.map((group) => (
            <section key={group.id} className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FolderTree className="size-4 text-primary" aria-hidden="true" />
                    <h2 className="font-semibold break-words">{group.name}</h2>
                    <Badge variant="secondary">{group.servers.length} 个实例</Badge>
                  </div>
                  {group.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  ) : null}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{group.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openAddServers(group)}
                  >
                    <Plus /> 添加实例
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEditGroup(group)}
                  >
                    <Pencil /> 编辑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(group)}
                  >
                    <Trash2 /> 删除
                  </Button>
                </div>
              </div>
              <div className="divide-y">
                {group.servers.length > 0 ? (
                  group.servers.map((server) => (
                    <div
                      key={server.id}
                      className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <Gamepad2 className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium break-words">{server.name}</p>
                            <Badge
                              variant={
                                server.status === "online"
                                  ? "success"
                                  : server.status === "maintenance" ||
                                      server.status === "hibernating"
                                    ? "warning"
                                    : "muted"
                              }
                            >
                              {statusLabel(server.status)}
                            </Badge>
                            {!server.isActive ? <Badge variant="muted">停用</Badge> : null}
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
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {server.host}:{server.port} · {server.playerCount ?? 0}/
                            {server.maxPlayers} 在线
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">{server.id}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy === `remove-${group.id}-${server.id}`}
                        onClick={() => void removeServer(group, server)}
                      >
                        {busy === `remove-${group.id}-${server.id}` ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <UserMinus />
                        )}
                        移出
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      这个社区组还没有实例。点击「添加实例」把服务器加入进来。
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={showGroupForm}
        onOpenChange={(open) => {
          if (!open) {
            closeGroupForm();
          }
        }}
        title={editingGroup ? `编辑社区组 · ${editingGroup.name}` : "添加社区组"}
        description="社区组用于把同一主机或同一社区的多个服务器实例归在一起。"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeGroupForm}>
              取消
            </Button>
            <Button type="submit" form="community-group-form" disabled={busy === "group-save"}>
              {busy === "group-save" ? (
                <LoaderCircle className="animate-spin" />
              ) : editingGroup ? (
                <Check />
              ) : (
                <Plus />
              )}
              {editingGroup ? "保存" : "创建"}
            </Button>
          </div>
        }
      >
        <form id="community-group-form" onSubmit={saveGroup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="community-group-name">名称</Label>
            <Input
              id="community-group-name"
              value={groupForm.name}
              onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
              placeholder="例如：ThRei 主机"
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-group-description">描述（可选）</Label>
            <textarea
              id="community-group-description"
              value={groupForm.description}
              onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })}
              placeholder="例如：同一台物理主机上的 KZ 实例"
              maxLength={200}
              rows={3}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            <p className="text-xs text-muted-foreground">最多 200 个字符。</p>
          </div>
        </form>
      </Modal>

      <Modal
        open={addTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddTarget(null);
            setSelectedServerIds([]);
          }
        }}
        title={addTarget ? `添加实例 · ${addTarget.name}` : "添加实例"}
        description="选择要加入该社区组的服务器实例。已属于其他组的实例会被移动到当前组。"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddTarget(null);
                setSelectedServerIds([]);
              }}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="community-add-servers-form"
              disabled={
                !addTarget || selectedServerIds.length === 0 || busy === `add-${addTarget.id}`
              }
            >
              {addTarget && busy === `add-${addTarget.id}` ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Plus />
              )}
              添加{selectedServerIds.length > 0 ? `（${selectedServerIds.length}）` : ""}
            </Button>
          </div>
        }
      >
        {addableServers.length === 0 ? (
          <Alert variant="info">
            <AlertDescription>
              没有可添加的实例。请先前往{" "}
              <Link
                href="/admin/servers"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                服务器管理
              </Link>{" "}
              添加服务器。
            </AlertDescription>
          </Alert>
        ) : (
          <form id="community-add-servers-form" onSubmit={saveServers}>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {addableServers.map((server) => (
                <label
                  key={server.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedServerIds.includes(server.id)}
                    onChange={() => toggleServer(server.id)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium break-words">{server.name}</span>
                      {server.community ? (
                        <Badge variant="outline">当前：{server.community}</Badge>
                      ) : (
                        <Badge variant="muted">未分组</Badge>
                      )}
                      {!server.isActive ? <Badge variant="muted">停用</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {server.host}:{server.port} · {pluginStateLabel(server.pluginState)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={deleteTarget ? `删除社区组「${deleteTarget.name}」` : "删除社区组"}
        description={`组内 ${deleteTarget?.servers.length ?? 0} 个实例会变为未分组，服务器和插件令牌不会被删除。`}
        confirmLabel="删除社区组"
        destructive
        pending={deleteTarget !== null && busy === `delete-${deleteTarget.id}`}
        onConfirm={() => void removeGroup()}
      />
    </div>
  );
}
