import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";

export const metadata: Metadata = {
  title: "AEVION · Verify certificate",
  description:
    "Verify an AEVION certificate (QSign / QRight / Bureau / Planet). Public verification of authorship, signature and validator quorum — independent of any user account.",
  openGraph: {
    title: "AEVION — Verify certificate",
    description: "Public verification of AEVION authorship, signature, and validator-quorum certificates.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary",
    title: "AEVION verify",
    description: "Public certificate verification.",
  },
  robots: { index: false, follow: true },
};

/*
 * Визит с меткой письма считается здесь, в разметке раздела: она общая для
 * /verify и /verify/[id], а страница сертификата клиентская и большая.
 *
 * Повод 21.10.2026 (замер Продаж): письма волн 12–13 ведут первой ссылкой на
 * /verify/<certId>?c=mail-…, а визит не записывался — PageTracking стоял на
 * главной, /proof, /bureau, но не здесь. В byPost по волне 13 за сутки было
 * 0 строк при доставленных письмах. Сторож: verify/__tests__/verifyCountsVisit.test.tsx.
 */
export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageTracking page="verify" />
      {children}
    </>
  );
}
