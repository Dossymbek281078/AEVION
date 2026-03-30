import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecosystem demonstration",
  description:
    "Полный разбор выгод AEVION: платформа целиком, Planet, все 27 узлов — для инвесторов и партнёров.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
