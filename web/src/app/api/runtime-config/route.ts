import { NextResponse } from "next/server";

const LOCAL_API = "http://localhost:8080";
const LOCAL_WS = "ws://localhost:8080";

function trim(url?: string) {
  return url?.replace(/\/$/, "") ?? "";
}

export async function GET() {
  const apiUrl =
    trim(process.env.API_URL) ||
    trim(process.env.NEXT_PUBLIC_API_URL) ||
    LOCAL_API;
  const wsUrl =
    trim(process.env.WS_URL) ||
    trim(process.env.NEXT_PUBLIC_WS_URL) ||
    (apiUrl.startsWith("https://")
      ? apiUrl.replace(/^https:/, "wss:")
      : apiUrl.replace(/^http:/, "ws:"));

  return NextResponse.json({ apiUrl, wsUrl });
}
