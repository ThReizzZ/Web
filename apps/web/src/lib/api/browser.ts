import { ApiClient } from "@/lib/api/client";

let browserClient: ApiClient | undefined;

/**
 * Browser-side API client.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is inlined at build time. An empty value means
 * same-origin requests, which is the production deployment model behind Nginx.
 * Local development uses the Next.js rewrite configured in `next.config.ts`.
 */
export function getBrowserApiClient(): ApiClient {
  browserClient ??= new ApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
    timeoutMs: 8_000,
  });

  return browserClient;
}
