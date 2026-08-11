"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import clsx from "clsx";
import { SHARE_TARGETS, buildShareLink } from "@/lib/site";
import { ShareTargetIcon } from "./SocialIcon";

type ShareBarProps = {
  url: string;
  title: string;
  className?: string;
};

export function ShareBar({ url, title, className }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--line)] pt-4",
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Share
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {SHARE_TARGETS.map((target) => (
          <a
            key={target.id}
            href={buildShareLink(target.id, url, title)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Share on ${target.label}`}
            aria-label={`Share on ${target.label}`}
            className="rounded p-2 text-[var(--muted)] transition-colors hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
          >
            <ShareTargetIcon target={target.id} className="h-4 w-4" />
          </a>
        ))}
        <button
          type="button"
          onClick={() => void copyLink()}
          title="Copy link"
          aria-label="Copy link"
          className="rounded p-2 text-[var(--muted)] transition-colors hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
        >
          {copied ? (
            <Check className="h-4 w-4 text-[var(--accent)]" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
