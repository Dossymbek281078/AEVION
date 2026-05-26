import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Constitution — Product Demo · AEVION",
  description: "Interactive product tour: 8 sliders, 10 historical regimes, AI advisor, PDF export, Academy course. For Lemon Squeezy KYB review.",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
