"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  Bell,
  LogOut,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { warmRuntimeConfig } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { ContactUsButton } from "./ContactUsButton";
import { NewPostButton } from "./NewPostButton";
import { SocialLinks } from "./SocialLinks";

const nav = [
  { href: "/", label: "Forums" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/whats-new", label: "What's new" },
  { href: "/members", label: "Members" },
  { href: "/chat", label: "Chat" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, unreadAlerts, unreadMessages } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    setMenuOpen(false);
    setUserMenu(false);
  }, [pathname]);

  useEffect(() => {
    void warmRuntimeConfig();
  }, []);

  useEffect(() => {
    if (!userMenu) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (!target || !(target as Element).closest?.("[data-user-menu]")) {
        setUserMenu(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userMenu]);

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  // Desktop/tablet only — phones use the hamburger menu (avoids a cramped header)
  const guestAuth = (
    <div className="hidden items-center gap-1 sm:flex">
      <Link
        href="/login"
        className={clsx(
          "inline-flex items-center px-3 py-2 text-sm font-semibold transition-colors",
          isHome
            ? "rounded border border-white/25 text-white hover:border-white/50 hover:bg-white/10"
            : "text-[var(--muted)] hover:text-[var(--fg)]",
        )}
      >
        Log in
      </Link>
      <Link
        href="/register"
        className={clsx(
          "btn-primary shrink-0 !px-3 !py-2 text-sm",
          isHome && "shadow-[0_4px_20px_-8px_var(--glow)]",
        )}
      >
        Join
      </Link>
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      {!isHome ? <div className="atmosphere" aria-hidden /> : null}

      <header
        className={clsx(
          "sticky top-0 z-50 transition-colors",
          isHome
            ? "border-b border-transparent bg-[color-mix(in_oklab,#0a0c0b_55%,transparent)] text-[#f2eee6] backdrop-blur-md"
            : "border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] backdrop-blur-md",
        )}
      >
        <div className="container-lab flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              className="-ml-1 shrink-0 p-2 text-current/70 hover:text-current md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link
              href="/"
              className="group min-w-0 shrink"
              aria-label="The Strength Lab"
            >
              {/* Compact mark on phones */}
              <span className="text-lg font-bold tracking-tight sm:hidden">
                TS<span className="text-[var(--accent)]">L</span>
              </span>
              {/* Full wordmark from sm up */}
              <span className="hidden text-[1.05rem] font-semibold tracking-tight sm:inline sm:text-xl">
                The Strength{" "}
                <span className="text-[var(--accent)]">Lab</span>
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-0.5 md:flex lg:gap-1">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "relative px-2 py-2 text-sm font-medium transition-colors lg:px-3",
                    active
                      ? isHome
                        ? "text-white"
                        : "text-[var(--fg)]"
                      : isHome
                        ? "text-white/65 hover:text-white"
                        : "text-[var(--muted)] hover:text-[var(--fg)]",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-0.5 h-px bg-[var(--accent)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-0 sm:gap-1">
            <SocialLinks
              variant="header"
              className={clsx("mr-0.5 hidden lg:flex", isHome && "text-white/60")}
            />
            <div className="mr-1 hidden sm:block">
              <ContactUsButton
                compact
                className={clsx(
                  isHome && "text-white/80 hover:text-[var(--accent)]",
                )}
              />
            </div>
            <div className="mr-1 hidden md:block">
              <NewPostButton
                compact
                className={clsx(
                  isHome && "!bg-[var(--accent)] !text-[var(--accent-ink)]",
                )}
              />
            </div>
            <Link
              href="/search"
              className={clsx(
                "rounded p-1.5 transition-colors sm:p-2",
                isHome ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-[var(--muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]",
              )}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={cycleTheme}
              className={clsx(
                "hidden rounded p-2 transition-colors sm:inline-flex",
                isHome ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-[var(--muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]",
              )}
              title={`Theme: ${theme}`}
              aria-label="Cycle theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            {!user ? (
              guestAuth
            ) : (
              <>
                <Link
                  href="/alerts"
                  className={clsx(
                    "relative rounded p-1.5 transition-colors sm:p-2",
                    isHome ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-[var(--muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]",
                  )}
                  aria-label="Alerts"
                >
                  <Bell className="h-4 w-4" />
                  {unreadAlerts > 0 ? <span className="badge-count">{unreadAlerts}</span> : null}
                </Link>
                <Link
                  href="/messages"
                  className={clsx(
                    "relative hidden rounded p-2 transition-colors sm:inline-flex",
                    isHome ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-[var(--muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]",
                  )}
                  aria-label="Messages"
                >
                  <MessageSquare className="h-4 w-4" />
                  {unreadMessages > 0 ? <span className="badge-count">{unreadMessages}</span> : null}
                </Link>
                <div className="relative" data-user-menu>
                  <button
                    type="button"
                    onClick={() => setUserMenu((v) => !v)}
                    className="flex items-center gap-2 rounded p-0.5 sm:p-1"
                    aria-expanded={userMenu}
                    aria-label="Account menu"
                  >
                    <Avatar user={user} size="sm" link={false} />
                    <span className="hidden max-w-[7rem] truncate text-sm md:inline">
                      {user.displayName}
                    </span>
                  </button>
                  {userMenu ? (
                    <>
                      <div
                        className="fixed inset-0 z-40 md:hidden"
                        aria-hidden
                        onClick={() => setUserMenu(false)}
                      />
                      <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)] py-1 shadow-2xl">
                  <Link href={`/members/${user.username}`} className="block px-3 py-2 text-sm hover:bg-[var(--accent-dim)]">
                    Profile
                  </Link>
                  {(user.role === "admin" || user.role === "moderator") ? (
                    <Link href="/admin" className="block px-3 py-2 text-sm hover:bg-[var(--accent-dim)]">
                      Admin panel
                    </Link>
                  ) : null}
                      <Link href="/messages" className="block px-3 py-2 text-sm hover:bg-[var(--accent-dim)]">
                        Messages
                      </Link>
                        <button
                          type="button"
                          onClick={logout}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--accent-dim)]"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Log out
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {menuOpen ? (
          <nav
            className={clsx(
              "border-t px-4 py-3 md:hidden",
              isHome
                ? "border-white/10 bg-[#0a0c0b]/95 text-[#f2eee6] backdrop-blur-md"
                : "border-[var(--line)] bg-[var(--bg)]",
            )}
          >
            <div className="flex flex-col">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "px-2 py-3 text-sm font-medium",
                    isHome ? "text-white/90" : "text-[var(--fg)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="px-2 py-2">
                <NewPostButton className="w-full justify-center" />
              </div>
              <div className="px-2 py-2">
                <ContactUsButton className="w-full justify-center" />
              </div>
              {user ? (
                <>
                  <Link href="/messages" className="px-2 py-3 text-sm font-medium text-[var(--fg)]">
                    Messages
                    {unreadMessages > 0 ? (
                      <span className="ml-2 text-[var(--accent)]">({unreadMessages})</span>
                    ) : null}
                  </Link>
                  <Link href="/alerts" className="px-2 py-3 text-sm font-medium text-[var(--fg)]">
                    Alerts
                    {unreadAlerts > 0 ? (
                      <span className="ml-2 text-[var(--accent)]">({unreadAlerts})</span>
                    ) : null}
                  </Link>
                  <Link href={`/members/${user.username}`} className="px-2 py-3 text-sm font-medium text-[var(--fg)]">
                    Profile
                  </Link>
                </>
              ) : (
                <div
                  className={clsx(
                    "mt-2 flex flex-col gap-2 border-t px-2 py-3",
                    isHome ? "border-white/10" : "border-[var(--line)]",
                  )}
                >
                  <Link
                    href="/login"
                    className={clsx(
                      "btn-ghost w-full justify-center text-sm",
                      isHome && "border-white/25 text-white hover:border-[var(--accent)]",
                    )}
                  >
                    Log in
                  </Link>
                  <Link href="/register" className="btn-primary w-full justify-center text-sm">
                    Join
                  </Link>
                </div>
              )}
              <Link
                href="/search"
                className={clsx(
                  "px-2 py-3 text-sm font-medium",
                  isHome ? "text-white/90" : "text-[var(--fg)]",
                )}
              >
                Search
              </Link>
              <button
                type="button"
                onClick={cycleTheme}
                className={clsx(
                  "flex items-center gap-2 px-2 py-3 text-left text-sm font-medium sm:hidden",
                  isHome ? "text-white/90" : "text-[var(--fg)]",
                )}
              >
                <ThemeIcon className="h-4 w-4" />
                Theme: {theme}
              </button>
              <div className="px-2 py-3">
                <SocialLinks variant="footer" />
              </div>
            </div>
          </nav>
        ) : null}
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="relative z-10 border-t border-[var(--line)] py-8">
        <div className="container-lab flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              The Strength <span className="text-[var(--accent)]">Lab</span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Lift heavy. Stay sharp. No fluff.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <ContactUsButton />
            <SocialLinks variant="footer" />
            <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
            <Link href="/whats-new" className="hover:text-[var(--accent)]">What&apos;s new</Link>
            <Link href="/sponsors" className="hover:text-[var(--accent)]">Sponsors</Link>
            <Link href="/members" className="hover:text-[var(--accent)]">Members</Link>
            <Link href="/chat" className="hover:text-[var(--accent)]">Chat</Link>
            <Link href="/online" className="hover:text-[var(--accent)]">Online</Link>
            </div>
          </div>
        </div>
        <p className="container-lab mt-6 border-t border-[var(--line)] pt-6 text-center text-xs text-[var(--muted)]">
          © 2015–2026 The Strength Lab. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
