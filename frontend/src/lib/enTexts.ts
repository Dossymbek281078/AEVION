/**
 * Английские тексты каталога: формат, подпись и пометки по id товара.
 *
 * 🔴 06.10.2026 ВЫНЕСЕНО ИЗ en/shop/page.tsx, и вот почему. Я поставил русскую
 * подпись каталога на витрину /apps, а корень сайта объявлен lang="en" — шесть
 * карточек заговорили по-русски на английской странице. Нашла приёмка живым замером
 * прода (строк с кириллицей 16 против 45 латиницей); мой сторож был зелёным, потому
 * что проверял, ДОЕХАЛА ли подпись, и не спрашивал, на каком она языке.
 *
 * Чинится это чтением английского текста, а он жил внутри страницы магазина. Чтобы
 * /apps не импортировала страницу ради одной карты (это затащило бы в её сборку весь
 * компонент магазина), карта переехала сюда. Страница магазина её РЕЭКСПОРТИРУЕТ,
 * поэтому прежние импортёры (храповик enShopCoversCatalog) продолжают работать.
 */
export const EN_TEXTS: Record<
  string,
  { format: string; desc: string; includes?: string[]; notice?: string; badge?: string; titleEn?: string }
> = {
  // ── Подписка (политика 15.09.2026: срок доступа ко всей планете) ──
  "aevion-planet": {
    badge: "ALL-IN-ONE",
    titleEn: "AEVION subscription",
    format: "the whole planet · term of 1–12 months",
    desc: "Access to every AEVION module for the term you choose: 1, 3, 6, 9 or 12 months. The longer the term, the cheaper the month. Paid for the whole term up front, in one payment.",
    includes: [
      "Every AEVION module — no per-module charge",
      "Terms: 1 · 3 · 6 · 9 · 12 months",
      "The month gets cheaper with the term — half price on 12 months",
      "New modules released during your paid term are included too",
    ],
  },
  // ── Гайды и книги ──
  oijxmq: {
    badge: "NEW",
    titleEn: "AEVION Longevity Protocol — 12 weeks",
    format: "PDF · 9 pages · Russian",
    desc: "A measure → intervene → re-measure cycle: a 26-marker panel with target ranges, 20 interventions graded A/B/C/E by evidence, a 12-week timeline and a results table. Includes what is overrated (NMN/NR, telomeres, “wave” gadgets). Russian-language guide.",
  },
  tmuyxw: {
    titleEn: "The Anti-Grey Protocol — Russian edition",
    format: "PDF · guide · Russian",
    desc: "The science of why hair greys and what actually slows it — no hype. Russian-language guide.",
  },
  kkiavh: {
    format: "PDF · guide · EN",
    desc: "The evidence-first science of pigment aging and what actually slows it.",
  },
  ghvzq: {
    titleEn: "Gratitude ∞ Forever Young — Complete Pack",
    format: "PDF + EPUB + audio · book",
    desc: "A 90-day gratitude-and-youth practice: 4 minutes a day. Book, audiobook and materials in one pack.",
  },
  lelzw: {
    titleEn: "Gratitude ∞ Forever Young — Book + Audiobook",
    format: "PDF + EPUB + audio",
    desc: "The book plus the full audio version — for listening on the move.",
  },
  orcfbo: {
    titleEn: "Gratitude ∞ Forever Young — Book (PDF + EPUB)",
    format: "PDF + EPUB",
    desc: "The book text only. The most affordable way in.",
  },
  // ── Отдельные приложения (только пять, политика 15.09.2026) ──
  devhub: {
    badge: "FLAGSHIP",
    format: "app · term of 1–12 months",
    // 🔴 06.10.2026: английская витрина тоже говорит, ЗА ЧТО деньги.
    // Русскую подпись я написал днём, а здесь текст свой — и англоязычный покупатель
    // про нормы Pro не узнавал вовсе. Числа ТЕ ЖЕ, что в русской подписи и в таблице
    // TIER_LIMITS бэкенда; сторож devhubCardSaysWhatMoneyBuys сверяет обе поверхности
    // с той таблицей, поэтому разойтись молча они не могут.
    desc:
      "Browser IDE on the VS Code engine, AI code generation and deploys to Cloudflare Pages. " +
      "Paying raises studio quotas to Pro: 50 videos, 200 images, 100 tracks and 200000 " +
      "characters of speech per month, unlimited deploys — against 3, 10, 5 and 10000 on the free tier.",
  },
  multichat: {
    format: "app · term of 1–12 months",
    desc: "One question — answers from models of four independent providers side by side, with a map of where they disagree and a receipt you can verify by link.",
  },
  qventure: {
    format: "app · term of 1–12 months",
    desc: "Venture deal analysis: TAM/SOM, unit economics, founder-assumption checks.",
  },
  bureau: {
    format: "app · term of 1–12 months",
    desc: "Proof of authorship: SHA-256 hash, timestamp and signature. The signing algorithm is named in the certificate itself.",
  },
  cyberchess: {
    format: "app · term of 1–12 months",
    desc: "Chess platform: puzzles, an AI coach, and opponents that play like humans at your level.",
  },
  // Четыре приложения получили цену 20.09.2026 — переводы точные, без новых обещаний.
  qright: {
    format: "app · term of 1–12 months",
    desc: "Authorship registration: the date and content of a work are recorded, and the evidence can be exported.",
  },
  qsign: {
    format: "app · term of 1–12 months",
    desc: "Document signing and integrity checks: canonical JSON, verification by fingerprint.",
  },
  "startup-exchange": {
    format: "app · term of 1–12 months",
    desc: "A showcase of ideas, MVPs and finished products: publish one, find one, agree on a deal.",
  },
  qskyway: {
    format: "app · term of 1–12 months",
    desc: "Navigation of a city’s air corridors: routes, altitudes, restrictions and wind.",
  },
};
