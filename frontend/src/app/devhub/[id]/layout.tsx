import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project IDE — DevHub | AEVION",
  description: "Edit, generate, and deploy your project with AI.",
};

export default function DevHubProjectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
