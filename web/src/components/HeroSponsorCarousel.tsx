"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { mediaURL } from "@/lib/api";
import { isSquareSponsorBanner, sponsorSlideHref } from "@/lib/sponsors";
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
  // GenLabs first (client priority), then other featured partners.
  const first = pick("genlabs") ?? pick("gen labs");
  const second = pick("steroidify");
  const third = pick("your muscle") ?? pick("muscle shop");
  const fourth = pick("napsgear") ?? pick("naps gear");
  const used = new Set(
    [first, second, third, fourth].filter(Boolean).map((b) => nameKey(b!.name)),
  );
  const rest = pool.filter((b) => !used.has(nameKey(b.name)));
  return [first, second, third, fourth, ...rest]
    .filter((b): b is SponsorBanner => Boolean(b))
    .slice(0, 4);
}

export function HeroSponsorCarousel({
  banners,
  extras = [],
  stores = [],
}: {
  banners: SponsorBanner[];
  extras?: SponsorBanner[];
  stores?: { name: string; slug: string }[];
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
  const href = sponsorSlideHref(current, stores);
  const square = isSquareSponsorBanner(current.imageUrl, current.name);

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

  const frame = square ? (
    <div className="relative aspect-square w-[7.5rem] overflow-hidden border border-white/15 bg-[#0a0c0b] sm:w-36">
      {media}
    </div>
  ) : (
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
        <Link
          href={href}
          aria-label={`Open ${current.name} threads`}
          className={clsx("block", square && "w-fit")}
        >
          {frame}
        </Link>
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
