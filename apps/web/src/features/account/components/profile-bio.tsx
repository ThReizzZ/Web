"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { getBrowserApiClient } from "@/lib/api/browser";
import { updateAccountProfile } from "@/services/content";

const BIO_MAX_LENGTH = 2000;

export function ProfileBio({ bio }: { bio: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openEditor() {
    setDraft(bio);
    setFeedback(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    try {
      await updateAccountProfile(getBrowserApiClient(), { bio: draft.trim() });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="mt-5 flex items-start justify-between gap-3">
        <p className="max-w-3xl min-w-0 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {bio || "还没有填写个人简介。"}
        </p>
        <Button type="button" variant="outline" className="shrink-0" onClick={openEditor}>
          <Pencil aria-hidden="true" />
          {bio ? "编辑" : "添加简介"}
        </Button>
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="编辑个人简介"
        description="简介会显示在你的用户中心和玩家资料页。"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="account-profile-bio-form" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
              保存
            </Button>
          </div>
        }
      >
        <form id="account-profile-bio-form" onSubmit={save} className="space-y-1.5">
          <Label htmlFor="account-profile-bio">个人简介</Label>
          <textarea
            id="account-profile-bio"
            rows={6}
            maxLength={BIO_MAX_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="介绍一下你自己，例如常玩的地图类型、KZ 经历或联系方式。"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <p className="text-xs text-muted-foreground">
            {draft.length}/{BIO_MAX_LENGTH} 个字符
          </p>
          {feedback ? <p className="text-xs text-destructive">{feedback}</p> : null}
        </form>
      </Modal>
    </>
  );
}
