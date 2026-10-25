"use client";

import { LayoutGrid, List, Search, Users, X } from "lucide-react";
import { useSyncExternalStore, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServerCard } from "@/features/servers/components/server-card";
import { ServerListRow } from "@/features/servers/components/server-list-row";
import {
  getOnlinePlayerTotal,
  searchServers,
  type KzServer,
} from "@/features/servers/data/servers";

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

const COLUMN_QUERIES = ["(min-width: 1280px)", "(min-width: 768px)"] as const;

function subscribeToColumns(callback: () => void) {
  const queries = COLUMN_QUERIES.map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener("change", callback));
  return () => {
    queries.forEach((query) => query.removeEventListener("change", callback));
  };
}

function getColumnCount() {
  if (window.matchMedia(COLUMN_QUERIES[0]).matches) {
    return 3;
  }
  if (window.matchMedia(COLUMN_QUERIES[1]).matches) {
    return 2;
  }
  return 1;
}

function getServerColumnCount() {
  return 3;
}

export function ServerDirectory({ servers }: { servers: KzServer[] }) {
  const view = useSyncExternalStore(subscribeToView, getViewSnapshot, getServerViewSnapshot);
  const columnCount = useSyncExternalStore(
    subscribeToColumns,
    getColumnCount,
    getServerColumnCount,
  );
  const [query, setQuery] = useState("");
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);
  const communities = Array.from(
    new Set(servers.map((server) => server.community).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "zh-CN"));
  const searchedServers = searchServers(servers, query);
  const filteredServers = communityFilter
    ? searchedServers.filter((server) => server.community === communityFilter)
    : searchedServers;
  const columns = Array.from({ length: columnCount }, () => [] as typeof filteredServers);
  filteredServers.forEach((server, index) => {
    columns[index % columnCount]!.push(server);
  });
  const onlineTotal = getOnlinePlayerTotal(servers);
  const hasFilters = query.length > 0 || communityFilter !== null;

  function clearFilters() {
    setQuery("");
    setCommunityFilter(null);
  }

  function selectView(nextView: ViewMode) {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    } catch {
      // The selection still applies for the current page session.
    }
    window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
  }

  return (
    <section id="servers" className="scroll-mt-24 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">服务器列表</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">选择 KZ 服务器</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            {onlineTotal} 位玩家在线，分布在 {servers.length} 个服务器
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

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索服务器、社区组、地图或玩家"
            aria-label="搜索服务器、社区组、地图或玩家"
            className="pr-9 pl-9"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="清空服务器搜索"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          显示 <span className="font-medium text-foreground">{filteredServers.length}</span> /{" "}
          {servers.length} 个服务器
        </p>
      </div>

      {communities.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">社区组</span>
          <Button
            type="button"
            size="sm"
            variant={communityFilter === null ? "secondary" : "outline"}
            aria-pressed={communityFilter === null}
            onClick={() => setCommunityFilter(null)}
            className="h-7"
          >
            全部
          </Button>
          {communities.map((community) => (
            <Button
              key={community}
              type="button"
              size="sm"
              variant={communityFilter === community ? "secondary" : "outline"}
              aria-pressed={communityFilter === community}
              onClick={() => setCommunityFilter(community)}
              className="h-7"
            >
              {community}
            </Button>
          ))}
        </div>
      ) : null}

      {filteredServers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-14 text-center">
          <Search className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {servers.length === 0 ? "暂时还没有服务器记录" : "没有找到匹配的服务器"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {servers.length === 0
                ? "服务器接入后，这里会显示真实的地图、在线玩家与连接地址。"
                : "可以尝试服务器名称、社区组、地图名、地区或玩家昵称。"}
            </p>
          </div>
          {servers.length > 0 && hasFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              清空筛选
            </Button>
          ) : null}
        </div>
      ) : view === "card" ? (
        <div
          className={
            columnCount === 3
              ? "grid grid-cols-3 items-start gap-4"
              : columnCount === 2
                ? "grid grid-cols-2 items-start gap-4"
                : "grid grid-cols-1 items-start gap-4"
          }
        >
          {columns.map((column, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-4">
              {column.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServers.map((server) => (
            <ServerListRow key={server.id} server={server} />
          ))}
        </div>
      )}
    </section>
  );
}
