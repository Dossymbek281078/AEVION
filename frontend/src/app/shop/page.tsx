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

// AEVION Shop — единая витрина всех покупаемых товаров.
//
// Товары берутся из `@/lib/products` — единого каталога, а не из списка в этом файле.
// До 2026-07-26 здесь было 3 позиции хардкодом при 15 живых чекаутах: покупатель
// видел книгу и два гайда, а подписки ($59/$49/$9 в мес) и семь модулей с рабочей
// оплатой на витрину не попадали вовсе.
//
// Стиль — светлый газетный (память feedback_aevion_light_newspaper_ui): бумага,
// serif-заголовки, тонкие линейки, золото акцентом. Раньше страница была тёмной.

export const metadata: Metadata = {
  title: "Магазин AEVION — подписки, гайды, модули",
  description:
    "Все товары AEVION в одном месте: подписка на всю экосистему, научные гайды о долголетии и книга разовой покупкой, отдельные модули помесячно. Мгновенная выдача. Wellness и образование, не медицина.",
  // СВОЙ canonical, и для этой страницы он важнее, чем для большинства.
  // На неё ведут ссылки с меткой канала: ?c=tt, ?c=ig, ?c=dz и ещё семь.
  // Без canonical поисковик вправе счесть каждый вариант отдельной
  // страницей — вес входа воронки размазывается по десяти адресам.
  // Проверено на живом сайте 30.08.2026: canonical не отдавался вовсе
  // (контроль: /pricing свой отдаёт, значит проба различает).
  alternates: { canonical: "/shop" },
  // Своя карточка предпросмотра: это страница с кассами, и ссылку на неё
  // пересылают чаще прочих. Оговорку «не медицина» держим и здесь — она
  // должна доезжать до человека вместе со ссылкой, а не только на странице.
  openGraph: {
    title: "Магазин AEVION — подписки, гайды, модули",
    description:
      "Подписка на экосистему, научные гайды и книга разовой покупкой, модули помесячно. Мгновенная выдача. Wellness и образование, не медицина.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Магазин AEVION",
    description:
      "Подписки, гайды и модули. Мгновенная выдача. Wellness и образование, не медицина.",
  },
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function Card({ p, channel }: { p: Product; channel: string | null }) {
  // Ориентируемся на СПОСОБ СПИСАНИЯ, а не на тип товара: модули формально не
  // «подписки», но списываются ежемесячно — и покупатель обязан видеть это
  // до нажатия кнопки, а не в письме от LemonSqueezy.
  const isSub = p.billing === "monthly";
  return (
    <BuyLink
      href={withChannel(p.href, channel, "shop")}
      source="shop"
      productId={p.id}
      priceUsd={p.priceUsd}
      channel={channel}
      style={styles.card}
    >
      <div style={styles.cardTop}>
        {p.badge ? <span style={styles.badge}>{p.badge}</span> : null}
        <span style={styles.format}>{p.format}</span>
      </div>

      <h3 style={styles.cardTitle}>{p.title}</h3>
      <p style={styles.cardDesc}>{p.desc}</p>

      {/* Предупреждение показывается ДО кнопки и не прячется под спойлер:
          модуль, объявляющий себя демонстрацией, не должен продаваться молча. */}
      {p.notice ? <p style={styles.notice}>{p.notice}</p> : null}

      {p.includes?.length ? (
        <ul style={styles.includes}>
          {p.includes.map((line) => (
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
          {isSub ? <span style={styles.per}>/мес</span> : null}
        </span>
        <span style={styles.buy}>{isSub ? "Подписаться" : "Купить"}&nbsp;→</span>
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

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала приезжает с /go (?c=ig и т.д.) — витрина обязана донести её до
  // чекаута, иначе переход «страница профиля → магазин → покупка» теряет источник
  // ровно там, где человек и решает платить.
  const channel = channelFrom((await searchParams).c);
  // Язык объявляется на самом блоке: в корневом макете стоит lang="en",
  // а витрина русская — замер на проде 28.08.2026 дал 2634 русских буквы
  // против 1028 латинских. Несоответствие браузер лечит машинным переводом
  // НАШЕГО текста, и переводит он в том числе названия товаров и цены.
  // Ближайший lang выигрывает у корневого; приём тот же, что у /go.
  //
  // По ИСХОДНИКУ этого не видно: латиницы в файле втрое больше (имена
  // переменных и разметка). Считать язык страницы нужно по тому, что
  // уходит человеку, а не по коду.
  return (
    <main lang="ru" style={styles.page}>
      <PageTracking page="shop" />
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · Магазин</div>
        <h1 style={styles.h1}>Всё, что можно купить в AEVION</h1>
        <p style={styles.lede}>
          Подписка на всю экосистему, гайды и книга разовой покупкой, отдельные модули помесячно.
          Оплата и мгновенная выдача — через Gumroad и LemonSqueezy.
        </p>

        <Section
          title="Подписки"
          note={`Те же модули по отдельности — ${CURRENCY.format(
            MODULES_TOTAL_USD,
          )} в месяц.`}
          items={SUBSCRIPTIONS}
          channel={channel}
        />

        <Section
          title="Гайды и книги"
          note="Разовая покупка, файл приходит сразу после оплаты."
          items={GUIDES}
          channel={channel}
        />

        <Section
          title="Модули по подписке"
          note="Отдельный продукт помесячно — если нужен один инструмент, а не вся экосистема. Списание ежемесячное, отменить можно в любой момент."
          items={MODULES}
          channel={channel}
        />

        <PaymentReachNotice style={styles.foot} />

        <p style={styles.foot}>
          Материалы о здоровье и долголетии — образовательные и wellness-материалы. Не предназначены
          для диагностики, лечения или профилактики заболеваний.
        </p>
      </div>
    </main>
  );
}

/* ── Светлый газетный стиль ─────────────────────────────────────────────────── */
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
