import type { Metadata } from "next";
import { языки } from "@/lib/hreflang";
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
import { PLANET_BASE_MONTHLY, termPricePerMonth, STANDALONE_APPS,
} from "@/lib/termPricing";

/** Сколько приложений продаётся отдельно — из того же списка, что и карточки.
 *  Числом словом («пять») страница расходилась с витриной: их девять, и сумма
 *  рядом считалась по всем девяти. */
const ОТДЕЛЬНЫХ_ПРИЛОЖЕНИЙ = STANDALONE_APPS.length;


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
  title: "AEVION Shop — subscription, guides, apps",
  description:
    "Everything you can buy at AEVION in one place: a subscription to the whole planet for a term of 1 to 12 months, science-based longevity guides and a book as one-time purchases, 9 apps on their own. Wellness and education, not medicine.",
  alternates: { canonical: "/en/shop", languages: языки("/en/shop") },
  openGraph: {
    title: "AEVION Shop — subscription, guides, apps",
    description:
      "A subscription for a term of 1 to 12 months, guides and a book as one-time purchases, 9 apps on their own. Wellness and education, not medicine.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Shop",
    description:
      "Subscription, guides and apps. Wellness and education, not medicine.",
  },
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Английские тексты витрины по id каталога. Цен здесь нет и быть не может. */
export { EN_TEXTS } from "@/lib/enTexts";
import { EN_TEXTS } from "@/lib/enTexts";

function Card({ p, channel }: { p: Product; channel: string | null }) {
  const en = EN_TEXTS[p.id];
  // Товар без английского текста сюда не попадёт живым — храповик
  // enShopCoversCatalog роняет сборку раньше. Запасной путь всё равно
  // честный: русский текст с пометкой языка на элементе, не молчание.
  const format = en?.format ?? p.format;
  const desc = en?.desc ?? p.desc;
  const descLang = en ? undefined : "ru";
  // Term access (subscription and the 9 apps, policy of 15.09.2026) leads to
  // the pricing page, where the term is chosen and checkout_start fires — so a
  // plain same-tab link here, not a BuyLink that would count the purchase twice.
  const isTerm = p.billing === "term";
  const inner = (
    <>
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
          {isTerm ? <span style={styles.per}> for 1 month</span> : null}
        </span>
        <span style={styles.buy}>{isTerm ? "Choose a term" : "Buy"}&nbsp;→</span>
      </div>
    </>
  );

  if (isTerm) {
    return (
      <a href={withChannel(p.href, channel, "en-shop")} style={styles.card}>
        {inner}
      </a>
    );
  }

  return (
    <BuyLink
      href={withChannel(p.href, channel, "en-shop")}
      source="en-shop"
      productId={p.id}
      priceUsd={p.priceUsd}
      channel={channel}
      style={styles.card}
    >
      {inner}
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
          A subscription to the whole planet for a term of 1 to 12 months,
          guides and books as one-time purchases, {ОТДЕЛЬНЫХ_ПРИЛОЖЕНИЙ} apps on their own.
          Guides and books are paid via Gumroad with instant delivery; the
          subscription term and the apps are chosen on the pricing page.
        </p>

        <Section
          title="AEVION subscription"
          note={`The ${ОТДЕЛЬНЫХ_ПРИЛОЖЕНИЙ} apps bought separately — ${CURRENCY.format(
            MODULES_TOTAL_USD,
          )} for one month; the whole planet — ${CURRENCY.format(
            PLANET_BASE_MONTHLY,
          )} for one month, or ${CURRENCY.format(
            termPricePerMonth(PLANET_BASE_MONTHLY, "max"),
          )} a month when paying for 12 months up front.`}
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
          title="Apps on their own"
          note="9 apps are also sold separately — when you need one tool rather than the whole planet. A term of 1 to 12 months, paid up front; the longer the term, the cheaper the month. Every other module comes only with the AEVION subscription."
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
