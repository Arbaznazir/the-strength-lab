"use client";

import clsx from "clsx";
import Link from "next/link";
import type { UserPublic } from "@/lib/types";
import { mediaURL } from "@/lib/api";

type AvatarProps = {
  user?: Pick<UserPublic, "username" | "displayName" | "avatarUrl"> | null;
  size?: "sm" | "md" | "lg" | "xl" | "profile";
  className?: string;
  link?: boolean;
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  profile: "h-28 w-28 text-3xl font-medium sm:h-36 sm:w-36 sm:text-4xl",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  user,
  size = "md",
  className,
  link = true,
}: AvatarProps) {
  const name = user?.displayName || user?.username || "?";
  const src = mediaURL(user?.avatarUrl);
  const content = (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--accent)]",
        size === "profile"
          ? "font-sans font-medium"
          : "font-medium",
        sizes[size],
        className,
      )}
      aria-hidden={!user}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );

  if (link && user?.username) {
    return (
      <Link
        href={`/members/${user.username}`}
        className="inline-flex"
        title={name}
      >
        {content}
      </Link>
    );
  }

  return content;
}
