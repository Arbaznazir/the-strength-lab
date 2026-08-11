"use client";

import clsx from "clsx";

export type TagLike = {
  slug: string;
  label: string;
  color: string;
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#d4ff3a",
  moderator: "#7dd3c0",
};

function roleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] || "#d4ff3a";
}

/** Featured-style rectangular badge with custom color. */
export function TagBadge({
  tag,
  className,
}: {
  tag: TagLike;
  className?: string;
}) {
  const color = tag.color || "#d4ff3a";
  return (
    <span
      className={clsx(
        "inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
      }}
    >
      {tag.label}
    </span>
  );
}

/** Role badge (Admin, Moderator, custom roles) — same look as Featured. Skips member. */
export function RoleBadge({
  role,
  className,
}: {
  role?: string | null;
  className?: string;
}) {
  if (!role || role.toLowerCase() === "member") return null;
  const color = roleColor(role);
  return (
    <TagBadge
      tag={{ slug: role, label: role, color }}
      className={className}
    />
  );
}

export function TagBadges({
  tags,
  className,
  hideMember = true,
}: {
  tags?: TagLike[] | null;
  className?: string;
  /** Hide the default Member tag (default true). */
  hideMember?: boolean;
}) {
  const list = (tags ?? []).filter(
    (t) => !(hideMember && t.slug.toLowerCase() === "member"),
  );
  if (!list.length) return null;
  return (
    <span className={clsx("inline-flex flex-wrap items-center gap-1.5", className)}>
      {list.map((t) => (
        <TagBadge key={t.slug} tag={t} />
      ))}
    </span>
  );
}
