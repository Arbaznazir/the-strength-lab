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
