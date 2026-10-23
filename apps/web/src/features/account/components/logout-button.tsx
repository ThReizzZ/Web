"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => void logout()}
      disabled={pending}
    >
      <LogOut aria-hidden="true" />
      {pending ? "正在退出…" : "退出 Steam 登录"}
    </Button>
  );
}
