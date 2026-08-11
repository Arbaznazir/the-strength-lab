import type { Metadata } from "next";

const API =
  process.env.API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API}/api/v1/threads/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: "Thread" };
    const data = (await res.json()) as { thread?: { title?: string } };
    const title = data.thread?.title ?? "Thread";
    const description = "Discussion at The Strength Lab.";
    const site =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
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
