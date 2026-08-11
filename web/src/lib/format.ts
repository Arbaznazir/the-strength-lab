import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    if (date.getTime() > Date.now()) {
      return "just now";
    }
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch {
    return "—";
  }
}

export function absoluteDate(value?: string | null): string {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

export function absoluteDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    return format(date, "MMM d, yyyy · h:mm a");
  } catch {
    return "—";
  }
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
