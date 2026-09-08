import type { Metadata } from "next";
import { BuyLink } from "@/components/BuyLink";
import { PaymentReachNotice } from "@/components/PaymentReachNotice";
import {
  SUBSCRIPTIONS,
  GUIDES,
  MODULES,
  MODULES_TOTAL_USD,
  channelFrom,
  withChannel,
  type Product,
} from "@/lib/products";
import { PageTracking } from "@/components/PageTracking";

// /en/shop — английская витрина. Назначение координатора 07.09.2026:
// /shop была худшей ДЕНЕЖНОЙ страницей для en-покупателя (73 % кириллицы в
// SSR при cookie en, замер EN-свипа 06.09) и словаря не касалась вовсе.
//
// Устройство: товары — из ТОГО ЖЕ каталога `@/lib/products` (цены и ссылки
// не копируются никогда), а тексты берутся из карты EN_TEXTS по id. Карта
// закрыта храповиком enShopCoversCatalog.guard: товар, добавленный в каталог
// без английского текста, роняет тест — «отсутствие молча» исключено.
//
// Переводы — ТОЧНЫЕ переводы действующих русских текстов витрины, без новых
// обещаний. Русскоязычные гайды честно помечены "Russian-language". Одно
// намеренное расхождение: RU-описание bureau обещает «подпись нотариуса» —
// в EN переведено как "signature" без нотариуса (обещание нотариуса на
// витрине сомнительно, находка передана сборщице 07.09; сближать в сторону
// более сильного обещания нельзя).

