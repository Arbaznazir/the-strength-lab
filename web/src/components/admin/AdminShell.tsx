"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { adminNav, isStaff } from "@/lib/admin";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const staff = isStaff(user);
  const pendingAuth = loading || (Boolean(getToken()) && !user);

  useEffect(() => {
    if (pendingAuth) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, pendingAuth, pathname, router]);

  if (pendingAuth) {
    return (
      <p className="container-lab py-10 text-[var(--muted)]">Loading…</p>
    );
  }

  if (!user) {
    return (
      <p className="container-lab py-10 text-[var(--muted)]">Loading…</p>
    );
  }

  if (!staff) {
    return (
      <div className="container-lab py-10">
        <p className="kicker">Staff</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-3 max-w-lg text-sm text-[var(--muted)]">
          Signed in as <strong className="text-[var(--fg)]">@{user.username}</strong> (
          {user.role}). Admin access requires an admin or moderator account.
        </p>
        <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">
          Demo staff logins: <code className="text-[var(--accent)]">coach</code> or{" "}
          <code className="text-[var(--accent)]">spotter</code> with password{" "}
          <code className="text-[var(--accent)]">password123</code>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn-ghost">
            Back to site
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="btn-primary"
          >
            Sign in as staff
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-lab py-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Staff</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Admin panel
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Moderate content, manage users, and review reports.
          </p>
        </div>
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to site
        </Link>
      </div>

      <nav className="mb-8 flex flex-wrap gap-1 border-b border-[var(--line)]">
        {adminNav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-b-2 border-[var(--accent)] text-[var(--fg)]"
                  : "text-[var(--muted)] hover:text-[var(--fg)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
