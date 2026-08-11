"use client";

function TypingDots() {
  return (
    <span className="ml-0.5 inline-flex gap-px" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1 w-1 animate-pulse rounded-full bg-current"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex h-7 items-center rounded-2xl rounded-bl-sm bg-[var(--bg)] px-3 py-1.5">
        <p className="text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--fg)]">{name}</span> is typing
          <TypingDots />
        </p>
      </div>
    </div>
  );
}
