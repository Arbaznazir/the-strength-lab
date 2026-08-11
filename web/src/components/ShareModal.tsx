"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { SHARE_TARGETS, buildShareLink } from "@/lib/site";
import { ShareTargetIcon } from "./SocialIcon";

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  label?: string;
};

export function ShareModal({
  open,
  onClose,
  url,
  title,
  label = "Share this post",
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        onClose();
      } catch {
        /* user cancelled */
      }
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 p-4 pt-[12vh] sm:pt-[15vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg border border-[var(--line-strong)] bg-[var(--bg-elevated)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 id="share-modal-title" className="text-sm font-semibold">
            {label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {canNativeShare ? (
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="mb-4 w-full border border-[var(--accent)] bg-[var(--accent-dim)] px-3 py-2.5 text-sm font-semibold text-[var(--accent)] hover:opacity-90"
            >
              Share via device…
            </button>
          ) : null}
          <div className="grid grid-cols-4 gap-2">
            {SHARE_TARGETS.map((target) => (
              <a
                key={target.id}
                href={buildShareLink(target.id, url, title)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Share on ${target.label}`}
                aria-label={`Share on ${target.label}`}
                className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded border border-[var(--line)] bg-[var(--bg)] px-1 py-2.5 text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <ShareTargetIcon target={target.id} className="h-5 w-5 shrink-0" />
                <span className="w-full truncate px-0.5 text-center text-[11px] font-medium leading-tight">
                  {target.label}
                </span>
              </a>
            ))}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">Copy link</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                readOnly
                value={url}
                className="field min-w-0 flex-1 text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex shrink-0 items-center gap-1.5 border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--fg)] hover:border-[var(--accent)]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
