import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DevHub — AEVION",
  description: "Build and deploy apps with AI. No GitHub or cloud accounts needed.",
};

export default function DevHubLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
