import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
import { PLANET_BASE_MONTHLY, termPricePerMonth } from "@/lib/termPricing";
import { PageTracking } from "@/components/PageTracking";

// AEVION Shop — единая витрина всех покупаемых товаров.
//
// Товары берутся из `@/lib/products` — единого каталога, а не из списка в этом файле.
// До 2026-07-26 здесь было 3 позиции хардкодом при 15 живых чекаутах: покупатель
// видел книгу и два гайда, а подписки и модули с рабочей оплатой на витрину не
// попадали вовсе. С 15.09.2026 на витрине: подписка на всю планету (срок 1–12
// месяцев), гайды и книги, пять приложений отдельно.
//
// Стиль — светлый газетный (память feedback_aevion_light_newspaper_ui): бумага,
// serif-заголовки, тонкие линейки, золото акцентом. Раньше страница была тёмной.

export const metadata: Metadata = {
  // 13.09.2026: absolute, потому что имя платформы уже стоит В САМОМ
  // заголовке, а корневой шаблон добавлял второе. Замер на живом сайте:
  // «... · AEVION» у 14 страниц из 14 в выборке. Вкладка и выдача поиска
  // режут около шестидесяти знаков — второй бренд выталкивал оттуда
  // нужные слова. Страницам БЕЗ имени в заголовке шаблон по-прежнему нужен,
  // поэтому корневой файл не тронут.
  title: { absolute: "Магазин AEVION — подписка, гайды, приложения" },
  description:
    "Все товары AEVION в одном месте: подписка на всю планету на срок от 1 до 12 месяцев, научные гайды о долголетии и книга разовой покупкой, пять приложений отдельно. Wellness и образование, не медицина.",
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
    title: "Магазин AEVION — подписка, гайды, приложения",
    description:
      "Подписка на всю планету на срок от 1 до 12 месяцев, научные гайды и книга разовой покупкой, пять приложений отдельно. Wellness и образование, не медицина.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Магазин AEVION",
    description:
      "Подписка на срок, гайды и приложения. Wellness и образование, не медицина.",
  },
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function Card({ p, channel }: { p: Product; channel: string | null }) {
  // Ориентируемся на СПОСОБ СПИСАНИЯ, а не на тип товара: покупатель обязан
  // видеть, что платит за срок вперёд, до нажатия кнопки, а не в письме кассы.
  //
  // Срочный доступ (подписка и пять приложений, политика 15.09.2026) ведёт на
  // страницу цен — там выбирается срок и открывается касса, и там же уходит
  // checkout_start. Поэтому здесь обычная ссылка в той же вкладке, а не BuyLink:
  // иначе одна покупка считалась бы в воронке дважды.
  const isTerm = p.billing === "term";
  const inner = (
    <>
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
          {isTerm ? <span style={styles.per}> за месяц</span> : null}
        </span>
        <span style={styles.buy}>{isTerm ? "Выбрать срок" : "Купить"}&nbsp;→</span>
      </div>
    </>
  );

  if (isTerm) {
    return (
      <a href={withChannel(p.href, channel, "shop")} style={styles.card}>
        {inner}
      </a>
    );
  }

  return (
    <BuyLink
      href={withChannel(p.href, channel, "shop")}
      source="shop"
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

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала приезжает с /go (?c=ig и т.д.) — витрина обязана донести её до
  // чекаута, иначе переход «страница профиля → магазин → покупка» теряет источник
  // ровно там, где человек и решает платить.
  const channel = channelFrom((await searchParams).c);

  // Языковая маршрутизация — третий случай проверенного приёма (образцы:
  // /longevity и /go, ветки feat/lang-aware-*, мутации у сторожей пойманы).
  // Замер EN-свипа 06.09: витрина под cookie en отдавала 73 % кириллицы —
  // худшая ДЕНЕЖНАЯ страница для en-покупателя; /en/shop заведена тем же
  // заходом (07.09). Редирект до PageTracking: просмотр считается один раз,
  // на той витрине, которую человек видит. Метка канала едет с собой.
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  if (язык === "en") {
    redirect(channel ? `/en/shop?c=${encodeURIComponent(channel)}` : "/en/shop");
  }

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
          Подписка на всю планету на срок от 1 до 12 месяцев, гайды и книги разовой покупкой,
          пять приложений отдельно. Гайды и книги оплачиваются через Gumroad с мгновенной
          выдачей; срок подписки и приложения выбирается на странице цен.
        </p>

        <Section
          title="Подписка AEVION"
          note={`Пять приложений по отдельности — ${CURRENCY.format(
            MODULES_TOTAL_USD,
          )} за месяц; вся планета — ${CURRENCY.format(
            PLANET_BASE_MONTHLY,
          )} за месяц или ${CURRENCY.format(
            termPricePerMonth(PLANET_BASE_MONTHLY, "max"),
          )} в месяц при оплате за 12 месяцев вперёд.`}
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
          title="Отдельные приложения"
          note="Пять приложений продаются и по отдельности — если нужен один инструмент, а не вся планета. Срок от 1 до 12 месяцев, оплата за срок вперёд; чем длиннее срок, тем дешевле месяц. Остальные модули входят только в подписку AEVION."
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
