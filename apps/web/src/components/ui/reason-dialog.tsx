"use client";

import { useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "原因",
  placeholder = "请填写具体原因。",
  confirmLabel = "确认",
  defaultValue = "",
  pending = false,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  defaultValue?: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
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
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={() => onConfirm(textareaRef.current?.value ?? "")}
            disabled={pending}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="reason-dialog-input">{label}</Label>
        <textarea
          key={open ? "open" : "closed"}
          ref={textareaRef}
          id="reason-dialog-input"
          rows={4}
          maxLength={1000}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </Modal>
  );
}
