"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  RotateCcw,
  Trash2,
  VolumeX,
  Volume2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminForumReply, AdminForumTopic, AdminForumUser } from "@/features/admin/types";
import type { ForumCategory } from "@/features/forum/types";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { getBrowserApiClient } from "@/lib/api/browser";
import { useToast } from "@/components/ui/toast";
import {
  deleteAdminReply,
  deleteAdminTopic,
  muteForumUser,
  restoreAdminReply,
  restoreAdminTopic,
  unmuteForumUser,
  updateAdminReply,
  updateAdminTopic,
} from "@/services/content";

type Tab = "topics" | "replies" | "users";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "topics", label: "主题" },
  { id: "replies", label: "回复" },
  { id: "users", label: "用户" },
];

export function ForumModerationManager({
  topics: initialTopics,
  replies: initialReplies,
  users: initialUsers,
  categories,
}: {
  topics: AdminForumTopic[];
  replies: AdminForumReply[];
  users: AdminForumUser[];
  categories: ForumCategory[];
}) {
  const [tab, setTab] = useState<Tab>("topics");
  const [topics, setTopics] = useState(initialTopics);
  const [replies, setReplies] = useState(initialReplies);
  const [users, setUsers] = useState(initialUsers);
  const [editingTopic, setEditingTopic] = useState<AdminForumTopic | null>(null);
  const [editingReply, setEditingReply] = useState<AdminForumReply | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<AdminForumTopic | null>(null);
  const [deleteReplyTarget, setDeleteReplyTarget] = useState<AdminForumReply | null>(null);

  const [topicForm, setTopicForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    categorySlug: "",
    tags: "",
    pinned: false,
    hot: false,
  });
  const [replyContent, setReplyContent] = useState("");

  function beginTopicEdit(topic: AdminForumTopic) {
    setEditingTopic(topic);
    setTopicForm({
      title: topic.title,
      excerpt: topic.excerpt,
      content: topic.content,
      categorySlug: topic.categorySlug,
      tags: topic.tags.join(", "),
      pinned: topic.pinned,
      hot: topic.hot,
    });
    setFeedback(null);
  }

  const { toast } = useToast();

  async function saveTopic() {
    if (!editingTopic) {
      return;
    }
    setBusy("topic-edit");
    setFeedback(null);
    try {
      await updateAdminTopic(getBrowserApiClient(), editingTopic.slug, {
        title: topicForm.title,
        excerpt: topicForm.excerpt,
        content: topicForm.content,
        categorySlug: topicForm.categorySlug,
        tags: topicForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        pinned: topicForm.pinned,
        hot: topicForm.hot,
      });
      setTopics((current) =>
        current.map((topic) =>
          topic.slug === editingTopic.slug
            ? {
                ...topic,
                title: topicForm.title,
                excerpt: topicForm.excerpt,
                content: topicForm.content,
                categorySlug: topicForm.categorySlug,
                categoryName:
                  categories.find((category) => category.slug === topicForm.categorySlug)?.name ??
                  topic.categoryName,
                tags: topicForm.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                pinned: topicForm.pinned,
                hot: topicForm.hot,
              }
            : topic,
        ),
      );
      setEditingTopic(null);
      setFeedback("主题已更新。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function toggleTopic(topic: AdminForumTopic) {
    if (topic.isDeleted) {
      setBusy(`topic-${topic.slug}`);
      try {
        await restoreAdminTopic(getBrowserApiClient(), topic.slug);
        setTopics((current) =>
          current.map((item) =>
            item.slug === topic.slug ? { ...item, isDeleted: false, deletedAt: null } : item,
          ),
        );
        setFeedback("主题已恢复。");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "恢复失败。");
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy(`topic-${topic.slug}`);
    try {
      await deleteAdminTopic(getBrowserApiClient(), topic.slug);
      setTopics((current) =>
        current.map((item) =>
          item.slug === topic.slug
            ? { ...item, isDeleted: true, deletedAt: new Date().toISOString() }
            : item,
        ),
      );
      setDeleteTopicTarget(null);
      setFeedback("主题已删除，可在列表中恢复。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setBusy(null);
    }
  }

  function beginReplyEdit(reply: AdminForumReply) {
    setEditingReply(reply);
    setReplyContent(reply.content);
    setFeedback(null);
  }

  async function saveReply() {
    if (!editingReply) {
      return;
    }
    setBusy("reply-edit");
    try {
      await updateAdminReply(getBrowserApiClient(), editingReply.id, replyContent);
      setReplies((current) =>
        current.map((reply) =>
          reply.id === editingReply.id ? { ...reply, content: replyContent } : reply,
        ),
      );
      setEditingReply(null);
      setFeedback("回复已更新。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setBusy(null);
    }
  }

  async function toggleReply(reply: AdminForumReply) {
    setBusy(`reply-${reply.id}`);
    try {
      if (reply.isDeleted) {
        await restoreAdminReply(getBrowserApiClient(), reply.id);
        setReplies((current) =>
          current.map((item) =>
            item.id === reply.id ? { ...item, isDeleted: false, deletedAt: null } : item,
          ),
        );
        setFeedback("回复已恢复。");
      } else {
        await deleteAdminReply(getBrowserApiClient(), reply.id);
        setReplies((current) =>
          current.map((item) =>
            item.id === reply.id
              ? { ...item, isDeleted: true, deletedAt: new Date().toISOString() }
              : item,
          ),
        );
        setDeleteReplyTarget(null);
        setFeedback("回复已删除，可在列表中恢复。");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setBusy(null);
    }
  }

  async function toggleMute(user: AdminForumUser) {
    setBusy(`user-mute-${user.steamId64}`);
    setFeedback(null);
    try {
      if (user.isMuted) {
        await unmuteForumUser(getBrowserApiClient(), user.steamId64);
        setUsers((current) =>
          current.map((item) =>
            item.steamId64 === user.steamId64
              ? { ...item, isMuted: false, muteReason: null, mutedUntil: null }
              : item,
          ),
        );
        setFeedback(`${user.name} 已解除禁言。`);
      } else {
        const reason = window.prompt(`禁言 ${user.name} 的原因`);
        if (!reason) {
          return;
        }
        const hoursText = window.prompt("禁言时长（小时，留空为永久）", "168");
        if (hoursText === null) {
          return;
        }
        const hours = hoursText.trim() ? Number(hoursText) : null;
        if (hours !== null && (!Number.isFinite(hours) || hours <= 0)) {
          setFeedback("禁言时长必须是正数。");
          return;
        }
        await muteForumUser(getBrowserApiClient(), user.steamId64, reason, hours);
        setUsers((current) =>
          current.map((item) =>
            item.steamId64 === user.steamId64
              ? {
                  ...item,
                  isMuted: true,
                  muteReason: reason,
                  mutedUntil: hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null,
                }
              : item,
          ),
        );
        setFeedback(`${user.name} 已被禁言。`);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "禁言操作失败。");
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
          <p className="text-sm font-medium text-primary">论坛</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">论坛管理</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            编辑、删除或恢复主题和回复，或禁言论坛用户。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{topics.length} 个主题</Badge>
          <Badge variant="secondary">{replies.length} 条回复</Badge>
          <Badge variant="secondary">{users.length} 位用户</Badge>
        </div>
      </div>

      <div className="inline-flex w-fit gap-1 rounded-lg border bg-card p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-4 py-2 text-sm transition-colors ${
              tab === item.id
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "topics" ? (
        <div className="space-y-4">
          {editingTopic ? (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">编辑主题：{editingTopic.slug}</h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingTopic(null)}
                  >
                    取消
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="topic-title">标题</Label>
                    <Input
                      id="topic-title"
                      value={topicForm.title}
                      maxLength={200}
                      onChange={(event) =>
                        setTopicForm({ ...topicForm, title: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="topic-category">分类</Label>
                    <select
                      id="topic-category"
                      value={topicForm.categorySlug}
                      onChange={(event) =>
                        setTopicForm({ ...topicForm, categorySlug: event.target.value })
                      }
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {categories.map((category) => (
                        <option key={category.slug} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="topic-tags">标签（逗号分隔）</Label>
                    <Input
                      id="topic-tags"
                      value={topicForm.tags}
                      onChange={(event) => setTopicForm({ ...topicForm, tags: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="topic-excerpt">摘要</Label>
                    <Input
                      id="topic-excerpt"
                      value={topicForm.excerpt}
                      maxLength={500}
                      onChange={(event) =>
                        setTopicForm({ ...topicForm, excerpt: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="topic-content">正文</Label>
                    <textarea
                      id="topic-content"
                      rows={10}
                      value={topicForm.content}
                      onChange={(event) =>
                        setTopicForm({ ...topicForm, content: event.target.value })
                      }
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={topicForm.pinned}
                      onChange={(event) =>
                        setTopicForm({ ...topicForm, pinned: event.target.checked })
                      }
                    />
                    置顶
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={topicForm.hot}
                      onChange={(event) =>
                        setTopicForm({ ...topicForm, hot: event.target.checked })
                      }
                    />
                    热门
                  </label>
                </div>
                <Button
                  type="button"
                  onClick={() => void saveTopic()}
                  disabled={busy === "topic-edit"}
                >
                  {busy === "topic-edit" ? <LoaderCircle className="animate-spin" /> : <Check />}
                  保存主题
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">主题列表</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                删除为软删除，可在同一列表中恢复；编辑会同步更新公开论坛。
              </p>
            </div>
            <div className="divide-y">
              {topics.map((topic) => (
                <article
                  key={topic.slug}
                  className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{topic.title}</p>
                      {topic.isDeleted ? <Badge variant="destructive">已删除</Badge> : null}
                      {topic.pinned ? <Badge variant="secondary">置顶</Badge> : null}
                      <Badge variant="muted">{topic.categoryName}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {topic.authorName} · {topic.replyCount} 回复 ·{" "}
                      {formatDate(topic.lastActivityAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!topic.isDeleted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => beginTopicEdit(topic)}
                      >
                        <Pencil /> 编辑
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={topic.isDeleted ? "outline" : "ghost"}
                      disabled={busy === `topic-${topic.slug}`}
                      onClick={() =>
                        topic.isDeleted ? void toggleTopic(topic) : setDeleteTopicTarget(topic)
                      }
                    >
                      {topic.isDeleted ? <RotateCcw /> : <Trash2 />}
                      {topic.isDeleted ? "恢复" : "删除"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "replies" ? (
        <div className="space-y-4">
          {editingReply ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">编辑回复</h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingReply(null)}
                  >
                    取消
                  </Button>
                </div>
                <textarea
                  rows={6}
                  value={replyContent}
                  onChange={(event) => setReplyContent(event.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  onClick={() => void saveReply()}
                  disabled={busy === "reply-edit"}
                >
                  {busy === "reply-edit" ? <LoaderCircle className="animate-spin" /> : <Check />}
                  保存回复
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <div className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <MessageSquareText className="size-4 text-primary" /> 最近回复
              </h2>
            </div>
            <div className="divide-y">
              {replies.map((reply) => (
                <article
                  key={reply.id}
                  className="flex flex-col gap-3 px-5 py-4 md:flex-row md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserAvatar
                        name={reply.authorName}
                        avatarUrl={reply.authorAvatarUrl}
                        size="sm"
                      />
                      <p className="text-sm font-medium break-words">{reply.authorName}</p>
                      <span className="text-xs text-muted-foreground">
                        回复了「{reply.topicTitle}」
                      </span>
                      {reply.isDeleted ? <Badge variant="destructive">已删除</Badge> : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">
                      {reply.content}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(reply.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!reply.isDeleted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => beginReplyEdit(reply)}
                      >
                        <Pencil /> 编辑
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={reply.isDeleted ? "outline" : "ghost"}
                      disabled={busy === `reply-${reply.id}`}
                      onClick={() =>
                        reply.isDeleted ? void toggleReply(reply) : setDeleteReplyTarget(reply)
                      }
                    >
                      {reply.isDeleted ? <RotateCcw /> : <Trash2 />}
                      {reply.isDeleted ? "恢复" : "删除"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">论坛用户</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              禁言只限制论坛发言；网站账号不会因为游戏封禁而无法登录。
            </p>
          </div>
          <div className="divide-y">
            {users.map((user) => (
              <article
                key={user.steamId64}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{user.name}</p>
                      <Badge variant={user.role === "admin" ? "success" : "muted"}>
                        {roleLabel(user.role)}
                      </Badge>
                      {user.isMuted ? <Badge variant="warning">已禁言</Badge> : null}
                      {user.isDisabled ? <Badge variant="muted">已禁用</Badge> : null}
                    </div>
                    <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                      {user.steamId64}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      最近登录 {formatDate(user.lastLoginAt)}
                      {user.isMuted && user.muteReason ? ` · 禁言原因：${user.muteReason}` : ""}
                      {user.isMuted && user.mutedUntil
                        ? ` · 至 ${formatDate(user.mutedUntil)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">
                  {user.role !== "admin" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === `user-mute-${user.steamId64}` || user.isDisabled}
                      onClick={() => void toggleMute(user)}
                    >
                      {user.isMuted ? <Volume2 /> : <VolumeX />}
                      {user.isMuted ? "解除禁言" : "禁言"}
                    </Button>
                  ) : (
                    <Badge variant="muted">管理员</Badge>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/admin/bans">游戏封禁</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTopicTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTopicTarget(null);
          }
        }}
        title={deleteTopicTarget ? `删除主题「${deleteTopicTarget.title}」` : "删除主题"}
        description="主题会从公开论坛隐藏，可在管理列表中恢复。"
        confirmLabel="删除主题"
        destructive
        pending={deleteTopicTarget !== null && busy === `topic-${deleteTopicTarget.slug}`}
        onConfirm={() => deleteTopicTarget && void toggleTopic(deleteTopicTarget)}
      />
      <ConfirmDialog
        open={deleteReplyTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteReplyTarget(null);
          }
        }}
        title="删除回复"
        description="回复会从公开主题中隐藏，可在管理列表中恢复。"
        confirmLabel="删除回复"
        destructive
        pending={deleteReplyTarget !== null && busy === `reply-${deleteReplyTarget.id}`}
        onConfirm={() => deleteReplyTarget && void toggleReply(deleteReplyTarget)}
      />
    </div>
  );
}
