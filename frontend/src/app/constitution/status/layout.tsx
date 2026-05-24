import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Constitution Status — Service Uptime · AEVION",
  description: "Публичный статус-монитор Constitution: 6 сервисов, проверка каждые 30с, 24h uptime и sparkline.",
  alternates: { canonical: `${SITE}/constitution/status` },
};

export default function StatusLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
