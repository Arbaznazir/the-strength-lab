export function sponsorHubPath(slug: string) {
  return `/sponsors/${slug}`;
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

export function sponsorSlideHref(
  slide: { name: string; threadSlug?: string; storeSlug?: string },
  stores: { name: string; slug: string }[],
): string | undefined {
  const slug = slide.storeSlug ?? sponsorSlugForName(slide.name, stores);
  if (slug) return sponsorHubPath(slug);
  if (slide.threadSlug) return `/threads/${slide.threadSlug}`;
  return undefined;
}
