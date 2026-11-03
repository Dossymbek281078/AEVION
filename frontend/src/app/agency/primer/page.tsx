// /agency/primer — живой пример услуг AEVION Automation (сайт с заявкой, бот записи, черновик ответа).
// Перенос aevion-agency-site/primer.html. Ничего не отправляется; единственный сетевой вызов — учёт захода.
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { PrimerView } from "./PrimerView";

const TITLE = "Пример: сайт с заявками, бот записи и ИИ-ответ — AEVION Automation";
const DESC =
  "Живой пример трёх услуг для малого бизнеса: сайт-визитка, с которой заявка сразу приходит владельцу; бот записи в WhatsApp/Telegram; черновик ответа на обращение клиента. Нажмите и попробуйте как клиент.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://aevion.app/agency/primer" },
  openGraph: {
    type: "website",
    title: "Как это выглядит у клиента: заявка, запись через бот, готовый ответ",
    description: "Пример на вымышленном барбершопе. Всё нажимается, ничего никуда не отправляется.",
    images: [{ url: "https://aevion-agency-site.vercel.app/assets/og/aevion-automation.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function AgencyPrimerPage() {
  return (
    <>
      <PageTracking page="agency-primer" />
      <PrimerView />
    </>
  );
}
