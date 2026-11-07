"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Ban,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Hash,
  LoaderCircle,
  MessageSquareText,
  Network,
  NotebookPen,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type {
  AdminAccessLogItem,
  AdminLinkedAccount,
  AdminPlayerCandidate,
  AdminPlayerDetail,
  AdminPlayerGameBan,
  AdminPlayerIpBan,
  AdminPlayerIpGroup,
  AdminPlayerSession,
  AdminPlayerTimelineEvent,
  AdminPlayerWhitelistApplication,
} from "@/features/admin/types";
import { getBrowserApiClient } from "@/lib/api/browser";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import {
  createServerBan,
  fetchAdminPlayerDetail,
  searchAdminPlayers,
  updateAdminPlayerProfile,
} from "@/services/content";

type TabKey = "timeline" | "access" | "status" | "network" | "notes";

const tabs: { key: TabKey; label: string }[] = [
  { key: "timeline", label: "时间线" },
  { key: "access", label: "进服与在线" },
  { key: "status", label: "封禁 / 白名单" },
  { key: "network", label: "IP 关联" },
  { key: "notes", label: "内部备注" },
];

export function PlayerDetailManager({ initialSteamId = "" }: { initialSteamId?: string }) {
  const normalizedInitial = initialSteamId.trim();
  const [searchInput, setSearchInput] = useState(normalizedInitial);
  const [selectedSteamId, setSelectedSteamId] = useState(normalizedInitial);
  const [candidates, setCandidates] = useState<AdminPlayerCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<TabKey>("timeline");
  const [noteOpen, setNoteOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const { toast } = useToast();

  const detailQuery = useQuery({
    queryKey: ["admin-player-detail", selectedSteamId],
    queryFn: () => fetchAdminPlayerDetail(getBrowserApiClient(), selectedSteamId),
    enabled: Boolean(selectedSteamId),
    retry: 0,
  });

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = searchInput.trim();
    if (!value) {
      setSearchError("请输入 SteamID、玩家名或 IP。");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setCandidates([]);
    try {
      const results = await searchAdminPlayers(getBrowserApiClient(), value);
      if (results.length === 0) {
        setSearchError("没有找到匹配玩家。");
        return;
      }
      if (results.length === 1) {
        const first = results[0];
        if (!first) {
          setSearchError("没有找到匹配玩家。");
          return;
        }
        selectPlayer(first.steamId64);
        return;
      }
      setCandidates(results);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "搜索失败，请稍后重试。");
    } finally {
      setSearching(false);
    }
  }

  function selectPlayer(steamId64: string) {
    setSelectedSteamId(steamId64);
    setSearchInput(steamId64);
    setCandidates([]);
    setSearchError(null);
    setTab("timeline");
    window.history.replaceState(
      null,
      "",
      `/admin/player-detail?steamid=${encodeURIComponent(steamId64)}`,
    );
  }

  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">核心管理</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">玩家详情</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          汇总玩家的在线状态、服务器会话、进服记录、封禁、白名单、IP 关联与内部备注。
        </p>
      </div>

      <form onSubmit={handleSearch} className="rounded-xl border bg-card p-5">
        <Label htmlFor="player-detail-search">查询玩家全息档案</Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="player-detail-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="SteamID64 / SteamID2 / SteamID3 / 玩家名 / IP"
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? <LoaderCircle className="animate-spin" /> : <Search />}
            查询
          </Button>
          {selectedSteamId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedSteamId("");
                setSearchInput("");
                setCandidates([]);
                setSearchError(null);
                window.history.replaceState(null, "", "/admin/player-detail");
              }}
            >
              <RotateCcw />
              清空
            </Button>
          ) : null}
        </div>
        {searchError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {searchError}
          </p>
        ) : null}
        {candidates.length > 0 ? (
          <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-2">
            <p className="px-2 text-xs text-muted-foreground">
              找到 {candidates.length} 个匹配玩家，请选择：
            </p>
            {candidates.map((candidate) => (
              <button
                key={candidate.steamId64}
                type="button"
                onClick={() => selectPlayer(candidate.steamId64)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-background"
              >
                <UserAvatar name={candidate.name} avatarUrl={candidate.avatarUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{candidate.name}</span>
                    {candidate.online ? <Badge variant="success">在线</Badge> : null}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] break-all text-muted-foreground">
                    {candidate.steamId64}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {candidate.lastSeenAt ? formatRelativeTime(candidate.lastSeenAt) : "-"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </form>

      {!selectedSteamId ? (
        <EmptyCard
          icon={UserRound}
          title="输入 SteamID、玩家名或 IP 开始查询"
          description="也可以直接从「进服监控」点击玩家名进入详情。"
        />
      ) : detailQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border bg-card px-5 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          正在加载玩家资料...
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-12 text-center">
          <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden="true" />
          <p className="mt-3 font-medium text-destructive">加载玩家资料失败</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "请检查 SteamID 是否正确。"}
          </p>
        </div>
      ) : detail ? (
        <>
          <PlayerHero
            detail={detail}
            onBan={() => setBanOpen(true)}
            onEditNote={() => {
              setTab("notes");
              setNoteOpen(true);
            }}
            onExport={() => {
              const blob = new Blob([JSON.stringify(detail, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `player-${detail.profile.steamId64}.json`;
              anchor.click();
              URL.revokeObjectURL(url);
              toast("玩家调查报告已导出");
            }}
            onCopy={async () => {
              try {
                await navigator.clipboard.writeText(detail.profile.steamId64);
                toast("已复制 SteamID64");
              } catch {
                toast("复制失败", "error");
              }
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="进服成功" value={detail.stats.accessSuccess} tone="success" />
            <StatCard
              label="进服失败"
              value={detail.stats.accessFailure}
              tone={detail.stats.accessFailure > 0 ? "danger" : "default"}
            />
            <StatCard label="服务器会话" value={detail.stats.sessionCount} />
            <StatCard label="累计时长" value={formatDuration(detail.stats.totalPlaySeconds)} />
            <StatCard
              label="有效游戏封禁"
              value={detail.stats.activeBanCount}
              tone={detail.stats.activeBanCount > 0 ? "danger" : "success"}
            />
            <StatCard label="已知 IP" value={detail.stats.knownIpCount} />
            <StatCard
              label="同 IP 关联账号"
              value={detail.stats.linkedAccountCount}
              tone={detail.stats.linkedAccountCount > 0 ? "warning" : "default"}
            />
            <StatCard
              label="论坛主题 / 回复"
              value={`${detail.stats.topics} / ${detail.stats.replies}`}
            />
          </div>

          <div className="rounded-xl border bg-card">
            <div
              role="tablist"
              aria-label="玩家详情分类"
              className="flex gap-1 overflow-x-auto border-b px-3 py-2"
            >
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                  className={
                    tab === item.key
                      ? "shrink-0 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                      : "shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === "timeline" ? <TimelinePanel detail={detail} /> : null}
              {tab === "access" ? <AccessPanel detail={detail} /> : null}
              {tab === "status" ? <StatusPanel detail={detail} /> : null}
              {tab === "network" ? <NetworkPanel detail={detail} /> : null}
              {tab === "notes" ? (
                <NotesPanel detail={detail} onEdit={() => setNoteOpen(true)} />
              ) : null}
            </div>
          </div>

          <PlayerBanModal
            open={banOpen}
            onOpenChange={setBanOpen}
            detail={detail}
            onSuccess={async () => {
              setBanOpen(false);
              await detailQuery.refetch();
              toast("游戏封禁已创建；网站账号仍可正常登录。");
            }}
          />
          <PlayerNoteModal
            key={`${detail.internalProfile.updatedAt ?? "new"}-${noteOpen ? "open" : "closed"}`}
            open={noteOpen}
            onOpenChange={setNoteOpen}
            detail={detail}
            onSuccess={async () => {
              setNoteOpen(false);
              await detailQuery.refetch();
              toast("内部备注已保存");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function PlayerHero({
  detail,
  onBan,
  onEditNote,
  onCopy,
  onExport,
}: {
  detail: AdminPlayerDetail;
  onBan: () => void;
  onEditNote: () => void;
  onCopy: () => void;
  onExport: () => void;
}) {
  const profile = detail.profile;
  const latestIp = detail.ipGroups[0]?.ipAddress ?? null;
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight break-words">{profile.name}</h2>
              <Badge variant={profile.role === "admin" ? "success" : "muted"}>
                {roleLabel(profile.role)}
              </Badge>
              {profile.online ? (
                <Badge variant="success">在线</Badge>
              ) : (
                <Badge variant="muted">离线</Badge>
              )}
              {profile.isDisabled ? <Badge variant="destructive">网站账号已禁用</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono transition-colors hover:bg-muted"
                title="复制 SteamID64"
              >
                <Copy className="size-3" aria-hidden="true" />
                {profile.steamId64}
              </button>
              <a
                href={`https://steamcommunity.com/profiles/${profile.steamId64}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                Steam 主页
              </a>
              <a
                href={`https://kz.threi.cn/players/${profile.steamId64}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                KZ 记录
              </a>
            </div>
            <div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              <p>
                首次记录：<span className="text-foreground">{formatDate(profile.firstSeenAt)}</span>
              </p>
              <p>
                最后活跃：<span className="text-foreground">{formatDate(profile.lastSeenAt)}</span>
              </p>
              <p>
                网站注册：
                <span className="text-foreground">{formatDate(profile.registeredAt)}</span>
              </p>
              <p>
                最近登录：<span className="text-foreground">{formatDate(profile.lastLoginAt)}</span>
              </p>
              {latestIp ? (
                <p className="sm:col-span-2">
                  最近 IP：<span className="font-mono text-foreground">{latestIp}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="destructive" onClick={onBan}>
            <Ban />
            发起封禁
          </Button>
          <Button type="button" variant="outline" onClick={onEditNote}>
            <NotebookPen />
            编辑备注
          </Button>
          <Button type="button" variant="outline" onClick={onExport}>
            <Download />
            导出 JSON
          </Button>
        </div>
      </div>

      {detail.onlineServers.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm">
          <Activity className="size-4 text-success" aria-hidden="true" />
          <span className="text-muted-foreground">当前在线：</span>
          {detail.onlineServers.map((server) => (
            <Badge key={server.id} variant="success">
              {server.name} · {server.map}
            </Badge>
          ))}
        </div>
      ) : null}

      {detail.internalProfile.note || detail.internalProfile.tags.length > 0 ? (
        <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <NotebookPen className="size-3.5 text-warning" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground">内部备注</span>
            {detail.internalProfile.tags.map((tag) => (
              <Badge key={tag} variant="warning">
                #{tag}
              </Badge>
            ))}
          </div>
          {detail.internalProfile.note ? (
            <p className="mt-1.5 text-sm whitespace-pre-wrap">{detail.internalProfile.note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>
        {typeof value === "number" ? value.toLocaleString("zh-CN") : value}
      </p>
    </div>
  );
}

function TimelinePanel({ detail }: { detail: AdminPlayerDetail }) {
  const [kind, setKind] = useState("all");
  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of detail.timeline) {
      counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [detail.timeline]);
  const events =
    kind === "all" ? detail.timeline : detail.timeline.filter((event) => event.kind === kind);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setKind("all")}
          className={
            kind === "all"
              ? "rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              : "rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
          }
        >
          全部 {detail.timelineTotal}
        </button>
        {kinds.map(([value, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={
              kind === value
                ? "rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                : "rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            }
          >
            {timelineKindLabel(value)} {count}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">暂无事件记录。</p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <TimelineRow key={event.id} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({ event }: { event: AdminPlayerTimelineEvent }) {
  const tone = timelineTone(event.kind);
  return (
    <li className="flex gap-3">
      <span
        className={`mt-1.5 grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${tone}`}
        aria-hidden="true"
      >
        {timelineKindMark(event.kind)}
      </span>
      <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{event.title}</p>
          <time className="text-[11px] text-muted-foreground" dateTime={event.occurredAt}>
            {formatDate(event.occurredAt)}
          </time>
        </div>
        {event.description ? (
          <p className="mt-0.5 text-xs break-words text-muted-foreground">{event.description}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {event.serverName ? <span>服务器：{event.serverName}</span> : null}
          {event.actor ? <span>操作人：{event.actor}</span> : null}
        </div>
      </div>
    </li>
  );
}

function AccessPanel({ detail }: { detail: AdminPlayerDetail }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={Globe2} title="当前在线" count={detail.onlineServers.length} />
        {detail.onlineServers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">当前没有在已上报服务器中。</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {detail.onlineServers.map((server) => (
              <div key={server.id} className="rounded-lg border bg-background px-3 py-2">
                <p className="text-sm font-medium">{server.name}</p>
                <p className="text-xs text-muted-foreground">
                  {server.map} · 进入于 {formatDate(server.connectedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle icon={Activity} title="进服尝试" count={detail.accessLogs.length} />
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">结果</th>
                <th className="px-3 py-2 font-medium">服务器</th>
                <th className="px-3 py-2 font-medium">方式</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">原因</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.accessLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    暂无进服尝试日志。
                  </td>
                </tr>
              ) : (
                detail.accessLogs.map((log) => <AccessLogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle icon={Hash} title="服务器会话" count={detail.sessions.length} />
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">服务器</th>
                <th className="px-3 py-2 font-medium">进入时间</th>
                <th className="px-3 py-2 font-medium">退出时间</th>
                <th className="px-3 py-2 font-medium">时长</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    暂无服务器会话记录。
                  </td>
                </tr>
              ) : (
                detail.sessions.map((session) => <SessionRow key={session.id} session={session} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AccessLogRow({ log }: { log: AdminAccessLogItem }) {
  return (
    <tr className={log.allowed ? undefined : "bg-destructive/[0.025]"}>
      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
        {formatDate(log.occurredAt)}
      </td>
      <td className="px-3 py-2">
        <Badge variant={log.allowed ? "success" : "destructive"}>
          {log.allowed ? "成功" : "失败"}
        </Badge>
      </td>
      <td className="px-3 py-2 text-xs">
        {log.serverName}:{log.serverPort}
      </td>
      <td className="px-3 py-2 text-xs">{accessMethodLabel(log.accessMethod)}</td>
      <td className="px-3 py-2 font-mono text-xs break-all">{log.ipAddress ?? "—"}</td>
      <td className="max-w-56 px-3 py-2 text-xs">
        {log.allowed
          ? "—"
          : [log.failureCode ? failureLabel(log.failureCode) : null, log.rejectReason]
              .filter(Boolean)
              .join(" · ") || "未知原因"}
      </td>
    </tr>
  );
}

function SessionRow({ session }: { session: AdminPlayerSession }) {
  return (
    <tr>
      <td className="px-3 py-2 text-xs">{session.serverName}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(session.joinedAt)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {session.leftAt ? formatDate(session.leftAt) : "仍在线"}
      </td>
      <td className="px-3 py-2 text-xs">{formatDuration(session.durationSeconds)}</td>
      <td className="px-3 py-2 font-mono text-xs break-all">{session.ipAddress ?? "—"}</td>
    </tr>
  );
}

function StatusPanel({ detail }: { detail: AdminPlayerDetail }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={Ban} title="游戏封禁" count={detail.gameBans.length} />
        {detail.gameBans.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">暂无封禁记录。</p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.gameBans.map((ban) => (
              <GameBanCard key={ban.id} ban={ban} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle icon={ShieldAlert} title="IP 封禁" count={detail.ipBans.length} />
        {detail.ipBans.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">暂无 IP 封禁记录。</p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.ipBans.map((ban) => (
              <IpBanCard key={ban.id} ban={ban} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          icon={ShieldCheck}
          title="白名单记录"
          count={detail.whitelistApplications.length + detail.whitelistEntries.length}
        />
        <div className="mt-3 space-y-2">
          {detail.whitelistEntries.map((entry, index) => (
            <div
              key={`entry-${index}`}
              className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">已通过</Badge>
                <span>{entry.serverName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.createdAt)}
                  {entry.addedBy ? ` · ${entry.addedBy}` : ""}
                </span>
              </div>
            </div>
          ))}
          {detail.whitelistApplications.map((application) => (
            <WhitelistCard key={application.id} application={application} />
          ))}
          {detail.whitelistApplications.length === 0 && detail.whitelistEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无白名单记录。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function GameBanCard({ ban }: { ban: AdminPlayerGameBan }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ban.isActive ? "destructive" : "muted"}>
          {ban.isActive ? "生效中" : "已失效"}
        </Badge>
        <Badge variant="outline">{ban.scope === "global" ? "全服" : ban.serverName}</Badge>
        <span className="text-xs text-muted-foreground">
          {formatDate(ban.createdAt)} · {ban.createdBy}
        </span>
        <span className="text-xs text-muted-foreground">
          到期：{ban.expiresAt ? formatDate(ban.expiresAt) : "永久"}
        </span>
      </div>
      <p className="mt-1 text-sm break-words">{ban.reason}</p>
      {ban.liftedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          已于 {formatDate(ban.liftedAt)} 由 {ban.liftedBy ?? "系统"} 解除
        </p>
      ) : null}
    </div>
  );
}

function IpBanCard({ ban }: { ban: AdminPlayerIpBan }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ban.isActive ? "destructive" : "muted"}>
          {ban.isActive ? "生效中" : "已失效"}
        </Badge>
        <span className="font-mono text-xs">{ban.ipAddress}</span>
        <span className="text-xs text-muted-foreground">
          {formatDate(ban.createdAt)} · {ban.createdBy}
        </span>
        <span className="text-xs text-muted-foreground">
          到期：{ban.expiresAt ? formatDate(ban.expiresAt) : "永久"}
        </span>
      </div>
      <p className="mt-1 text-sm break-words">{ban.reason}</p>
      {ban.liftedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          已于 {formatDate(ban.liftedAt)} 由 {ban.liftedBy ?? "系统"} 解除
        </p>
      ) : null}
    </div>
  );
}

function WhitelistCard({ application }: { application: AdminPlayerWhitelistApplication }) {
  const statusVariant =
    application.status === "approved"
      ? "success"
      : application.status === "rejected"
        ? "destructive"
        : "warning";
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant}>{whitelistStatusLabel(application.status)}</Badge>
        <span className="text-xs text-muted-foreground">
          {formatDate(application.createdAt)} · {application.serverName}
        </span>
        {application.reviewedAt ? (
          <span className="text-xs text-muted-foreground">
            审核：{formatDate(application.reviewedAt)}
            {application.reviewedBy ? ` · ${application.reviewedBy}` : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm break-words">{application.message}</p>
      {application.reviewNote ? (
        <p className="mt-1 text-xs text-muted-foreground">审核意见：{application.reviewNote}</p>
      ) : null}
    </div>
  );
}

function NetworkPanel({ detail }: { detail: AdminPlayerDetail }) {
  if (detail.ipGroups.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">暂无 IP 记录。</p>;
  }
  return (
    <div className="space-y-4">
      {detail.ipGroups.map((group) => (
        <IpGroupCard key={group.ipAddress} group={group} />
      ))}
    </div>
  );
}

function IpGroupCard({ group }: { group: AdminPlayerIpGroup }) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Network className="size-4 text-primary" aria-hidden="true" />
          <span className="font-mono text-sm font-medium">{group.ipAddress}</span>
          <Badge variant="secondary">{group.accessCount} 次出现</Badge>
          {group.linkedAccounts.some((account) => account.hasActiveIpBan) ? (
            <Badge variant="destructive">该 IP 存在封禁</Badge>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {formatDate(group.firstSeenAt)} → {formatDate(group.lastSeenAt)}
        </p>
      </div>
      <div className="divide-y">
        {group.linkedAccounts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">该 IP 暂无其他关联账号。</p>
        ) : (
          group.linkedAccounts.map((account) => (
            <LinkedAccountRow key={account.steamId64} account={account} />
          ))
        )}
      </div>
    </section>
  );
}

function LinkedAccountRow({ account }: { account: AdminLinkedAccount }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={`/admin/player-detail?steamid=${encodeURIComponent(account.steamId64)}`}
        className="flex min-w-0 items-center gap-2 hover:text-primary"
      >
        <UserAvatar name={account.name} avatarUrl={account.avatarUrl} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{account.name}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">
            {account.steamId64}
          </span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5">
        {account.online ? <Badge variant="success">在线</Badge> : null}
        {account.hasActiveBan ? <Badge variant="destructive">游戏封禁</Badge> : null}
        {account.hasActiveIpBan ? <Badge variant="destructive">IP 封禁</Badge> : null}
        {account.hasWhitelist ? <Badge variant="success">白名单</Badge> : null}
        <span className="text-[11px] text-muted-foreground">
          {formatRelativeTime(account.lastSeenAt)}
        </span>
      </div>
    </div>
  );
}

function NotesPanel({ detail, onEdit }: { detail: AdminPlayerDetail; onEdit: () => void }) {
  const profile = detail.internalProfile;
  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={NotebookPen} title="内部备注" />
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <NotebookPen />
            编辑备注
          </Button>
        </div>
        {profile.note ? (
          <p className="mt-3 rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap">
            {profile.note}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">暂无内部备注。</p>
        )}
        {profile.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <Badge key={tag} variant="warning">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {profile.updatedAt
            ? `最后更新：${formatDate(profile.updatedAt)}${profile.updatedBy ? ` · ${profile.updatedBy}` : ""}`
            : "尚未保存过内部备注。"}
        </p>
      </section>

      <section>
        <SectionTitle
          icon={MessageSquareText}
          title="备注变更历史"
          count={profile.history.length}
        />
        {profile.history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">暂无备注历史。</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {profile.history.map((item) => (
              <li key={item.id} className="rounded-lg border bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{item.changedBy ?? "系统"}</span>
                  <time dateTime={item.changedAt}>{formatDate(item.changedAt)}</time>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{item.note || "（清空备注）"}</p>
                {item.tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="muted">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <SectionTitle icon={Users} title="论坛活动" />
        <p className="mt-3 text-sm text-muted-foreground">
          发布主题 {detail.stats.topics} 个，回复 {detail.stats.replies} 条。
        </p>
      </section>
    </div>
  );
}

function PlayerBanModal({
  open,
  onOpenChange,
  detail,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AdminPlayerDetail;
  onSuccess: () => void;
}) {
  const [duration, setDuration] = useState("permanent");
  const [reason, setReason] = useState("违反服务器规则");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!reason.trim()) {
      setError("请填写封禁原因。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createServerBan(getBrowserApiClient(), {
        steamId64: detail.profile.steamId64,
        playerName: detail.profile.name,
        reason: reason.trim(),
        expiresInHours: duration === "permanent" ? null : Number(duration),
        scope: "global",
      });
      onSuccess();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "封禁失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="发起全服游戏封禁"
      description="封禁只影响游戏服务器，网站账号仍可正常登录。若网站已知该玩家的 IP，会自动同步 IP 封禁。"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button type="submit" form="player-ban-form" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Ban />}
            创建封禁
          </Button>
        </div>
      }
    >
      <form id="player-ban-form" onSubmit={submit} className="space-y-4">
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium">{detail.profile.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {detail.profile.steamId64}
            {detail.ipGroups[0]?.ipAddress ? ` · ${detail.ipGroups[0].ipAddress}` : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="player-ban-duration">封禁时长</Label>
          <select
            id="player-ban-duration"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="permanent">永久</option>
            <option value="24">24 小时</option>
            <option value="168">7 天</option>
            <option value="720">30 天</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="player-ban-reason">封禁原因</Label>
          <textarea
            id="player-ban-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {error ? (
          <p
            className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function PlayerNoteModal({
  open,
  onOpenChange,
  detail,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AdminPlayerDetail;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState(detail.internalProfile.note);
  const [tagsInput, setTagsInput] = useState(detail.internalProfile.tags.join(", "));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const tags = parseTags(tagsInput);
    if (tags.length > 10) {
      setError("最多只能添加 10 个标签。");
      return;
    }
    if (tags.some((tag) => tag.length > 32)) {
      setError("每个标签最多 32 个字符。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateAdminPlayerProfile(getBrowserApiClient(), detail.profile.steamId64, {
        note: note.trim(),
        tags,
      });
      onSuccess();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "保存失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="编辑内部备注"
      description="仅后台管理员可见，用于记录处理结论、沟通情况与风险标签。"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button type="submit" form="player-note-form" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <NotebookPen />}
            保存备注
          </Button>
        </div>
      }
    >
      <form id="player-note-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="player-note">备注内容</Label>
          <textarea
            id="player-note"
            rows={6}
            maxLength={4000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：已确认与另一个账号为同一人；沟通后承诺不再使用违规配置。"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-right text-[11px] text-muted-foreground">{note.length} / 4000</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="player-tags">标签</Label>
          <Input
            id="player-tags"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="用逗号分隔，例如：重点关注, 代练嫌疑"
          />
          <p className="text-[11px] text-muted-foreground">
            最多 10 个标签，每个不超过 32 个字符。
          </p>
        </div>
        {error ? (
          <p
            className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Activity;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <h3 className="font-semibold">{title}</h3>
      {typeof count === "number" ? (
        <Badge variant="muted">{count.toLocaleString("zh-CN")}</Badge>
      ) : null}
    </div>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-14 text-center">
      <Icon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(/[,，\n]/)) {
    const tag = part.trim().replace(/^#/, "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} 天 ${restHours} 小时` : `${days} 天`;
}

function accessMethodLabel(value: string): string {
  return (
    {
      unrestricted: "无限制",
      whitelist: "白名单",
      snapshot_fallback: "快照回退",
      banned: "封禁拦截",
      whitelist_rejected: "白名单拒绝",
      access_unavailable: "访问控制不可用",
    }[value] ?? value
  );
}

function failureLabel(value: string): string {
  return (
    {
      banned: "存在游戏封禁",
      ip_banned: "IP 被封禁",
      not_whitelisted: "未通过白名单",
      access_unavailable: "访问控制服务不可用",
      no_steamid: "无法获取 SteamID",
    }[value] ?? value
  );
}

function whitelistStatusLabel(value: string): string {
  return (
    {
      pending: "待审核",
      approved: "已通过",
      rejected: "已驳回",
    }[value] ?? value
  );
}

function timelineKindLabel(value: string): string {
  return (
    {
      access: "进服",
      session: "服务器",
      ban: "封禁",
      whitelist: "白名单",
      forum: "论坛",
      internal: "内部备注",
    }[value] ?? value
  );
}

function timelineKindMark(value: string): string {
  return (
    {
      access: "进",
      session: "服",
      ban: "封",
      whitelist: "单",
      forum: "坛",
      internal: "注",
    }[value] ?? "事"
  );
}

function timelineTone(value: string): string {
  if (value === "ban") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (value === "whitelist") return "border-success/20 bg-success/10 text-success";
  if (value === "session") return "border-primary/20 bg-primary/10 text-primary";
  if (value === "internal") return "border-warning/20 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}
