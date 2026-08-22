import type { Metadata } from "next";
import { getServerApiUrl, getSiteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${getServerApiUrl()}/api/v1/threads/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: "Thread" };
    const data = (await res.json()) as { thread?: { title?: string } };
    const title = data.thread?.title ?? "Thread";
    const description = `${title} — discussion at The Strength Lab community forum.`;
    const site = getSiteUrl();
    const url = `${site}/threads/${slug}`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        type: "article",
        siteName: "The Strength Lab",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
      alternates: {
        canonical: url,
      },
    };
  } catch {
    return { title: "Thread" };
  }
}

export default function ThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
