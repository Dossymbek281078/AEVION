import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Notifications",
  description: "Achievements unlocked, signed operations, anomaly flags, gift events and goal completions in one feed.",
  robots: { index: false, follow: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
