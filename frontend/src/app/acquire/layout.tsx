import type { Metadata } from "next";
import { LIVE_MODULES } from "@/data/pitchFacts";

export const metadata: Metadata = {
  title: "AEVION — Partnership Brief · planet on Claude",
  description:
    "Planet AEVION — financial layer + IP/trust layer + dev agent-layer + consumer proof, under one settlement unit (AEV). One offer: a $10M repayable advance + a 51/49 revenue partnership.",
  openGraph: {
    // «AEV in circulation» отсюда убрано 14.08.2026: /api/aev/stats на проде
    // отдаёт totalMined 0, wallets 0, ledgerEntries 0 — в обращении нет ничего.
    // Это описание уезжает в превью ссылки в почте и мессенджерах, то есть
    // ровно туда, где его читает инвестор, ещё не открыв страницу. Возвращать
    // фразу можно в тот день, когда счётчик перестанет быть нулём, и не раньше:
    // ежедневный claims-audit сверяет её с этой ручкой и покраснеет снова.
    title: "Planet AEVION — Partnership Brief",
    description:
      `${LIVE_MODULES} modules in production. Constitution v1 attested. One offer: a $10M repayable advance + a 51/49 revenue partnership.`,
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function AcquireLayout({ children }: { children: React.ReactNode }) {
  return children;
}
