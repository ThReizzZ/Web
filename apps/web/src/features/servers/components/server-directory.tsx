"use client";

import { LayoutGrid, List, Users } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ServerCard } from "@/features/servers/components/server-card";
import { ServerListRow } from "@/features/servers/components/server-list-row";
import { gameServers, getOnlinePlayerTotal } from "@/features/servers/data/servers";

const VIEW_STORAGE_KEY = "threi.servers.view";
const VIEW_CHANGE_EVENT = "threi:servers-view-change";
type ViewMode = "card" | "list";

function subscribeToView(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_CHANGE_EVENT, callback);
  };
}

function getViewSnapshot(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

function getServerViewSnapshot(): ViewMode {
  return "card";
}

export function ServerDirectory() {
  const view = useSyncExternalStore(subscribeToView, getViewSnapshot, getServerViewSnapshot);

  function selectView(nextView: ViewMode) {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    } catch {
      // The selection still applies for the current page session.
    }
    window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
  }

  const onlineTotal = getOnlinePlayerTotal();

  return (
    <section id="servers" className="scroll-mt-24 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">服务器列表</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">选择你的下一个世界</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            {onlineTotal} 位玩家正在 {gameServers.length} 个世界中游玩
          </p>
        </div>

        <div
          role="group"
          aria-label="服务器显示模式"
          className="inline-flex w-fit items-center gap-1 rounded-lg border bg-background p-1 shadow-xs"
        >
          <Button
            type="button"
            size="sm"
            variant={view === "card" ? "secondary" : "ghost"}
            aria-pressed={view === "card"}
            onClick={() => selectView("card")}
            className="h-8"
          >
            <LayoutGrid aria-hidden="true" />
            卡片
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            aria-pressed={view === "list"}
            onClick={() => selectView("list")}
            className="h-8"
          >
            <List aria-hidden="true" />
            列表
          </Button>
        </div>
      </div>

      {view === "card" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {gameServers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {gameServers.map((server) => (
            <ServerListRow key={server.id} server={server} />
          ))}
        </div>
      )}
    </section>
  );
}
