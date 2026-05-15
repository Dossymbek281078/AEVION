import type { Metadata } from "next";

// Admin tools are auth-gated and useless to crawlers — keep them out of
// search-engine indexes (defence in depth alongside robots.txt Disallow).
export const metadata: Metadata = {
  title: "AEVION QPayNet · Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
