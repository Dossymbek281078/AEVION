import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Innovation Partnership · $10M advance · 51/49 · Chief Idea Officer",
  description:
    "One partnership, not a buyout: $10M returnable advance + resources (compute, engineers, distribution, brand), revenue 51% founder / 49% partner, founder stays as Chief Idea Officer with a majority stake. AEV token ring-fenced.",
  openGraph: {
    title: "AEVION Innovation Partnership",
    description: "Partnership, not a buyout — $10M returnable advance + resources, 51/49 revenue. Founder stays as Chief Idea Officer, generating the next ideas.",
    type: "website",
  },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
