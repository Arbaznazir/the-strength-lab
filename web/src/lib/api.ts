const LOCAL_API = "http://localhost:8080";
const LOCAL_WS = "ws://localhost:8080";

type RuntimeConfig = { apiUrl: string; wsUrl: string };

let cached: RuntimeConfig | null = null;
let inflight: Promise<RuntimeConfig> | null = null;

function trim(url?: string) {
  return url?.replace(/\/$/, "") ?? "";
}

function bakedApiUrl() {
  return trim(process.env.NEXT_PUBLIC_API_URL) || LOCAL_API;
}

function bakedWsUrl() {
  return trim(process.env.NEXT_PUBLIC_WS_URL) || LOCAL_WS;
}

function serverApiUrl() {
  return trim(process.env.API_URL) || bakedApiUrl();
}

function serverWsUrl() {
  return trim(process.env.WS_URL) || bakedWsUrl();
}

function clientNeedsRuntimeConfig() {
  if (typeof window === "undefined") return false;
  return bakedApiUrl() === LOCAL_API || bakedWsUrl() === LOCAL_WS;
}

async function resolveRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;

  if (typeof window === "undefined") {
    cached = { apiUrl: serverApiUrl(), wsUrl: serverWsUrl() };
    return cached;
  }

  if (!clientNeedsRuntimeConfig()) {
    cached = { apiUrl: bakedApiUrl(), wsUrl: bakedWsUrl() };
    return cached;
  }

  if (!inflight) {
    inflight = fetch("/api/runtime-config", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("runtime config unavailable");
        return (await res.json()) as RuntimeConfig;
      })
      .then((cfg) => {
        cached = {
          apiUrl: trim(cfg.apiUrl) || LOCAL_API,
          wsUrl: trim(cfg.wsUrl) || LOCAL_WS,
        };
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

/** Preload API/WS URLs on the client (e.g. from Shell on mount). */
export function warmRuntimeConfig() {
  if (typeof window === "undefined") return Promise.resolve();
  return resolveRuntimeConfig().then(() => undefined);
}

export function getCachedApiBase() {
  return cached?.apiUrl ?? bakedApiUrl();
}

export const TOKEN_KEY = "tsl_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiRequestError";
  }
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const apiBase = (await resolveRuntimeConfig()).apiUrl;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token =
    options.token !== undefined
      ? options.token
      : options.auth !== false
        ? getToken()
        : null;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBase}/api/v1${path}`, {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiRequestError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function chatWsUrl(token: string): Promise<string> {
  const wsBase = (await resolveRuntimeConfig()).wsUrl;
  return `${wsBase}/api/v1/ws/chat?token=${encodeURIComponent(token)}`;
}

export async function messagesWsUrl(token: string): Promise<string> {
  const wsBase = (await resolveRuntimeConfig()).wsUrl;
  return `${wsBase}/api/v1/ws/messages?token=${encodeURIComponent(token)}`;
}

export function mediaURL(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = getCachedApiBase();
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function apiUpload(
  file: File,
  purpose?: "avatar" | "banner" | "attachment",
): Promise<{
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  user?: import("./types").UserPublic;
}> {
  const apiBase = (await resolveRuntimeConfig()).apiUrl;
  const token = getToken();
  if (!token) throw new ApiRequestError(401, "unauthorized");

  const form = new FormData();
  form.append("file", file);
  if (purpose) form.append("purpose", purpose);

  const res = await fetch(`${apiBase}/api/v1/uploads`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiRequestError(res.status, message);
  }
  return res.json();
}
