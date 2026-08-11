import type { Metadata } from "next";
import Script from "next/script";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
        <Script id="tsl-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('tsl_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.classList.toggle('dark',d);document.documentElement.classList.toggle('light',!d);}catch(e){}})();`}
        </Script>
        <ThemeProvider>
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
