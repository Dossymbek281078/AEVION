import type { Metadata } from "next";
export const metadata: Metadata = { title: "QMedia — AEVION", description: "Music, video and creative tools in one place" };
export default function QMediaLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
