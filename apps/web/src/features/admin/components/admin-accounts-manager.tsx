"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, ShieldCheck, ShieldOff, Trash2, UserCheck } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminAccount, AdminLookupUser } from "@/features/admin/types";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { getBrowserApiClient } from "@/lib/api/browser";
import {
  addAdminAccount,
  fetchAdminUserLookup,
  removeAdminAccount,
  setAdminDisabled,
} from "@/services/content";

type SelectedAdmin = AdminLookupUser & { placeholder?: boolean };
type LookupState = "idle" | "loading" | "found" | "missing" | "error";

export function AdminAccountsManager({
  admins: initialAdmins,
  currentSteamId,
}: {
  admins: AdminAccount[];
  currentSteamId: string;
}) {
  const router = useRouter();
  const [admins, setAdmins] = useState(initialAdmins);
  const [steamId64, setSteamId64] = useState("");
  const [lookup, setLookup] = useState<AdminLookupUser | null>(null);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [selected, setSelected] = useState<SelectedAdmin | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busySteamId, setBusySteamId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const id = steamId64.trim();
    if (id.length !== 17) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchAdminUserLookup(getBrowserApiClient(), id)
        .then((response) => {
          if (cancelled) {
            return;
          }
          setLookup(response.user);
          setLookupState(response.user ? "found" : "missing");
        })
        .catch(() => {
          if (!cancelled) {
            setLookupState("error");
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [steamId64]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function showError(error: unknown) {
    setFeedback(error instanceof Error ? error.message : "操作失败，请稍后重试");
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setFeedback("请先查询并选择要添加的 Steam 用户。");
      return;
    }
    if (selected.role === "admin" && !selected.placeholder) {
      setFeedback("该用户已经是管理员。");
      return;
    }
    setBusySteamId("add");
    setFeedback(null);
    try {
      const admin = await addAdminAccount(getBrowserApiClient(), selected.steamId64);
      setAdmins((current) => [
        ...current.filter((item) => item.steamId64 !== admin.steamId64),
        admin,
      ]);
      setSteamId64("");
      setSelected(null);
      setLookup(null);
      setLookupState("idle");
      setFeedback(`${admin.name} 已添加为管理员。对方下次登录后即可看到管理面板。`);
      refresh();
    } catch (error) {
      showError(error);
    } finally {
      setBusySteamId(null);
    }
  }

  async function handleRemove(admin: AdminAccount) {
    if (!window.confirm(`确定取消 ${admin.name} 的管理员权限吗？`)) {
      return;
    }
    setFeedback(null);
    setBusySteamId(admin.steamId64);
    try {
      await removeAdminAccount(getBrowserApiClient(), admin.steamId64);
      setAdmins((current) => current.filter((item) => item.steamId64 !== admin.steamId64));
      setFeedback("已取消管理员权限，并撤销该账号会话。");
      refresh();
    } catch (error) {
      showError(error);
    } finally {
      setBusySteamId(null);
    }
  }

  async function handleDisable(admin: AdminAccount) {
    const reason = window.prompt(`禁用 ${admin.name} 的原因（可选）`) ?? undefined;
    if (reason === undefined) {
      return;
    }
    if (!window.confirm(`禁用后 ${admin.name} 将立即退出所有会话，确定继续吗？`)) {
      return;
    }
    setFeedback(null);
    setBusySteamId(admin.steamId64);
    try {
      await setAdminDisabled(getBrowserApiClient(), admin.steamId64, true, reason);
      setAdmins((current) =>
        current.map((item) =>
          item.steamId64 === admin.steamId64
            ? { ...item, isDisabled: true, disabledReason: reason || null }
            : item,
        ),
      );
      setFeedback("账号已禁用，所有会话已撤销。");
      refresh();
    } catch (error) {
      showError(error);
    } finally {
      setBusySteamId(null);
    }
  }

  async function handleEnable(admin: AdminAccount) {
    setFeedback(null);
    setBusySteamId(admin.steamId64);
    try {
      await setAdminDisabled(getBrowserApiClient(), admin.steamId64, false);
      setAdmins((current) =>
        current.map((item) =>
          item.steamId64 === admin.steamId64
            ? { ...item, isDisabled: false, disabledReason: null }
            : item,
        ),
      );
      setFeedback("账号已启用。");
      refresh();
    } catch (error) {
      showError(error);
    } finally {
      setBusySteamId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">管理员</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">管理员管理</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            新增、取消权限或禁用管理员。被禁用账号的现有会话会立即失效。
          </p>
        </div>
        <Badge variant="secondary">{admins.length} 位管理员</Badge>
      </div>

      {feedback ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">管理员列表</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              当前账号不能取消自己的权限或禁用自己；最后一位可用管理员不能操作。
            </p>
          </div>
          <div className="divide-y">
            {admins.length > 0 ? (
              admins.map((admin) => {
                const self = admin.steamId64 === currentSteamId;
                const busy = busySteamId === admin.steamId64;
                return (
                  <article
                    key={admin.steamId64}
                    className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <UserAvatar name={admin.name} avatarUrl={admin.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <p className="font-medium break-words">
                          {admin.name}
                          {self ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              （你）
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {admin.isDisabled ? (
                            <Badge variant="destructive">已禁用</Badge>
                          ) : (
                            <Badge variant="success">
                              <ShieldCheck aria-hidden="true" />
                              正常
                            </Badge>
                          )}
                          <span className="font-mono text-[11px] break-all text-muted-foreground">
                            {admin.steamId64}
                          </span>
                        </div>
                        {admin.isDisabled && admin.disabledReason ? (
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            禁用原因：{admin.disabledReason}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span>最近登录 {formatRelativeTime(admin.lastLoginAt)}</span>
                          <span>{formatDate(admin.createdAt)} 加入</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
                      {admin.isDisabled ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleEnable(admin)}
                        >
                          {busy ? <LoaderCircle className="animate-spin" /> : <UserCheck />}
                          启用
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={self || busy}
                          onClick={() => void handleDisable(admin)}
                        >
                          {busy ? <LoaderCircle className="animate-spin" /> : <ShieldOff />}
                          禁用
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={self || busy}
                        onClick={() => void handleRemove(admin)}
                      >
                        <Trash2 aria-hidden="true" />
                        取消管理员
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                还没有管理员记录。
              </p>
            )}
          </div>
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4">
            <div>
              <h2 className="font-semibold">新增管理员</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                输入 SteamID64 后选择玩家，再添加为管理员。对方不需要立即在线。
              </p>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="relative space-y-1.5">
                <Label htmlFor="admin-steam-id">SteamID64</Label>
                <Input
                  id="admin-steam-id"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={17}
                  placeholder="76561198000000000"
                  value={steamId64}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "").slice(0, 17);
                    setSteamId64(value);
                    setSelected(null);
                    setLookup(null);
                    setLookupState(value.length === 17 ? "loading" : "idle");
                  }}
                />
                {steamId64.length === 17 ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border bg-background p-2 shadow-lg">
                    {lookupState === "loading" ? (
                      <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        正在查询玩家…
                      </p>
                    ) : lookupState === "found" && lookup ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(lookup);
                          setLookup(null);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <UserAvatar name={lookup.name} avatarUrl={lookup.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{lookup.name}</span>
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {lookup.steamId64}
                          </span>
                        </span>
                        <span className="shrink-0">
                          {lookup.role === "admin" ? (
                            <Badge variant="success">已是管理员</Badge>
                          ) : lookup.isDisabled ? (
                            <Badge variant="destructive">已禁用</Badge>
                          ) : (
                            <Badge variant="muted">成员</Badge>
                          )}
                        </span>
                      </button>
                    ) : lookupState === "missing" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelected({
                            steamId64,
                            name: `Steam 用户 ${steamId64.slice(-6)}`,
                            avatarUrl: null,
                            role: "member",
                            isDisabled: false,
                            isSystem: false,
                            placeholder: true,
                          });
                          setLookupState("idle");
                        }}
                        className="w-full rounded-lg px-2 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        未找到已登录玩家。选择该 SteamID 后仍可创建占位管理员。
                      </button>
                    ) : lookupState === "error" ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        查询失败，请稍后重试。
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {selected ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                  <UserAvatar name={selected.name} avatarUrl={selected.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{selected.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {selected.steamId64}
                    </p>
                  </div>
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  busySteamId === "add" ||
                  !selected ||
                  (!selected.placeholder && selected.role === "admin")
                }
              >
                {busySteamId === "add" ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                添加管理员
              </Button>
            </form>
            <p className="text-xs leading-relaxed text-muted-foreground">
              生产环境建议至少保留两位正常管理员，避免单人账号丢失后无法管理。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
