import type { Metadata } from "next";

// SEO metadata for the QVenture surface. The page itself is a client component
// ("use client") and can't export metadata, so this server-component layout
// supplies it. The dynamic /qventure/a/[id] route overrides with its own
// generateMetadata (per-report title + OG image).

// Метаданные — на языке СТРАНИЦЫ. Их читает человек в поисковой выдаче и в
// предпросмотре ссылки в мессенджере, то есть ВСТРЕЧАЕТ модуль ещё до того,
// как открыл его. Английское описание у русской страницы означает, что первое
// впечатление — на чужом языке. Замер 04.09.2026.
const TITLE = "QVenture — ИИ-аналитик инвестиций для любого бизнеса";
const DESCRIPTION =
  "Проверка сделки уровня фонда за секунды. Прозрачная оценка 0–100 по восьми факторам, "
  + "совет из четырёх ролей (учёный, аналитик данных, экономист, юрист) и конкретная "
  + "стратегия входа — размер чека, диапазон оценки, этапы траншей, доходность с поправкой на риск.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    // Русские ключи идут первыми: страница русская, и ищут её по-русски.
    // Английские оставлены намеренно — модуль ищут и на английском, а
    // удаление ключей это решение о продвижении, а не о языке интерфейса.
    "ИИ-аналитик инвестиций", "проверка стартапа", "разбор венчурной сделки",
    "оценка сделки", "бизнес-ангел", "инвестиционная записка",
    "AI investment analyst", "startup due diligence", "venture screening",
    "deal scoring", "angel investing", "micro VC", "investment memo", "AEVION",
  ],
  alternates: { canonical: "/qventure" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/qventure",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function QVentureLayout({ children }: { children: React.ReactNode }) {
  // QVenture is a fund-grade English tool: memos, factor rationales, and the
  // financial vocabulary it speaks (MRR, IRR, LTV/CAC, MoIC, pre-money) are
  // generated in English and only read as a coherent whole in English. The
  // site-wide live DOM translator (AutoTranslate) would translate this dense,
  // jargon-heavy prose asynchronously and only partially — producing the
  // EN/RU "Runglish" mix a first-time investor sees. Opt the entire QVenture
  // surface out of DOM translation (AutoTranslate honors translate="no") so the
  // visitor gets one clean language. display:contents keeps layout untouched.
  return (
    <div translate="no" className="notranslate" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
