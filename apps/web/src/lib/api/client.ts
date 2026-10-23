import type { ApiErrorBody, ApiRequestOptions } from "@/types/api";

const DEFAULT_TIMEOUT_MS = 10_000;

interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
}

interface ApiErrorOptions {
  status: number;
  code: string;
  requestId: string | null;
  details?: unknown;
}

/**
 * Error raised by the shared API client for both HTTP and transport failures.
 *
 * `status === 0` means the request never produced an HTTP response (network
 * failure or timeout). `requestId` comes from the API's `x-request-id`
 * response header and should be included in user-facing bug reports.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { query, timeoutMs, headers, ...init } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(this.buildUrl(path, query), {
        ...init,
        signal,
        credentials: init.credentials ?? "include",
        headers: {
          Accept: "application/json",
          ...this.defaultHeaders,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
      });

      const requestId = response.headers.get("x-request-id");

      if (!response.ok) {
        const errorBody = await readErrorBody(response);
        throw new ApiError(errorBody?.error.message ?? `请求失败（HTTP ${response.status}）`, {
          status: response.status,
          code: errorBody?.error.code ?? `http_${response.status}`,
          requestId,
          details: errorBody?.error.details,
        });
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError("API 返回了无法解析的响应", {
          status: response.status,
          code: "invalid_response",
          requestId,
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("请求超时，请稍后重试", {
          status: 0,
          code: "timeout",
          requestId: null,
        });
      }

      throw new ApiError("网络请求失败，请检查连接", {
        status: 0,
        code: "network_error",
        requestId: null,
        details: error instanceof Error ? error.message : undefined,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        search.set(key, String(value));
      }
    }

    const queryString = search.toString();
    return `${this.baseUrl}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
  }
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }

    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof parsed.error === "object" &&
      parsed.error !== null &&
      "code" in parsed.error &&
      "message" in parsed.error &&
      typeof parsed.error.code === "string" &&
      typeof parsed.error.message === "string"
    ) {
      return parsed as ApiErrorBody;
    }

    return null;
  } catch {
    return null;
  }
}
