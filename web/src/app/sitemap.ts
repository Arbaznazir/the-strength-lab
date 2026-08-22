import type { MetadataRoute } from "next";
import { fetchSitemapData, getSiteUrl } from "@/lib/seo";

export const revalidate = 3600;

function entry(
  url: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  lastModified?: string,
): MetadataRoute.Sitemap[number] {
  return {
    url,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${base}/whats-new`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${base}/members`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/sponsors`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/online`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.5,
    },
    {
      url: `${base}/search`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  try {
    const data = await fetchSitemapData();

    const forums = data.forums.map((f) =>
      entry(`${base}/forums/${f.slug}`, 0.85, "daily", f.updatedAt),
    );
    const threads = data.threads.map((t) =>
      entry(`${base}/threads/${t.slug}`, 0.7, "weekly", t.updatedAt),
    );
    const stores = data.stores.map((s) =>
      entry(`${base}/sponsors/${s.slug}`, 0.75, "weekly", s.updatedAt),
    );
    const members = data.members.map((m) =>
      entry(`${base}/members/${m.username}`, 0.55, "weekly", m.updatedAt),
    );

    return [...staticPages, ...forums, ...threads, ...stores, ...members];
  } catch {
    return staticPages;
  }
}
