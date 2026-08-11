"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { InboxList } from "@/components/messages/InboxList";

function MessagesLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const match = pathname.match(/^\/messages\/([^/]+)$/);
  const activeId = match?.[1] ?? null;
  const onChat = Boolean(activeId);

  if (loading) {
    return (
      <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
        Loading…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Log in
        </Link>{" "}
        to view messages.
      </p>
    );
  }

  return (
    <div className="container-lab mx-auto max-w-5xl py-4 sm:py-6 md:py-8">
      <div
        className={clsx(
          "overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]",
          "flex min-h-[min(80vh,720px)]",
        )}
      >
        <aside
          className={clsx(
            "w-full shrink-0 border-[var(--line)] md:w-[min(100%,18rem)] md:border-r lg:w-[min(100%,22rem)]",
            onChat && "hidden md:flex md:flex-col",
          )}
        >
          <InboxList activeId={activeId} />
        </aside>

        <section
          className={clsx(
            "min-w-0 flex-1 flex-col",
            onChat ? "flex" : "hidden md:flex",
          )}
        >
          {children}
        </section>
      </div>
    </div>
  );
}

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
          Loading…
        </p>
      }
    >
      <MessagesLayoutInner>{children}</MessagesLayoutInner>
    </Suspense>
  );
}
