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
  cache.clear();
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
  /** GET only: skip the short-lived cache and refetch. */
  fresh?: boolean;
}

// Short-lived GET cache + in-flight dedupe. Any write clears it, so a user's
// own changes are never hidden; other users' changes show within the TTL.
const CACHE_TTL_MS = 20_000;
const NEVER_CACHE = /^\/(auth|exams|proctoring|execute|submissions)/;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export function clearApiCache(): void {
  cache.clear();
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

function cachedGet<T>(path: string, options?: RequestOptions): Promise<T> {
  if (options?.signal || options?.fresh || NEVER_CACHE.test(path)) {
    return request<T>('GET', path, options);
  }
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data as T);
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const promise = request<T>('GET', path, options)
    .then((data) => {
      cache.set(path, { at: Date.now(), data });
      return data;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, promise);
  return promise;
}

async function write<T>(method: string, path: string, body?: unknown, options?: RequestOptions) {
  try {
    return await request<T>(method, path, { ...options, body });
  } finally {
    cache.clear();
  }
}

export const api = {
  get: cachedGet,
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    write<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    write<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => write<T>('DELETE', path, undefined, options),
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
