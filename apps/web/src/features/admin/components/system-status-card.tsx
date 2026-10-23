"use client";

import { AlertCircle, CheckCircle2, RefreshCw, ServerCog } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemStatus } from "@/hooks/use-system-status";
import { ApiError } from "@/lib/api/client";
import type { SystemInfo } from "@/types/api";

export function SystemStatusCard({ initialInfo }: { initialInfo?: SystemInfo | null }) {
  const { data, error, isPending, isFetching, refetch } = useSystemStatus(initialInfo);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ServerCog className="size-4 text-primary" aria-hidden="true" />
          API 连通性
        </CardTitle>
        <CardDescription>
          浏览器通过统一 API 客户端读取服务元信息。该检查不包含数据库地址或任何凭据。
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden="true" />
            刷新
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3" aria-label="正在检查 API 状态">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>API 当前不可用</AlertTitle>
            <AlertDescription>
              <p>{error instanceof ApiError ? error.message : "请求失败，请稍后重试。"}</p>
              {error instanceof ApiError ? (
                <p className="mt-2 font-mono text-xs">
                  code={error.code}
                  {error.requestId ? ` · request_id=${error.requestId}` : ""}
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">
                <CheckCircle2 aria-hidden="true" />
                已连接
              </Badge>
              <span className="text-sm text-muted-foreground">
                浏览器 → Nginx（生产）/ Next.js 代理（开发）→ Rust API
              </span>
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">服务</dt>
                <dd className="font-mono">{data.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">API 版本</dt>
                <dd className="font-mono">{data.api_version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">构建版本</dt>
                <dd className="font-mono">{data.version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">运行环境</dt>
                <dd className="font-mono">{data.environment}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
