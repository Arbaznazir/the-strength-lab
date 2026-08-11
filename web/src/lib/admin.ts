import type { UserPublic } from "./types";

export function isStaff(user?: UserPublic | null) {
  return user?.role === "admin" || user?.role === "moderator";
}

export function isAdmin(user?: UserPublic | null) {
  return user?.role === "admin";
}

export const adminNav: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/log", label: "Mod log" },
];
