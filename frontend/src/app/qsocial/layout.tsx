import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QSocial — AEVION Social Network",
  description: "Connect with the AEVION community. Share posts, follow creators, and explore the global feed on QSocial.",
  openGraph: {
    title: "QSocial — AEVION Social Network",
    description: "Connect with the AEVION community.",
    siteName: "AEVION",
  },
};

export default function QSocialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
