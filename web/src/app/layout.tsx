import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { MessagesRealtimeProvider } from "@/lib/messagesRealtime";
import { ThemeProvider } from "@/lib/theme";
import { Shell } from "@/components/Shell";
import { getSiteUrl, siteJsonLd } from "@/lib/seo";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function resolveServerTheme(stored: string | undefined): "light" | "dark" {
  if (stored === "light") return "light";
  return "dark";
}

const siteUrl = getSiteUrl();
const siteDescription =
  "The Strength Lab — a strength-focused community forum for programming, form checks, nutrition, PED discussion, and gym talk.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "The Strength Lab",
    template: "%s · The Strength Lab",
  },
  description: siteDescription,
  keywords: [
    "strength training",
    "bodybuilding forum",
    "powerlifting community",
    "gym forum",
    "form check",
    "workout programming",
    "The Strength Lab",
    "thestrengthlab",
  ],
  applicationName: "The Strength Lab",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "The Strength Lab",
    title: "The Strength Lab",
    description: siteDescription,
    images: [{ url: "/images/hero-gym-headphones.jpg", width: 1200, height: 630, alt: "The Strength Lab" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Strength Lab",
    description: siteDescription,
    images: ["/images/hero-gym-headphones.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const stored = cookieStore.get("tsl_theme")?.value;
  const resolved = resolveServerTheme(stored);

  const jsonLd = siteJsonLd(siteUrl);

  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full ${resolved}`}
      data-theme={resolved}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider initialResolved={resolved}>
          <AuthProvider>
            <MessagesRealtimeProvider>
              <Shell>{children}</Shell>
            </MessagesRealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
