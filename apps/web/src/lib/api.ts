import type { AuthResponse } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * The access token lives in memory only — never localStorage, so an XSS bug
 * cannot walk off with a long-lived session. The refresh token is an httpOnly
 * cookie the browser attaches on its own.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onUnauthorized(handler: (() => void) | null): void {
  onSessionLost = handler;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

/** Refreshes at most once at a time; concurrent 401s share the same attempt. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) return null;
        const body = (await response.json()) as AuthResponse;
        accessToken = body.accessToken;
        return body.accessToken;
      } catch {
        return null;
      } finally {
        // Cleared on the next tick so followers see the same result first.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  body?: unknown;
  /** Set to false to skip the automatic refresh-and-retry on a 401. */
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, retryOnUnauthorized = true, signal } = options;

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await send(accessToken);

  if (response.status === 401 && retryOnUnauthorized) {
    const token = await refreshAccessToken();
    if (token) {
      response = await send(token);
    } else {
      accessToken = null;
      onSessionLost?.();
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFrom(parsed, `Request failed with status ${response.status}`),
      parsed,
    );
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

/** Builds a query string, dropping empty values. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
