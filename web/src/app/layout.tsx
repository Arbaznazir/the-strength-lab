import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { MessagesRealtimeProvider } from "@/lib/messagesRealtime";
import { ThemeProvider } from "@/lib/theme";
import { Shell } from "@/components/Shell";
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

export const metadata: Metadata = {
  title: {
    default: "The Strength Lab",
    template: "%s · The Strength Lab",
  },
  description:
    "A strength-focused community forum — programming, form checks, and gym talk.",
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

  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full ${resolved}`}
      data-theme={resolved}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
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
