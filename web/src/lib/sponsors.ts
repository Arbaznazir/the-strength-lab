export function sponsorHubPath(slug: string) {
  return `/sponsors/${slug}`;
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
  "genlabs-loot-sale": {
    visit: [
      { label: "www.genlabs.st", href: "https://www.genlabs.st" },
      { label: "www.yourmuscleshop.com", href: "https://www.yourmuscleshop.com" },
    ],
    email: "Support@genlabs.st",
    whatsapp: "+91 96917 10589",
  },
  "genlabs-price-drop": {
    visit: [
      { label: "www.genlabs.st", href: "https://www.genlabs.st" },
      { label: "www.yourmuscleshop.com", href: "https://www.yourmuscleshop.com" },
    ],
    email: "Support@genlabs.st",
    whatsapp: "+91 96917 10589",
  },
  "nad-plus-deals": {
    visit: [
      { label: "www.yourmuscleshop.com", href: "https://www.yourmuscleshop.com" },
      { label: "www.genlabs.st", href: "https://www.genlabs.st" },
    ],
    email: "support@yourmuscleshop.com",
    whatsapp: "+91 96917 10589",
  },
  "yms-price-drop-alert": {
    visit: [{ label: "www.yourmuscleshop.com", href: "https://www.yourmuscleshop.com" }],
    email: "support@yourmuscleshop.com",
    whatsapp: "+91 96917 10589",
  },
  "yms-loot-sale": {
    visit: [{ label: "www.yourmuscleshop.com", href: "https://www.yourmuscleshop.com" }],
    email: "wholesale@yourmuscleshop.com",
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

/** When official thread slugs differ from trusted-store slugs. */
const OFFICIAL_THREAD_HUB_SLUG: Record<string, string> = {
  "dmk-labs": "dmk-labs-usa",
};

/** Map `official-{key}` thread slugs to sponsor hub slugs. */
export function hubSlugFromOfficialThread(threadSlug?: string): string | undefined {
  if (!threadSlug?.startsWith("official-")) return undefined;
  const key = threadSlug.slice("official-".length);
  return OFFICIAL_THREAD_HUB_SLUG[key] ?? key;
}

/** Top carousel / homepage banners → sponsor hub, not the thread or external shop. */
export function sponsorSlideHref(
  slide: {
    name: string;
    threadSlug?: string;
    storeSlug?: string;
  },
  stores: { name: string; slug: string }[] = [],
): string | undefined {
  const slug =
    slide.storeSlug ??
    sponsorSlugForName(slide.name, stores) ??
    hubSlugFromOfficialThread(slide.threadSlug);
  if (slug) return sponsorHubPath(slug);
  if (slide.threadSlug) return `/threads/${slide.threadSlug}`;
  return undefined;
}
