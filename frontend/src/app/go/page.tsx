import type { Metadata } from "next";
import {
  GUIDES,
  SUBSCRIPTIONS,
  productById,
  channelFrom,
  withChannel,
  type Product,
} from "@/lib/products";

// /go — страница-хаб под ссылку в профиле соцсетей.
//
// ЗАЧЕМ. В Instagram, TikTok и Threads ссылка в подписи не кликается — работает
// только одна ссылка в шапке профиля. На 26.07.2026 поле «Сайт» в профиле пустое,
// то есть каждый залитый ролик ведёт в никуда: человек посмотрел, захотел — и
// упёрся. Это дешевле любой рекламы и блокирует весь трек раздачи.
//
// Отсюда требования, отличающие эту страницу от /shop:
//   - открывают её С ТЕЛЕФОНА, сразу после видео → одна колонка, крупные цели
//     нажатия, никакого горизонтального скролла;
//   - у человека 3–5 секунд внимания → сверху то, ради чего он пришёл, а не
//     рассказ о платформе;
//   - разные ролики ведут к разным продуктам → блоки сгруппированы по теме
//     ролика (здоровье / книга), а не по типу товара.
//
// Цены и ссылки берутся из общего каталога @/lib/products — того же, от которого
// работают /shop и /apps. Хардкодить их здесь нельзя: именно так на 26.07 в
// репозитории оказалось четыре расходящихся списка товаров.

