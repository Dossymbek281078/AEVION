import type { Metadata } from "next";
export const metadata: Metadata = { title: "QMedia", description: "Listen to music and watch videos, add your own by link; AI song lyrics and titles." };
export default function QMediaLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