export const metadata: Metadata = {
  title: "AEVION Shop — subscriptions, guides, modules",
  description:
    "Everything you can buy at AEVION in one place: an all-access ecosystem subscription, science-based longevity guides and a book as one-time purchases, individual modules monthly. Instant delivery. Wellness and education, not medicine.",
  alternates: { canonical: "/en/shop" },
  openGraph: {
    title: "AEVION Shop — subscriptions, guides, modules",
    description:
      "All-access subscription, guides and a book as one-time purchases, modules monthly. Instant delivery. Wellness and education, not medicine.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Shop",
    description:
      "Subscriptions, guides and modules. Instant delivery. Wellness and education, not medicine.",
  },
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Английские тексты витрины по id каталога. Цен здесь нет и быть не может. */
export const EN_TEXTS: Record<
  string,
  { format: string; desc: string; includes?: string[]; notice?: string; badge?: string; titleEn?: string }
> = {
  // ── Подписки ──
  xpxzam: {
    badge: "ALL-IN-ONE",
    format: "subscription · monthly",
    desc: "Full platform access — 15+ modules: QRight, QSign, QCoreAI, QFusionAI, QPayNet, QTradeOffline, Constitution and more. One subscription, no limits.",
    includes: [
      "Every live AEVION product",
      "QRight · QSign · IP Bureau — full access",
      "Fintech stack: QTrade, QPayNet, QContract",
      "QCoreAI and Multichat Engine",
      "New modules as they ship — no extra charge",
    ],
  },
  wjvquw: {
    format: "subscription · monthly",
    desc: "World-order simulator: eight parameters, four pillars, live runs against historical regimes.",
    includes: ["Package contents not described by the seller — being clarified"],
  },
  pyiaz: {
    format: "subscription · monthly",
    desc: "World-order simulator: eight parameters, four pillars, live runs against historical regimes.",
    includes: ["Unlimited saves", "AI advisor", "Clean PDF export", "Embeddable widget"],
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
  // ── Модули ──
  devhub: {
    badge: "FLAGSHIP",
    format: "module · subscription",
    desc: "Browser IDE on the VS Code engine, AI code generation and deploys to Cloudflare Pages.",
  },
  smeta: {
    format: "module · subscription",
    desc: "AI trainer for construction estimating in Kazakhstan: SSC/ESN corpus, mistake analysis, forms 1–3 and KS-2/KS-3. Russian-language interface.",
  },
  qventure: {
    format: "module · subscription",
    desc: "Venture deal analysis: TAM/SOM, unit economics, founder-assumption checks.",
  },
  bureau: {
    format: "module · subscription",
    desc: "Proof of authorship: SHA-256 hash, timestamp and signature. The signing algorithm is named in the certificate itself.",
  },
  qpaynet: {
    badge: "BETA · DEMO",
    format: "module · subscription",
    desc: "Embedded-payments infrastructure: multi-currency, virtual cards, API and webhooks.",
    notice:
      "Demonstration mode. AEVION is not a licensed bank, payment institution or e-money issuer: no real funds or payments are processed — evaluation and learning only.",
  },
  cyberchess: {
    format: "module · subscription",
    desc: "Chess platform: puzzles, an AI coach, and opponents that play like humans at your level.",
  },
  qcontract: {
    badge: "BETA · DEMO",
    format: "module · subscription",
    desc: "Self-destructing protected documents: view and time limits, password and signature.",
    notice:
      "Demonstration mode. Documents and signatures created here are not legal advice and may have no legal force without independent review by a qualified professional.",
  },
};

function Card({ p, channel }: { p: Product; channel: string | null }) {
  const isSub = p.billing === "monthly";
  const en = EN_TEXTS[p.id];
  // Товар без английского текста сюда не попадёт живым — храповик
  // enShopCoversCatalog роняет сборку раньше. Запасной путь всё равно
  // честный: русский текст с пометкой языка на элементе, не молчание.
  const format = en?.format ?? p.format;
  const desc = en?.desc ?? p.desc;
  const descLang = en ? undefined : "ru";
  return (
    <BuyLink
      href={withChannel(p.href, channel, "en-shop")}
      source="en-shop"
      productId={p.id}
      priceUsd={p.priceUsd}
      channel={channel}
      style={styles.card}
    >
      <div style={styles.cardTop}>
        {(en?.badge ?? p.badge) ? <span style={styles.badge}>{en?.badge ?? p.badge}</span> : null}
        <span style={styles.format}>{format}</span>
      </div>

      <h3 style={styles.cardTitle}>{en?.titleEn ?? p.title}</h3>
      <p style={styles.cardDesc} lang={descLang}>
        {desc}
      </p>

      {en?.notice ? <p style={styles.notice}>{en.notice}</p> : null}

      {en?.includes?.length ? (
        <ul style={styles.includes}>
          {en.includes.map((line) => (
            <li key={line} style={styles.includesItem}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <div style={styles.spacer} />
      )}

      <div style={styles.cardFoot}>
        <span style={styles.price}>
          {CURRENCY.format(p.priceUsd)}
          {isSub ? <span style={styles.per}>/mo</span> : null}
        </span>
        <span style={styles.buy}>{isSub ? "Subscribe" : "Buy"}&nbsp;→</span>
      </div>
    </BuyLink>
  );
}

function Section({
  title,
  note,
  items,
  channel,
}: {
  title: string;
  note?: string;
  items: Product[];
  channel: string | null;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>{title}</h2>
        {note ? <p style={styles.sectionNote}>{note}</p> : null}
      </div>
      <div style={styles.grid}>
        {items.map((p) => (
          <Card key={p.id} p={p} channel={channel} />
        ))}
      </div>
    </section>
  );
}

export default async function EnShopPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const channel = channelFrom((await searchParams).c);
  return (
    <main style={styles.page}>
      <PageTracking page="en-shop" />
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · Shop</div>
        <h1 style={styles.h1}>Everything you can buy at AEVION</h1>
        <p style={styles.lede}>
          One subscription for the whole ecosystem, guides and a book as
          one-time purchases, individual modules monthly. Payment and instant
          delivery via Gumroad and LemonSqueezy.
        </p>

        <Section
          title="Subscriptions"
          note={`The same modules bought separately would cost ${CURRENCY.format(
            MODULES_TOTAL_USD,
          )} a month.`}
          items={SUBSCRIPTIONS}
          channel={channel}
        />

        <Section
          title="Guides & books"
          note="One-time purchase; the file arrives right after payment."
          items={GUIDES}
          channel={channel}
        />

        <Section
          title="Modules by subscription"
          note="A single product, billed monthly — when you need one tool rather than the whole ecosystem. Cancel any time."
          items={MODULES}
          channel={channel}
        />

        <PaymentReachNotice style={styles.foot} lang="en" />

        <p style={styles.foot}>
          Health and longevity materials are educational, wellness-focused
          content. Not intended to diagnose, treat or prevent any disease.
        </p>
      </div>
    </main>
  );
}

/* ── Светлый газетный стиль — тот же, что у русской витрины ── */
const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const RULE = "#ddd9cf";
const GOLD = "#a9781a";

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "48px 20px 64px" },
  wrap: { maxWidth: 1040, margin: "0 auto" },
  eyebrow: {
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: GOLD,
  },
  h1: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 40,
    lineHeight: 1.15,
    margin: "10px 0 0",
    fontWeight: 700,
  },
  lede: { color: MUTED, marginTop: 14, lineHeight: 1.65, maxWidth: 660, fontSize: 16 },
  section: { marginTop: 44 },
  sectionHead: { borderTop: `2px solid ${INK}`, paddingTop: 12 },
  h2: { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, margin: 0, fontWeight: 700 },
  sectionNote: { color: MUTED, fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  grid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: 18,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    background: "#fffdf8",
    border: `1px solid ${RULE}`,
    borderRadius: 4,
    padding: 22,
    textDecoration: "none",
    color: INK,
  },
  cardTop: { display: "flex", alignItems: "center", gap: 10, minHeight: 22 },
  badge: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: GOLD,
    color: "#fffdf8",
    borderRadius: 3,
    padding: "2px 8px",
    fontWeight: 700,
  },
  format: { fontFamily: "monospace", fontSize: 11.5, color: MUTED },
  cardTitle: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 20,
    fontWeight: 700,
    margin: "12px 0 0",
    lineHeight: 1.25,
  },
  cardDesc: { color: MUTED, fontSize: 13.5, lineHeight: 1.6, marginTop: 8 },
  spacer: { flex: 1, minHeight: 8 },
  notice: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "#7a4a12",
    background: "#fbf3e4",
    border: "1px solid #e8d5ae",
    borderRadius: 3,
    padding: "10px 12px",
    margin: "12px 0 0",
  },
  includes: {
    listStyle: "none",
    padding: "12px 0 0",
    margin: "14px 0 0",
    borderTop: `1px solid ${RULE}`,
    flex: 1,
  },
  includesItem: { fontSize: 13, lineHeight: 1.5, color: INK, marginBottom: 6 },
  cardFoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
    borderTop: `1px solid ${RULE}`,
    paddingTop: 16,
  },
  price: { fontSize: 22, fontWeight: 700, fontFamily: "Georgia, 'Times New Roman', serif" },
  per: { fontSize: 13, fontWeight: 400, color: MUTED, marginLeft: 2 },
  buy: {
    background: GOLD,
    color: "#fffdf8",
    borderRadius: 3,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  foot: {
    marginTop: 40,
    fontSize: 12.5,
    color: MUTED,
    borderTop: `1px solid ${RULE}`,
    paddingTop: 16,
  },
};
