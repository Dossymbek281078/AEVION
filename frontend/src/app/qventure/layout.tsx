import type { Metadata } from "next";

// SEO metadata for the QVenture surface. The page itself is a client component
// ("use client") and can't export metadata, so this server-component layout
// supplies it. The dynamic /qventure/a/[id] route overrides with its own
// generateMetadata (per-report title + OG image).

// Метаданные — на языке СТРАНИЦЫ. Их читает человек в поисковой выдаче и в
// предпросмотре ссылки в мессенджере, то есть ВСТРЕЧАЕТ модуль ещё до того,
// как открыл его. Английское описание у русской страницы означает, что первое
// впечатление — на чужом языке. Замер 04.09.2026.
// Титул двуязычный НАМЕРЕННО (06.09.2026): metadata у Next статична на
// маршрут, языка читателя здесь нет, а доводчик <title> не переводит.
// EN-визитёр раньше видел чисто русскую вкладку у «fund-grade English tool».
const TITLE = "QVenture — AI Deal Analyzer · ИИ-аналитик инвестиций";
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
  // 06.09.2026: обёртка translate="no" снята С МОДУЛЯ ЦЕЛИКОМ. Опт-аут
  // переехал ТОЧЕЧНО на ResultView (_result.tsx): мемо и обоснования
  // факторов генерятся английской прозой — там notranslate законен и
  // защищает инвестора от EN/RU-«рунглиша». Витрина и форма отданы
  // доводчику: с обёрткой здесь EN-гость видел русскую страницу ЦЕЛИКОМ
  // (замер 06.09 — 2013 знаков кириллицы, доводчик уважает notranslate и
  // не трогал ничего; ветка attrs-wave добавила точечный опт-аут, но эту
  // обёртку снять забыла — числа RU-доли не сдвинулись). Регрессию
  // стережёт attrDictionariesSpeakTheirLang: у layout notranslate запрещён.
  return <>{children}</>;
}
