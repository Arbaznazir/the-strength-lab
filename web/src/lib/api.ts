const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "") || "ws://localhost:8080";

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

  const res = await fetch(`${API_BASE}/api/v1${path}`, {
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

export function chatWsUrl(token: string): string {
  return `${WS_BASE}/api/v1/ws/chat?token=${encodeURIComponent(token)}`;
}

export function messagesWsUrl(token: string): string {
  return `${WS_BASE}/api/v1/ws/messages?token=${encodeURIComponent(token)}`;
}

export function mediaURL(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
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
  const token = getToken();
  if (!token) throw new ApiRequestError(401, "unauthorized");

  const form = new FormData();
  form.append("file", file);
  if (purpose) form.append("purpose", purpose);

  const res = await fetch(`${API_BASE}/api/v1/uploads`, {
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

