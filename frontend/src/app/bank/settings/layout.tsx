import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — AEVION Bank",
  description:
    "Personal preferences for the bank UI: locale, display currency, signature audit-log retention, demo flags, sign-out.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
