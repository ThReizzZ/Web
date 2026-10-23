"use client";

import { useQuery } from "@tanstack/react-query";

import { getBrowserApiClient } from "@/lib/api/browser";
import { fetchSystemInfo, systemInfoQueryKey } from "@/services/system";
import type { SystemInfo } from "@/types/api";

export function useSystemStatus(initialInfo?: SystemInfo | null) {
  return useQuery({
    queryKey: systemInfoQueryKey,
    queryFn: () => fetchSystemInfo(getBrowserApiClient()),
    initialData: initialInfo ?? undefined,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
