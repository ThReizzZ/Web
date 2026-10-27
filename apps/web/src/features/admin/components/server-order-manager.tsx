"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  GripVertical,
  LoaderCircle,
  RotateCcw,
  Save,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import type { AdminServer } from "@/features/admin/types";
import { getBrowserApiClient } from "@/lib/api/browser";
import { reorderAdminServers } from "@/services/content";

function OrderActions({
  dirty,
  busy,
  onReset,
  onSave,
}: {
  dirty: boolean;
  busy: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {dirty ? <Badge variant="warning">有未保存的修改</Badge> : null}
      <Button type="button" variant="outline" onClick={onReset} disabled={!dirty || busy}>
        <RotateCcw />
        重置
      </Button>
      <Button type="button" onClick={onSave} disabled={!dirty || busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
        保存顺序
      </Button>
    </div>
  );
}

export function ServerOrderManager({ initialServers }: { initialServers: AdminServer[] }) {
  const [servers, setServers] = useState(initialServers);
  const [savedOrder, setSavedOrder] = useState(initialServers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { toast } = useToast();

  const dirty =
    servers.length !== savedOrder.length ||
    servers.some((server, index) => server.id !== savedOrder[index]?.id);

  function moveByIds(fromId: string, toId: string) {
    if (fromId === toId) {
      return;
    }
    setServers((current) => {
      const fromIndex = current.findIndex((server) => server.id === fromId);
      const toIndex = current.findIndex((server) => server.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return current;
      }
      next.splice(toIndex, 0, moved);
      return next;
    });
    setError(null);
  }

  function move(index: number, target: number) {
    if (target < 0 || target >= servers.length || target === index) {
      return;
    }
    const fromServer = servers[index];
    const targetServer = servers[target];
    if (!fromServer || !targetServer) {
      return;
    }
    moveByIds(fromServer.id, targetServer.id);
  }

  function handleDragStart(event: React.DragEvent<HTMLElement>, server: AdminServer) {
    setDraggingId(server.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", server.id);
    const row = event.currentTarget.closest("li");
    if (row instanceof HTMLElement) {
      event.dataTransfer.setDragImage(row, 24, 24);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLLIElement>, server: AdminServer) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggingId || draggingId === server.id) {
      return;
    }
    moveByIds(draggingId, server.id);
  }

  function handleDrop(event: React.DragEvent<HTMLLIElement>) {
    event.preventDefault();
    setDraggingId(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await reorderAdminServers(
        getBrowserApiClient(),
        servers.map((server) => server.id),
      );
      setSavedOrder(servers);
      toast("服务器顺序已保存。", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "保存服务器顺序失败。";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setServers(savedOrder);
    setDraggingId(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">排序</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">服务器排序</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            拖动服务器左侧的手柄调整顺序，也可以使用置顶/上移/下移按钮。调整完成后点击“保存顺序”。
            停用的服务器不会出现在公开目录，但会保留这里的相对位置。
          </p>
        </div>
        <OrderActions dirty={dirty} busy={busy} onReset={reset} onSave={() => void save()} />
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {servers.length > 0 ? (
        <ol className="space-y-2">
          {servers.map((server, index) => {
            const isDragging = draggingId === server.id;
            return (
              <li
                key={server.id}
                onDragOver={(event) => handleDragOver(event, server)}
                onDrop={handleDrop}
                className={`flex flex-col gap-3 rounded-xl border bg-card p-4 transition-opacity sm:flex-row sm:items-center sm:justify-between ${
                  isDragging ? "opacity-60 ring-2 ring-primary/30" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    draggable
                    onDragStart={(event) => handleDragStart(event, server)}
                    onDragEnd={() => setDraggingId(null)}
                    className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
                    title="拖动排序"
                    aria-hidden="true"
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-mono text-sm font-semibold">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{server.name}</p>
                      <Badge variant={server.isActive ? "success" : "muted"}>
                        {server.isActive ? "启用" : "停用"}
                      </Badge>
                      {server.community ? (
                        <Badge variant="outline">{server.community}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {server.host}:{server.port} · {server.map} ·{" "}
                      {server.playerCount ?? server.players.length}/{server.maxPlayers} 在线
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-md border bg-background p-1">
                  <Tooltip label="置顶">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-8 px-0"
                      disabled={index === 0 || busy}
                      onClick={() => move(index, 0)}
                      aria-label={`将 ${server.name} 置顶`}
                    >
                      <ArrowUpToLine />
                    </Button>
                  </Tooltip>
                  <Tooltip label="上移">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-8 px-0"
                      disabled={index === 0 || busy}
                      onClick={() => move(index, index - 1)}
                      aria-label={`将 ${server.name} 上移`}
                    >
                      <ArrowUp />
                    </Button>
                  </Tooltip>
                  <Tooltip label="下移">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-8 px-0"
                      disabled={index === servers.length - 1 || busy}
                      onClick={() => move(index, index + 1)}
                      aria-label={`将 ${server.name} 下移`}
                    >
                      <ArrowDown />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed px-5 py-12 text-center text-sm text-muted-foreground">
          还没有服务器记录。先在服务器管理中添加服务器。
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <p className="text-xs text-muted-foreground">调整完成后记得保存顺序。</p>
        <OrderActions dirty={dirty} busy={busy} onReset={reset} onSave={() => void save()} />
      </div>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/servers">返回服务器管理</Link>
        </Button>
      </div>
    </div>
  );
}