export const metadata: Metadata = {
  title: "AEVION — что почитать и попробовать",
  description:
    "Научные протоколы о долголетии и седине, книга о благодарности, живые инструменты AEVION. Всё в одном месте.",
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Ссылка-карточка. Вся площадь — цель нажатия, это важно для пальца. */
function LinkCard({
  href,
  kicker,
  title,
  note,
  price,
  external,
}: {
  href: string;
  kicker: string;
  title: string;
  note?: string;
  price?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={styles.card}
    >
      <div style={styles.cardKicker}>{kicker}</div>
      <div style={styles.cardTitle}>{title}</div>
      {note ? <div style={styles.cardNote}>{note}</div> : null}
      <div style={styles.cardFoot}>
        {price ? <span style={styles.price}>{price}</span> : <span />}
        <span style={styles.arrow}>→</span>
      </div>
    </a>
  );
}

function priceOf(p: Product | undefined): string | undefined {
  if (!p) return undefined;
  return CURRENCY.format(p.priceUsd) + (p.billing === "monthly" ? " / мес" : "");
}

export default async function GoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала из адреса: /go?c=ig в шапке Instagram, ?c=tt в TikTok и т.д.
  // Она доезжает до чекаута и возвращается в вебхуке рядом с продажей — иначе
  // «какой канал принёс деньги» остаётся без ответа.
  const rawChannel = (await searchParams).c;
  const channel = channelFrom(rawChannel);
  // Внутренние переходы тоже несут метку: человек с /go часто уходит сначала в
  // /shop или /longevity и покупает уже оттуда. Без проброса канал терялся бы
  // ровно на том переходе, ради которого страница и сделана.
  const keep = (path: string) => (channel ? `${path}?c=${encodeURIComponent(String(Array.isArray(rawChannel) ? rawChannel[0] : rawChannel))}` : path);
  const protocol = productById("oijxmq");
  const antiGreyRu = productById("tmuyxw");
  const bookFull = productById("ghvzq");
  const allAccess = SUBSCRIPTIONS.find((s) => s.id === "xpxzam");

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <header style={styles.head}>
          <div style={styles.brand}>AEVION</div>
          <h1 style={styles.h1}>Что почитать и попробовать</h1>
          <p style={styles.lede}>
            Разбираем долголетие и привычки честно: с оценкой доказательности у каждого пункта —
            включая то, что переоценено.
          </p>
        </header>

        <section style={styles.section}>
          <h2 style={styles.h2}>Здоровье и долголетие</h2>
          <LinkCard
            href={keep("/longevity")}
            kicker="Бесплатно · инструмент"
            title="Протокол долголетия"
            note="Отметьте свои анализы — получите персональный 12-недельный стек и повторный замер."
          />
          {protocol && (
            <LinkCard
              href={withChannel(protocol.href, channel)}
              external
              kicker={protocol.format}
              title="Тот же протокол в PDF"
              note="Чтобы заполнять на нулевой и двенадцатой неделе, не открывая сайт."
              price={priceOf(protocol)}
            />
          )}
          {antiGreyRu && (
            <LinkCard
              href={withChannel(antiGreyRu.href, channel)}
              external
              kicker={antiGreyRu.format}
              title="Протокол «Анти-седина»"
              note="Почему волос седеет и что реально это замедляет. Медь, цинк, спермидин."
              price={priceOf(antiGreyRu)}
            />
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Книга</h2>
          {bookFull && (
            <LinkCard
              href={withChannel(bookFull.href, channel)}
              external
              kicker={bookFull.format}
              title="Благодарность ∞ Вечная Молодость"
              note="90 дней по четыре минуты. Книга, аудиокнига и материалы одним пакетом."
              price={priceOf(bookFull)}
            />
          )}
          <div style={styles.aside}>
            Есть версии дешевле — только текст или текст с аудио:{" "}
            <a href={keep("/shop")} style={styles.link}>
              в магазине
            </a>
            .
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Вся платформа</h2>
          <LinkCard
            href={keep("/explore")}
            kicker="Бесплатно · обзор"
            title="29 живых модулей AEVION"
            note="Шахматы с ИИ-коучем, сметный тренажёр, венчурный аналитик, IP-бюро и другие."
          />
          {allAccess && (
            <LinkCard
              href={withChannel(allAccess.href, channel)}
              external
              kicker={allAccess.format}
              title="Доступ ко всему сразу"
              note="Вместо покупки модулей поштучно."
              price={priceOf(allAccess)}
            />
          )}
        </section>

        <p style={styles.foot}>
          Материалы о здоровье — образовательные, не медицина. Не предназначены для диагностики,
          лечения или профилактики заболеваний.
        </p>
      </div>
    </main>
  );
}

/* ── Светлый газетный стиль, но собранный под телефон ─────────────────────── */
const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const RULE = "#ddd9cf";
const GOLD = "#a9781a";

const styles: Record<string, React.CSSProperties> = {
  // Узкая колонка сознательно: страницу открывают с телефона, а на десктопе
  // растянутый на всю ширину список ссылок читается хуже, чем колонка.
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "32px 18px 56px" },
  wrap: { maxWidth: 520, margin: "0 auto" },

  head: { borderBottom: `2px solid ${INK}`, paddingBottom: 18 },
  brand: {
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: "0.3em",
    fontWeight: 700,
    color: GOLD,
  },
  h1: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 30,
    lineHeight: 1.15,
    margin: "12px 0 0",
    fontWeight: 700,
  },
  lede: { color: MUTED, fontSize: 15, lineHeight: 1.6, margin: "10px 0 0" },

  section: { marginTop: 30 },
  h2: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 19,
    margin: "0 0 12px",
    fontWeight: 700,
  },

  card: {
    display: "block",
    background: "#fffdf8",
    border: `1px solid ${RULE}`,
    borderRadius: 4,
    // Крупные поля — палец, а не курсор.
    padding: "16px 18px",
    marginBottom: 12,
    textDecoration: "none",
    color: INK,
  },
  cardKicker: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: MUTED,
  },
  cardTitle: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.3,
    margin: "6px 0 0",
  },
  cardNote: { color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: "6px 0 0" },
  cardFoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  price: { fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700 },
  arrow: { color: GOLD, fontSize: 20, fontWeight: 700 },

  aside: { color: MUTED, fontSize: 13.5, lineHeight: 1.6, marginTop: 4 },
  link: { color: GOLD },

  foot: {
    marginTop: 32,
    fontSize: 12,
    color: MUTED,
    borderTop: `1px solid ${RULE}`,
    paddingTop: 14,
    lineHeight: 1.55,
  },
};
