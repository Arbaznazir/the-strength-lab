import { NextResponse } from "next/server";

const LOCAL_API = "http://localhost:8080";
const LOCAL_WS = "ws://localhost:8080";

function trim(url?: string) {
  return url?.replace(/\/$/, "") ?? "";
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

  const apiUrl =
    trim(process.env.API_URL) ||
    trim(process.env.NEXT_PUBLIC_API_URL) ||
    inferBackendFromHost(host) ||
    LOCAL_API;

  const wsUrl =
    trim(process.env.WS_URL) ||
    trim(process.env.NEXT_PUBLIC_WS_URL) ||
    (apiUrl !== LOCAL_API ? inferWsFromApi(apiUrl) : LOCAL_WS);

  return NextResponse.json({ apiUrl, wsUrl });
}
