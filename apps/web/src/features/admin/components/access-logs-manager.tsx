"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminAccessLogItem, AdminServer } from "@/features/admin/types";
import { getBrowserApiClient } from "@/lib/api/browser";
import { formatDate } from "@/lib/format";
import { fetchAdminAccessLogs } from "@/services/content";

const PAGE_SIZE = 30;

const accessMethodLabels: Record<string, string> = {
  unrestricted: "无限制",
  whitelist: "白名单",
  snapshot_fallback: "快照回退",
  banned: "封禁拦截",
  whitelist_rejected: "白名单拒绝",
  access_unavailable: "访问控制不可用",
};

const failureLabels: Record<string, string> = {
  banned: "存在游戏封禁",
  ip_banned: "IP 被封禁",
  not_whitelisted: "未通过白名单",
  access_unavailable: "访问控制服务不可用",
  no_steamid: "无法获取 SteamID",
};

const accessMethodOptions = Object.entries(accessMethodLabels);
const failureOptions = Object.entries(failureLabels);

interface Filters {
  allowed: "" | "true" | "false";
  steamId64: string;
  serverId: string;
  ipAddress: string;
  accessMethod: string;
  failureCode: string;
}

const emptyFilters: Filters = {
  allowed: "",
  steamId64: "",
  serverId: "",
  ipAddress: "",
  accessMethod: "",
  failureCode: "",
};

export function AccessLogsManager({ servers }: { servers: Pick<AdminServer, "id" | "name">[] }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debouncedFilters = useDebouncedValue(filters, 350);

  const query = useQuery({
    queryKey: ["admin-access-logs", page, debouncedFilters, search],
    queryFn: () =>
      fetchAdminAccessLogs(getBrowserApiClient(), {
        page,
        pageSize: PAGE_SIZE,
        allowed: debouncedFilters.allowed === "" ? undefined : debouncedFilters.allowed === "true",
        steamId64: debouncedFilters.steamId64,
        serverId: debouncedFilters.serverId,
        ipAddress: debouncedFilters.ipAddress,
        accessMethod: debouncedFilters.accessMethod,
        failureCode: debouncedFilters.failureCode,
        search,
      }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length + (search.trim() ? 1 : 0),
    [filters, search],
  );

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function reset() {
    setFilters(emptyFilters);
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">日志与审计</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">进服监控</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            记录玩家每次尝试进入服务器的结果：成功/失败、进服方式、IP、失败原因与时间。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Activity aria-hidden="true" />
            {total.toLocaleString("zh-CN")} 条记录
          </Badge>
          {activeFilterCount > 0 ? (
            <Badge variant="outline">{activeFilterCount} 个筛选条件</Badge>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <form onSubmit={submitSearch} className="border-b px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="relative min-w-0 flex-1">
              <label
                htmlFor="access-log-search"
                className="text-xs font-medium text-muted-foreground"
              >
                搜索
              </label>
              <Search
                className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="access-log-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="玩家名、SteamID64 或服务器名"
                className="mt-1 pl-9"
              />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <FilterSelect
                label="结果"
                value={filters.allowed}
                onChange={(value) => updateFilter("allowed", value as Filters["allowed"])}
                options={[
                  { value: "", label: "全部" },
                  { value: "true", label: "进服成功" },
                  { value: "false", label: "进服失败" },
                ]}
              />
              <FilterSelect
                label="进服方式"
                value={filters.accessMethod}
                onChange={(value) => updateFilter("accessMethod", value)}
                options={[
                  { value: "", label: "全部方式" },
                  ...accessMethodOptions.map(([value, label]) => ({ value, label })),
                ]}
              />
              <FilterSelect
                label="失败原因"
                value={filters.failureCode}
                onChange={(value) => updateFilter("failureCode", value)}
                options={[
                  { value: "", label: "全部原因" },
                  ...failureOptions.map(([value, label]) => ({ value, label })),
                ]}
              />
              <FilterSelect
                label="服务器"
                value={filters.serverId}
                onChange={(value) => updateFilter("serverId", value)}
                options={[
                  { value: "", label: "全部服务器" },
                  ...servers.map((server) => ({ value: server.id, label: server.name })),
                ]}
              />
              <FilterInput
                label="SteamID64"
                value={filters.steamId64}
                onChange={(value) => updateFilter("steamId64", value)}
                placeholder="7656..."
              />
              <FilterInput
                label="IP 地址"
                value={filters.ipAddress}
                onChange={(value) => updateFilter("ipAddress", value)}
                placeholder="203.0.113.10"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                <Search />
                搜索
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                <RotateCcw />
                重置
              </Button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">结果</th>
                <th className="px-4 py-3 font-medium">玩家</th>
                <th className="px-4 py-3 font-medium">SteamID64</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">服务器</th>
                <th className="px-4 py-3 font-medium">进服方式</th>
                <th className="px-4 py-3 font-medium">失败原因</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {query.isLoading ? (
                <TableState text="正在加载进服记录..." loading />
              ) : query.isError ? (
                <TableState
                  text={
                    query.error instanceof Error ? query.error.message : "加载失败，请稍后重试。"
                  }
                  error
                />
              ) : items.length === 0 ? (
                <TableState text="暂无进服记录。" />
              ) : (
                items.map((item) => <AccessLogRow key={item.id} item={item} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            第 {page} / {totalPages} 页 · 共 {total.toLocaleString("zh-CN")} 条
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft />
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              下一页
              <ChevronRight />
            </Button>
            {query.isFetching ? (
              <LoaderCircle
                className="size-4 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessLogRow({ item }: { item: AdminAccessLogItem }) {
  const playerHref = `/admin/player-detail?steamid=${encodeURIComponent(item.steamId64)}`;
  return (
    <tr className={item.allowed ? undefined : "bg-destructive/[0.025]"}>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
        {formatDate(item.occurredAt)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={item.allowed ? "success" : "destructive"}>
          {item.allowed ? "成功" : "失败"}
        </Badge>
      </td>
      <td className="max-w-40 px-4 py-3">
        <Link href={playerHref} className="font-medium hover:text-primary hover:underline">
          {item.playerName}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-xs">
        <Link href={playerHref} className="break-all hover:text-primary hover:underline">
          {item.steamId64}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-xs break-all">{item.ipAddress ?? "—"}</td>
      <td className="px-4 py-3 text-xs">
        <p className="font-medium">{item.serverName}</p>
        <p className="text-muted-foreground">
          :{item.serverPort}
          {item.communityName ? ` · ${item.communityName}` : ""}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={item.allowed ? "success" : "muted"}>
          {accessMethodLabels[item.accessMethod] ?? item.accessMethod}
        </Badge>
      </td>
      <td className="max-w-56 px-4 py-3 text-xs">
        {item.allowed ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div>
            <p className="font-medium text-destructive">
              {item.failureCode
                ? (failureLabels[item.failureCode] ?? item.failureCode)
                : "未知原因"}
            </p>
            {item.rejectReason ? (
              <p className="mt-0.5 line-clamp-2 text-muted-foreground" title={item.rejectReason}>
                {item.rejectReason}
              </p>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-muted-foreground">
      {label}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </label>
  );
}

function TableState({
  text,
  loading = false,
  error = false,
}: {
  text: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <tr>
      <td colSpan={8} className="px-5 py-14 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {error ? <AlertTriangle className="size-4 text-destructive" aria-hidden="true" /> : null}
          <span className={error ? "text-destructive" : undefined}>{text}</span>
        </div>
      </td>
    </tr>
  );
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
