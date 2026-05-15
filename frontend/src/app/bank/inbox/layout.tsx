import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Inbox",
  description: "Single feed of pending wallet actions: splits, advances, recurring payments, goals nearing deadline.",
  robots: { index: false, follow: false },
};

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
