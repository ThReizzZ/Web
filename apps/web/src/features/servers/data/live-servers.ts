"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getBrowserApiClient } from "@/lib/api/browser";

import {
  mergeLiveServers,
  type KzServer,
  type LiveServerPayload,
} from "@/features/servers/data/servers";

const LIVE_SERVERS_QUERY_KEY = ["servers-live"] as const;
const FALLBACK_REFRESH_INTERVAL_MS = 30_000;
const SERVER_STREAM_URL = "/api/v1/servers/stream";

let eventSource: EventSource | null = null;
let subscriberCount = 0;
const updateListeners = new Set<() => void>();

function subscribeToServerUpdates(listener: () => void): () => void {
  updateListeners.add(listener);
  subscriberCount += 1;

  if (subscriberCount === 1 && typeof window !== "undefined" && "EventSource" in window) {
    try {
      eventSource = new EventSource(SERVER_STREAM_URL);
      eventSource.addEventListener("server-update", () => {
        for (const subscriber of updateListeners) {
          subscriber();
        }
      });
    } catch {
      eventSource = null;
    }
  }

  return () => {
    updateListeners.delete(listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      eventSource?.close();
      eventSource = null;
    }
  };
}

async function fetchLiveServers(initialServers: KzServer[]): Promise<KzServer[]> {
  const payload = await getBrowserApiClient().get<LiveServerPayload[]>("/api/v1/servers", {
    cache: "no-store",
    timeoutMs: 8_000,
  });
  return mergeLiveServers(initialServers, payload);
}

export function useLiveServers(initialServers: KzServer[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeToServerUpdates(() => {
      void queryClient.invalidateQueries({ queryKey: LIVE_SERVERS_QUERY_KEY });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: LIVE_SERVERS_QUERY_KEY,
    queryFn: () => fetchLiveServers(initialServers),
    initialData: initialServers,
    staleTime: FALLBACK_REFRESH_INTERVAL_MS / 2,
    refetchInterval: FALLBACK_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
