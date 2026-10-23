"use client";

import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">threi</p>
          <h1 className="text-2xl font-semibold tracking-tight">应用发生严重错误</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            页面骨架未能渲染。请刷新重试；如果问题持续存在，请查看 web
            容器日志并向维护者提供错误标识。
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            digest={error.digest ?? "unknown"}
          </p>
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
