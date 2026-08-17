import { Mail } from "lucide-react";
import clsx from "clsx";
import { CONTACT_EMAIL, contactMailto } from "@/lib/site";

type ContactUsButtonProps = {
  className?: string;
  compact?: boolean;
};

export function ContactUsButton({ className, compact }: ContactUsButtonProps) {
  return (
    <a
      href={contactMailto()}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-colors",
        compact
          ? "rounded px-2 py-1.5 text-sm hover:text-[var(--accent)]"
          : "btn-ghost !px-3 !py-2 text-sm",
        className,
      )}
      title={`Email ${CONTACT_EMAIL}`}
    >
      <Mail className="h-3.5 w-3.5" />
      Contact us
    </a>
  );
}
