import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sponsor",
  description: "Sponsor threads and banner on The Strength Lab.",
};

export default function SponsorHubLayout({ children }: { children: ReactNode }) {
  return children;
}
