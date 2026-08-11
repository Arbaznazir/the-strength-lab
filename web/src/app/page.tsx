"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import { apiFetch, getCachedApiBase } from "@/lib/api";
import type { Category } from "@/lib/types";
import { ForumList } from "@/components/ForumList";
import { Sidebar } from "@/components/Sidebar";
import { SocialLinks } from "@/components/SocialLinks";
import { useAuth } from "@/lib/auth";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2400&q=80";

export default function HomePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ categories: Category[] }>("/forums", {
          auth: false,
        });
        if (!cancelled) setCategories(data.categories);
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

  return (
    <div>
      {/* First viewport: brand + one line + CTA + full-bleed image */}
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-[#0a0c0b] text-[#f2eee6]">
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-kenburns object-cover object-[center_30%] opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0c0b] via-[#0a0c0b]/78 to-[#0a0c0b]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c0b] via-transparent to-[#0a0c0b]/40" />
        </div>

        <div className="container-lab relative flex min-h-[100svh] flex-col justify-end pb-16 pt-28 sm:pb-20 sm:pt-32">
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
      </section>

      {/* Forums */}
      <section id="forums" className="scroll-mt-20 py-12 sm:py-16">
        <div className="container-lab">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker">Boards</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Find your lane
              </h2>
            </div>
            <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
              <SocialLinks variant="footer" />
              <Link
              href="/whats-new"
              className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
            >
              Latest activity →
            </Link>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-12">
            <div>
              {loading ? (
                <p className="text-[var(--muted)]">Loading forums…</p>
              ) : error ? (
                <div className="border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
                  {error}. Is the API running at{" "}
                  <code className="text-[var(--accent)]">{getCachedApiBase()}</code>
                  ?
                </div>
              ) : (
                <ForumList categories={categories} />
              )}
            </div>
            <Sidebar />
          </div>
        </div>
      </section>
    </div>
  );
}
