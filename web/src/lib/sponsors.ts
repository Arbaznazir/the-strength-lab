export function sponsorHubPath(slug: string) {
  return `/sponsors/${slug}`;
}

/** Square / poster creatives (not wide 5:1 or 6:1 banners). */
export function isSquareSponsorBanner(url?: string, name?: string): boolean {
  const u = (url || "").toLowerCase().split("?")[0] ?? "";
  const n = (name || "").toLowerCase();
  return u.includes("genlabs") || n.includes("genlabs");
}

export function externalSponsorHref(linkUrl?: string): string | undefined {
  const url = linkUrl?.trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return `https://${url}`;
}

export type SponsorContactInfo = {
  visit: { label: string; href: string }[];
  email?: string;
  whatsapp?: string;
};

/** Extra visit / contact details shown on sponsor hub pages. */
export const SPONSOR_CONTACTS: Record<string, SponsorContactInfo> = {
  genlabs: {
    visit: [
      { label: "www.genlabs.st", href: "https://www.genlabs.st" },
      { label: "www.yourmuscleshop.com", href: "https://www.yourmuscleshop.com" },
    ],
    email: "Support@genlabs.st",
    whatsapp: "+91 96917 10589",
  },
};

export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

/** Match a banner label to a trusted-store slug for hub links. */
export function sponsorSlugForName(
  name: string,
  stores: { name: string; slug: string }[],
): string | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  const exact = stores.find((s) => s.name.trim().toLowerCase() === key);
  if (exact) return exact.slug;
  return stores.find((s) => {
    const slug = s.name.trim().toLowerCase();
    return key.includes(slug) || slug.includes(key);
  })?.slug;
}

/** Top carousel / homepage banners → sponsor hub (threads), not the external shop. */
export function sponsorSlideHref(
  slide: {
    name: string;
    threadSlug?: string;
    storeSlug?: string;
  },
  stores: { name: string; slug: string }[],
): string | undefined {
  const slug = slide.storeSlug ?? sponsorSlugForName(slide.name, stores);
  if (slug) return sponsorHubPath(slug);
  if (slide.threadSlug) return `/threads/${slide.threadSlug}`;
  return undefined;
}
