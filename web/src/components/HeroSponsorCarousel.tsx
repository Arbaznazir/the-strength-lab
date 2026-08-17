"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { mediaURL } from "@/lib/api";
import type { SponsorBanner } from "./ForumList";

const ROTATE_MS = 3500;

function isVideoBanner(url: string) {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

function featuredSponsors(banners: SponsorBanner[]): SponsorBanner[] {
  const active = banners.filter((b) => b.isActive !== false && b.imageUrl);
  const steroidify = active.filter((b) =>
    b.name.toLowerCase().includes("steroidify"),
  );
  const rest = active.filter((b) => !b.name.toLowerCase().includes("steroidify"));
  return [...steroidify, ...rest].slice(0, 3);
}

export function HeroSponsorCarousel({
  banners,
}: {
  banners: SponsorBanner[];
}) {
  const slides = useMemo(() => featuredSponsors(banners), [banners]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  if (!slides.length) return null;

  const current = slides[index] ?? slides[0];
  const src = mediaURL(current.imageUrl) || current.imageUrl;
  const href = current.linkUrl?.trim() || undefined;

  const media = isVideoBanner(current.imageUrl) ? (
    <video
      key={current.id}
      src={src}
      className="pointer-events-none h-full w-full object-contain"
      autoPlay
      muted
      loop
      playsInline
      tabIndex={-1}
      aria-hidden
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current.id}
      src={src}
      alt={current.name}
      className="pointer-events-none h-full w-full object-contain"
    />
  );

  const frame = (
    <div className="relative aspect-[6/1] max-h-28 w-full overflow-hidden border border-white/15 bg-[#0a0c0b] sm:max-h-32">
      {media}
    </div>
  );

  return (
    <div
      className="anim-rise w-full max-w-md shrink-0 sm:max-w-lg"
      style={{ animationDelay: "0.02s" }}
    >
      <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/55">
        Sponsors
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`Visit ${current.name}`}
          className="block"
        >
          {frame}
        </a>
      ) : (
        frame
      )}
      {slides.length > 1 ? (
        <div className="mt-2 flex items-center justify-start gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show ${s.name}`}
              onClick={() => setIndex(i)}
              className={clsx(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-5 bg-[var(--accent)]"
                  : "w-1.5 bg-white/35 hover:bg-white/60",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
