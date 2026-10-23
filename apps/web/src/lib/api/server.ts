import "server-only";

import { cookies, headers } from "next/headers";

import { ApiClient } from "@/lib/api/client";

/**
 * Server-side API client for React Server Components and route handlers.
 *
 * It uses the Docker-internal API address (never exposed to the browser) and
 * forwards the incoming cookie header so cookie-based sessions can be added
 * without changing call sites. No server secret is placed in this client.
 */
export async function getServerApiClient(): Promise<ApiClient> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookie = cookieStore.toString();
  const requestId = headerStore.get("x-request-id") ?? crypto.randomUUID();

  return new ApiClient({
    baseUrl: process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080",
    timeoutMs: 5_000,
    defaultHeaders: {
      "x-request-id": requestId,
      ...(cookie ? { cookie } : {}),
    },
  });
}
