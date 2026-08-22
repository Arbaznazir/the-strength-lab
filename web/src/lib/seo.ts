export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.thestrengthlab.biz"
  );
}

export function getServerApiUrl(): string {
  return (
    process.env.API_INTERNAL_URL?.replace(/\/$/, "") ||
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:8080"
  );
}

type SitemapEntry = { slug: string; updatedAt?: string };
type SitemapMember = { username: string; updatedAt?: string };

export type SitemapData = {
  forums: SitemapEntry[];
  threads: SitemapEntry[];
  stores: SitemapEntry[];
  members: SitemapMember[];
};

export async function fetchSitemapData(): Promise<SitemapData> {
  const res = await fetch(`${getServerApiUrl()}/api/v1/seo/sitemap`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error("sitemap data unavailable");
  }
  return (await res.json()) as SitemapData;
}

export function siteJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "The Strength Lab",
        url: siteUrl,
        email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "strengthlabsupport@gmail.com",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "The Strength Lab",
        description:
          "A strength-focused community forum — programming, form checks, nutrition, and gym talk.",
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
