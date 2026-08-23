"use client";

import { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import clsx from "clsx";
import { CONTACT_EMAILS, contactMailto } from "@/lib/site";

type ContactUsButtonProps = {
  className?: string;
  compact?: boolean;
  /** Where the email picker opens relative to the button */
  menuPlacement?: "up" | "down";
};

export function ContactUsButton({
  className,
  compact,
  menuPlacement = "down",
}: ContactUsButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative inline-flex", className)}>
      <button
        type="button"
        className={clsx(
          "inline-flex w-full items-center justify-center gap-1.5 font-semibold transition-colors",
          compact
            ? "rounded px-2 py-1.5 text-sm hover:text-[var(--accent)]"
            : "btn-ghost !px-3 !py-2 text-sm",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Mail className="h-3.5 w-3.5" />
        Contact us
      </button>

      {open ? (
        <div
          role="menu"
          className={clsx(
            "absolute left-1/2 z-50 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)] py-1 shadow-2xl sm:left-0 sm:translate-x-0",
            menuPlacement === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <p className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Choose an email
          </p>
          {CONTACT_EMAILS.map((email) => (
            <a
              key={email}
              role="menuitem"
              href={contactMailto(email)}
              className="block truncate px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
              onClick={() => setOpen(false)}
            >
              {email}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
