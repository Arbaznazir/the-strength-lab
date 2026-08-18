"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import { apiFetch, getCachedApiBase } from "@/lib/api";
import type { Category } from "@/lib/types";
import {
  ForumList,
  mapSponsorsToForums,
  type SponsorBanner,
} from "@/components/ForumList";
import { Sidebar } from "@/components/Sidebar";
import { TrustedStoresBoard, type TrustedStore } from "@/components/TrustedStores";
import { SocialLinks } from "@/components/SocialLinks";
import { NewPostButton } from "@/components/NewPostButton";
import { HeroSponsorCarousel } from "@/components/HeroSponsorCarousel";
import { useAuth } from "@/lib/auth";

const HERO_IMAGE = "/images/hero-gym-headphones.jpg";

export default function HomePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sponsors, setSponsors] = useState<SponsorBanner[]>([]);
  const [stores, setStores] = useState<TrustedStore[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [forumData, sponsorData, storeData] = await Promise.all([
          apiFetch<{ categories: Category[] }>("/forums", { auth: false }),
          apiFetch<{ banners: SponsorBanner[] }>("/sponsor-banners", {
            auth: false,
          }).catch(() => ({ banners: [] as SponsorBanner[] })),
          apiFetch<{ stores: TrustedStore[] }>("/trusted-stores", {
            auth: false,
          }).catch(() => ({ stores: [] as TrustedStore[] })),
        ]);
        if (!cancelled) {
          setCategories(forumData.categories);
          setSponsors(sponsorData.banners ?? []);
          setStores(storeData.stores ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load forums");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroExtras = useMemo<SponsorBanner[]>(
    () =>
      stores
        .filter((s) => s.bannerUrl)
        .map((s) => ({
          id: `store-${s.id}`,
          name: s.name,
          imageUrl: s.bannerUrl,
          linkUrl: s.linkUrl,
          threadSlug: s.threadSlug,
          sortOrder: 0,
          isActive: true,
          storeSlug: s.slug,
        })),
    [stores],
  );

  const community = categories.find((c) => c.slug === "community");
  const leadCategory = community ?? categories[0] ?? null;
  const tailCategories = community
    ? categories.filter((c) => c.slug !== "community")
    : categories.slice(1);

  const sponsorsByForumId = useMemo(() => {
    const forums = categories.flatMap((c) => c.forums ?? []);
    return mapSponsorsToForums(forums, sponsors);
  }, [categories, sponsors]);

  return (
    <div>
      {/* First viewport: brand + one line + CTA + full-bleed image */}
      <section className="relative isolate min-h-[80svh] overflow-hidden bg-[#0a0c0b] text-[#f2eee6] sm:min-h-[100svh]">
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-kenburns object-cover object-[58%_32%] opacity-75 sm:object-[58%_42%] md:object-[center_40%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0c0b] via-[#0a0c0b]/70 to-[#0a0c0b]/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c0b] via-[#0a0c0b]/5 to-[#0a0c0b]/20 sm:via-transparent sm:to-[#0a0c0b]/40" />
        </div>

        <div className="container-lab relative flex min-h-[80svh] flex-col justify-end gap-6 pb-12 pt-16 sm:min-h-[100svh] sm:gap-8 sm:pb-20 sm:pt-24">
          <div className="self-start">
            <HeroSponsorCarousel
              banners={sponsors}
              extras={heroExtras}
              stores={stores}
            />
          </div>
          <div className="min-w-0 max-w-xl">
          <p
            className="kicker anim-rise text-[color-mix(in_oklab,#d4ff3a_85%,white)]"
            style={{ animationDelay: "0.05s" }}
          >
            Strength community
          </p>
          <h1
            className="anim-rise mt-4 max-w-[14ch] text-[clamp(2.5rem,7vw,4.75rem)] font-bold leading-[0.95] tracking-tight"
            style={{ animationDelay: "0.12s" }}
          >
            The Strength{" "}
            <span className="text-[var(--accent)]">Lab</span>
          </h1>
          <div
            className="hero-rule mt-5 h-px w-24 bg-[var(--accent)] sm:w-32"
            aria-hidden
          />
          <p
            className="anim-rise mt-6 max-w-md text-base text-white/70 sm:text-lg"
            style={{ animationDelay: "0.22s" }}
          >
            Programming, form checks, and honest gym talk for lifters who take
            the work seriously.
          </p>
          <div
            className="anim-rise mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "0.32s" }}
          >
            <a href="#forums" className="btn-primary">
              Enter the forums
              <ArrowDownRight className="h-4 w-4" />
            </a>
            <NewPostButton
              ghost
              className="border-white/25 text-white hover:border-[var(--accent)]"
            />
            {!user ? (
              <>
                <Link
                  href="/login"
                  className="btn-ghost border-white/25 text-white hover:border-[var(--accent)]"
                >
                  Log in
                </Link>
                <Link href="/register" className="btn-primary">
                  Create account
                </Link>
              </>
            ) : (
              <Link href="/whats-new" className="btn-ghost border-white/25 text-white hover:border-[var(--accent)]">
                What&apos;s new
              </Link>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* Forums */}
      <section id="forums" className="scroll-mt-20 py-12 sm:py-16">
        <div className="container-lab">
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <p className="kicker">Boards</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Find your lane
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:justify-end sm:gap-3">
              <SocialLinks variant="footer" className="w-full sm:w-auto" />
              <NewPostButton compact className="!px-3 !py-2" />
              <Link
                href="/whats-new"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
              >
                Latest activity →
              </Link>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-12">
            <div className="min-w-0 space-y-12 overflow-x-hidden">
              {loading ? (
                <p className="text-[var(--muted)]">Loading forums…</p>
              ) : error ? (
                <div className="border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
                  {error}. Is the API running at{" "}
                  <code className="text-[var(--accent)]">{getCachedApiBase()}</code>
                  ?
                </div>
              ) : (
                <>
                  {leadCategory ? (
                    <ForumList
                      categories={[leadCategory]}
                      sponsorsByForumId={sponsorsByForumId}
                    />
                  ) : null}
                  <TrustedStoresBoard limit={3} />
                  {tailCategories.length ? (
                    <ForumList
                      categories={tailCategories}
                      sponsorsByForumId={sponsorsByForumId}
                    />
                  ) : null}
                </>
              )}
            </div>
            <Sidebar />
          </div>
        </div>
      </section>
    </div>
  );
}
