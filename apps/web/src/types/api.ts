export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
}

export interface SystemInfo {
  name: string;
  version: string;
  environment: string;
  api_version: string;
}
