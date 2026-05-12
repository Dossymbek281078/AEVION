import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QJobs — Job Board | AEVION",
  description: "Find tech, AI, and business jobs. Post opportunities and apply with cover letters on the AEVION job board.",
  openGraph: {
    title: "QJobs — Job Board",
    description: "Find tech, AI, and business jobs on AEVION.",
    siteName: "AEVION",
  },
};

export default function QJobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
