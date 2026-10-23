import { z } from "zod";

import type { ApiClient } from "@/lib/api/client";
import type { SystemInfo } from "@/types/api";

const systemInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  environment: z.string().min(1),
  api_version: z.string().min(1),
});

export const systemInfoQueryKey = ["system", "info"] as const;

export async function fetchSystemInfo(client: ApiClient): Promise<SystemInfo> {
  const payload = await client.get<unknown>("/api/v1/system/info");
  const parsed = systemInfoSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("API 返回了未预期的系统信息结构");
  }

  return parsed.data;
}
