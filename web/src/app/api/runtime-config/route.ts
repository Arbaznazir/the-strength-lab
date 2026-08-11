import { NextResponse } from "next/server";

const LOCAL_API = "http://localhost:8080";
const LOCAL_WS = "ws://localhost:8080";

function trim(url?: string) {
  return url?.replace(/\/$/, "") ?? "";
}

function isAllowedApiUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".code.run")) return true;
    // Allow explicitly configured production hosts only via env (already trusted)
    return Boolean(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL);
  } catch {
    return false;
  }
}

/** Northflank: p01--the-strength-lab-frontend--<id>.code.run → backend sibling URL */
function inferBackendFromHost(host: string): string | null {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  const match = h.match(/^(p\d+--).+-frontend--([a-z0-9]+)\.code\.run$/);
  if (!match) return null;
  return `https://${match[1]}the-strength-lab-backend--${match[2]}.code.run`;
}

function inferWsFromApi(apiUrl: string) {
  return apiUrl.startsWith("https://")
    ? apiUrl.replace(/^https:/, "wss:")
    : apiUrl.replace(/^http:/, "ws:");
}

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  let apiUrl =
    trim(process.env.API_URL) ||
    trim(process.env.NEXT_PUBLIC_API_URL) ||
    "";

  // Only infer from host when env is unset (local/dev convenience)
  if (!apiUrl) {
    apiUrl = inferBackendFromHost(host) || LOCAL_API;
  }

  if (!isAllowedApiUrl(apiUrl)) {
    return NextResponse.json({ error: "invalid api url config" }, { status: 500 });
  }

  let wsUrl =
    trim(process.env.WS_URL) ||
    trim(process.env.NEXT_PUBLIC_WS_URL) ||
    (apiUrl !== LOCAL_API ? inferWsFromApi(apiUrl) : LOCAL_WS);

  if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
    return NextResponse.json({ error: "invalid ws url config" }, { status: 500 });
  }

  const res = NextResponse.json({ apiUrl, wsUrl });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
