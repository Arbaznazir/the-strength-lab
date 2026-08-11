"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { PenLine } from "lucide-react";
import { useAuth } from "@/lib/auth";

/** Always-visible New Post CTA — guests go to login, members to /new-post. */
export function NewPostButton({
  className,
  compact,
  ghost,
}: {
  className?: string;
  compact?: boolean;
  ghost?: boolean;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const next = "/new-post";
  const href = !loading && !user
    ? `/login?next=${encodeURIComponent(next)}`
    : next;

  return (
    <Link
      href={href}
      className={clsx(
        ghost ? "btn-ghost" : "btn-primary",
        compact && "!px-2.5 !py-1.5 text-xs sm:!px-3 sm:!py-2 sm:text-sm",
        className,
      )}
      aria-current={pathname === "/new-post" ? "page" : undefined}
    >
      <PenLine className="h-3.5 w-3.5" />
      {compact ? "Post" : "New post"}
    </Link>
  );
}
