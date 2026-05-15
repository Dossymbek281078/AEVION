import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QLearn — Learning Platform | AEVION",
  description:
    "Online courses for tech, business, design, music and more. Learn at your own pace with QLearn.",
  openGraph: {
    title: "QLearn — Learning Platform",
    description: "Online courses for tech, business, design, music and more.",
    siteName: "AEVION",
  },
};

export default function QLearnLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
