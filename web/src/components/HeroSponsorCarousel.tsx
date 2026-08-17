"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { mediaURL } from "@/lib/api";
import type { SponsorBanner } from "./ForumList";

const ROTATE_MS = 3500;

function isVideoBanner(url: string) {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

function uniqueByName(banners: SponsorBanner[]): SponsorBanner[] {
  const seenName = new Set<string>();
  const seenImage = new Set<string>();
  const out: SponsorBanner[] = [];
  for (const b of banners) {
    if (b.isActive === false || !b.imageUrl) continue;
    const key = nameKey(b.name);
    const image = b.imageUrl.toLowerCase().split("?")[0] ?? "";
    if (!key || seenName.has(key) || seenImage.has(image)) continue;
    seenName.add(key);
    seenImage.add(image);
    out.push(b);
  }
  return out;
}

function featuredSponsors(
  banners: SponsorBanner[],
  extras: SponsorBanner[],
): SponsorBanner[] {
  const pool = uniqueByName([...banners, ...extras]);
  const pick = (needle: string) =>
    pool.find((b) => nameKey(b.name).includes(needle));
  const first = pick("steroidify");
  const second = pick("napsgear") ?? pick("naps gear");
  const used = new Set(
    [first, second].filter(Boolean).map((b) => nameKey(b!.name)),
  );
  const rest = pool.filter((b) => !used.has(nameKey(b.name)));
  return [first, second, ...rest].filter((b): b is SponsorBanner => Boolean(b)).slice(0, 3);
}

export function HeroSponsorCarousel({
  banners,
  extras = [],
}: {
  banners: SponsorBanner[];
  extras?: SponsorBanner[];
}) {
  const slides = useMemo(
    () => featuredSponsors(banners, extras),
    [banners, extras],
  );
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
        <Link href="/sponsors" className="hover:text-white">
          Sponsors
        </Link>
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
