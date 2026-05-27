export interface ApiErrorPayload {
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly method: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    status: number;
    url: string;
    method: string;
    code?: string;
    requestId?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.url = params.url;
    this.method = params.method;
    this.code = params.code;
    this.requestId = params.requestId;
    this.details = params.details;
  }
}

export function createRequestId(prefix = "dashboard"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function apiErrorFromResponse(
  res: Response,
  method = "GET",
  fallbackRequestId?: string,
): Promise<ApiError> {
  const payload = await res.json().catch(() => null) as ApiErrorPayload | null;
  const requestId = payload?.requestId ?? res.headers.get("x-request-id") ?? fallbackRequestId;
  const baseMessage = payload?.error ?? payload?.message ?? `API error: ${res.status}`;
  const message = requestId ? `${baseMessage} (request ${requestId})` : baseMessage;

  return new ApiError({
    message,
    status: res.status,
    url: res.url,
    method,
    code: payload?.code,
    requestId,
    details: payload?.details,
  });
}

export function apiErrorFromFetchFailure(params: {
  error: unknown;
  url: string;
  method?: string;
  requestId: string;
}): ApiError {
  const causeMessage = params.error instanceof Error ? params.error.message : String(params.error);
  return new ApiError({
    message: `Network error (request ${params.requestId}): ${causeMessage}`,
    status: 0,
    url: params.url,
    method: params.method ?? "GET",
    code: "FETCH_FAILED",
    requestId: params.requestId,
  });
}

function safeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function logApiError(error: unknown): void {
  const meta = import.meta as unknown as { env?: { PROD?: boolean } };
  if (!(error instanceof ApiError)) {
    return;
  }

  const debugCommand = error.requestId
    ? `pnpm debug:logs ${error.requestId} --since "2 hours ago"`
    : undefined;
  const payload: {
    status: number;
    method: string;
    url: string;
    code?: string;
    requestId?: string;
    debugCommand?: string;
    message: string;
    details?: unknown;
  } = {
    status: error.status,
    method: error.method,
    url: safeUrlForLog(error.url),
    code: error.code,
    requestId: error.requestId,
    debugCommand,
    message: error.message,
  };

  if (!meta.env?.PROD && error.details !== undefined) {
    payload.details = error.details;
  }

  console.error("OpenSeat API request failed", payload);
}

export function formatApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  const details = [
    `HTTP ${error.status}`,
    error.code,
    error.requestId ? `request ${error.requestId}` : undefined,
  ].filter(Boolean);

  return details.length > 0 ? `${fallback} (${details.join(" - ")})` : fallback;
}

export function isApiErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
