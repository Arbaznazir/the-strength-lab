import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sponsors",
  description: "Lab-vetted partners for The Strength Lab.",
};

export default function SponsorsLayout({ children }: { children: ReactNode }) {
  return children;
}
