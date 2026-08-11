"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getSocialLinks, type SocialLink } from "@/lib/site";
import { SocialPlatformIcon } from "./SocialIcon";

type SocialLinksProps = {
  className?: string;
  iconClassName?: string;
  variant?: "header" | "footer";
};

export function SocialLinks({
  className,
  iconClassName,
  variant = "header",
}: SocialLinksProps) {
  const [links, setLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    setLinks(getSocialLinks());
  }, []);

  if (!links.length) return null;

  return (
    <div
      className={clsx(
        "flex items-center gap-1",
        variant === "footer" && "gap-2",
        className,
      )}
      aria-label="Social media"
    >
      {links.map((link) => (
        <a
          key={link.id}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          aria-label={link.label}
          className={clsx(
            "inline-flex items-center justify-center transition-colors",
            variant === "header"
              ? "h-8 w-8 rounded text-current/60 hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
              : "h-9 w-9 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
            iconClassName,
          )}
        >
          <SocialPlatformIcon platform={link.id} />
        </a>
      ))}
    </div>
  );
}
