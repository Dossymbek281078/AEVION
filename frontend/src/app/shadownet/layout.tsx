import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ModuleMaturity } from "@/components/ModuleMaturity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

// 20.10.2026 (слово Оркестратора): модуль — СИМУЛЯТОР (так подписан и на странице), а витрина
// обещала «приватную сеть, mesh-обмен, off-grid» и «Pro — максимальную приватность». Настоящее
// здесь — шифрование заметок в браузере (WebCrypto: PBKDF2 250k + AES-GCM 256); его и называем.
export const metadata: Metadata = {
  title: "ShadowNet — симулятор приватной сети",
  description:
    "Учебный симулятор приватной сети: модели угроз, маршрут через узлы, оценка анонимности; заметки, зашифрованные паролем в браузере (AES-GCM 256).",
  alternates: { canonical: `${SITE}/shadownet` },
  openGraph: {
    type: "website",
    url: `${SITE}/shadownet`,
    title: "ShadowNet — privacy network simulator",
    description: "Privacy network simulator · threat models · route simulation · anonymity score · passphrase-encrypted notes (AES-GCM 256).",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function ShadowNetLayout({ children }: { children: ReactNode }) {
  return <><ModuleMaturity id="shadownet" />
      {children}</>;
}
