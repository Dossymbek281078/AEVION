import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { PaymentReachNotice } from "@/components/PaymentReachNotice";
import { LandingView } from "@/components/LandingView";
import {
  GUIDES,
  SUBSCRIPTIONS,
  productById,
  channelFrom,
  withChannel,
  type Product,
} from "@/lib/products";
import { BuyLink } from "@/components/BuyLink";
import { PageTracking } from "@/components/PageTracking";
// Счётчик живых модулей — из pitchFacts, заперт на реестр сторожем.
// До 10.08.2026 здесь стояло «29 живых модулей», пока реестр отдавал 36:
// страница-хаб для ссылки в профиле занижала платформу на семь модулей
// перед всем трафиком из соцсетей.
import { LIVE_MODULES } from "@/data/pitchFacts";

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
  // СВОЙ canonical, и для этой страницы он важнее, чем для большинства.
  // На неё ведут ссылки с меткой канала: ?c=tt, ?c=ig, ?c=dz и ещё семь.
  // Без canonical поисковик вправе счесть каждый вариант отдельной
  // страницей — вес входа воронки размазывается по десяти адресам.
  // Проверено на живом сайте 30.08.2026: canonical не отдавался вовсе
  // (контроль: /pricing свой отдаёт, значит проба различает).
  alternates: { canonical: "/go" },
  // Своя карточка предпросмотра. Без неё ссылка, посланная в мессенджер или
  // соцсеть, приходит с общим заголовком сайта — а на эту страницу ведут ВСЕ
  // ролики, то есть именно её и пересылают. Замер 30.08.2026: в долгу по
  // предпросмотру числилось 15 страниц, настоящих из них было две — эта и
  // магазин; у остальных заголовок лежал в layout.tsx.
  openGraph: {
    title: "AEVION — что почитать и попробовать",
    description:
      "Протоколы о долголетии и седине, книга о благодарности, живые инструменты. Начните с любого.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — что почитать и попробовать",
    description:
      "Протоколы о долголетии и седине, книга о благодарности, живые инструменты.",
  },
};


/**
 * Сколько модулей у платформы — из реестра, а не из головы.
 *
 * В первой версии страницы здесь стояло «29 живых модулей». Реестр на тот же
 * день отвечал 36 live из 41 — то есть страница, на которую мы ведём платный
 * трафик, занижала собственный масштаб на семь модулей. Ровно тот случай, ради
 * которого числа на публичных страницах берутся из живого источника: захардкоженное
 * число не устаревает заметно, оно просто тихо врёт.
 *
 * `null` при недоступном API — тогда заголовок обходится без числа: «модули
 * AEVION» честнее, чем цифра, которую не удалось подтвердить.
 */
async function fetchLiveModules(): Promise<number | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/aevion/registry-stats`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { byStatus?: { live?: number; launched?: number } };
    const live = (j.byStatus?.live ?? 0) + (j.byStatus?.launched ?? 0);
    return live > 0 ? live : null;
  } catch {
    return null;
  }
}

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
  product,
  channel,
}: {
  href: string;
  kicker: string;
  title: string;
  note?: string;
  price?: string;
  external?: boolean;
  /** Позиция каталога — только у внешних (платных) карточек. */
  product?: Product;
  channel?: string | null;
}) {
  // Внешняя ссылка на этой странице всегда ведёт в оплату, поэтому идёт через
  // BuyLink — иначе покупка с /go не попадёт в воронку. Внутренние переходы
  // остаются обычным якорем: там покупки ещё нет.
  const inner = (
    <>
      <div style={styles.cardKicker}>{kicker}</div>
      <div style={styles.cardTitle}>{title}</div>
      {note ? <div style={styles.cardNote}>{note}</div> : null}
      <div style={styles.cardFoot}>
        {price ? <span style={styles.price}>{price}</span> : <span />}
        <span style={styles.arrow}>→</span>
      </div>
    </>
  );

  if (external) {
    return (
      <BuyLink
        href={href}
        source="go"
        productId={product?.id}
        priceUsd={product?.priceUsd}
        channel={channel}
        style={styles.card}
      >
        {inner}
      </BuyLink>
    );
  }

  return (
    <a href={href} style={styles.card}>
      {inner}
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
  const liveModules = await fetchLiveModules();
  const rawChannel = (await searchParams).c;
  const channel = channelFrom(rawChannel);
  // Внутренние переходы тоже несут метку: человек с /go часто уходит сначала в
  // /shop или /longevity и покупает уже оттуда. Без проброса канал терялся бы
  // ровно на том переходе, ради которого страница и сделана.
  const keep = (path: string) => (channel ? `${path}?c=${encodeURIComponent(String(Array.isArray(rawChannel) ? rawChannel[0] : rawChannel))}` : path);
  // Метка источника несёт канал, как на посадочных модулей. До 19.08.2026 здесь
  // стояло жёсткое "go": подписка с /go?c=ig помечалась просто «go», и канал
  // терялся ровно на той странице, ради которой метки и заводились.
  const goSource = channel ? `go-${channel}` : "go";

  const protocol = productById("oijxmq");
  const antiGreyRu = productById("tmuyxw");
  const bookFull = productById("ghvzq");
  const allAccess = SUBSCRIPTIONS.find((s) => s.id === "xpxzam");

  // Язык объявляется на самом блоке: в корневом макете стоит lang="en"
  // (большая часть сайта английская), а эта страница русская — и
  // несоответствие браузер лечит машинным переводом НАШЕГО текста.
  // Ближайший lang выигрывает у корневого, поэтому общий шаблон трогать
  // не нужно. Приём взят у cyberchess/launch, чтобы способ был один.
  // Главная посадочная для трафика с роликов: адрес /go стоит в шапках
  // соцсетей, и первый визит почти всегда приходит сюда.
  return (
    <main lang="ru" style={styles.page}>
      {/* Без этого нельзя ответить даже на «приходил ли кто-нибудь» — см. components/PageTracking */}
      <PageTracking page="go" />
      <div style={styles.wrap}>
        <header style={styles.head}>
          <div style={styles.brand}>AEVION</div>
          <h1 style={styles.h1}>Что почитать и попробовать</h1>
          <p style={styles.lede}>
            Разбираем долголетие и привычки честно: с оценкой доказательности у каждого пункта —
            включая то, что переоценено.
          </p>
          {/* Короткая ссылка на бесплатный протокол — прямо в шапке.
              Порядок секций ниже задан замером 21.08 под шахматный трафик и
              НЕ меняется: человек с ролика о шахматах должен видеть их без
              прокрутки. Но шестнадцать готовых роликов ведут сюда за
              ПРОТОКОЛОМ, а он идёт четвёртым разделом — после запуска и формы.
              Строка решает это, не трогая порядок: пришедший за протоколом
              попадает на него в один тап, остальные её просто минуют. */}
          <p style={styles.headLink}>
            Пришли за протоколом долголетия?{" "}
            {/* keep() обязателен: без него метка канала теряется ровно на том
                переходе, ради которого строка и добавлена, и покупка с
                /longevity придёт в отчёт как «источник неизвестен». */}
            <a href={keep("/longevity")} style={styles.link}>
              Он открыт целиком и бесплатно →
            </a>
          </p>
        </header>

        {/* Запуск и форма — СРАЗУ после шапки, а не в конце страницы.
            Замер 21.08.2026 на телефоне 390x844: поле адреса лежало на
            y=2067, то есть в 2.4 экранах прокрутки, а раздел про здоровье
            шёл перед ближайшим запуском. /go — единственная кликабельная
            ссылка в шапках соцсетей: человек приходит по ролику о шахматах
            и должен видеть их и поле для адреса без прокрутки. */}
        {/* Ближайший запуск — отдельной секцией перед общим обзором.
            Замер 19.08.2026: на /go шахматы упоминались одной строкой внутри
            описания «живых модулей», без своей карточки и без ссылки на
            посадочную. Человек, пришедший по ролику о шахматах, их здесь не
            находил — а /go единственная кликабельная ссылка в шапках соцсетей.
            Дата и содержание совпадают с посадочной, чтобы обещание было одно. */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Ближайший запуск</h2>
          <LinkCard
            href={keep("/apps")}
            kicker="10 сентября · семь модулей"
            title="DevHub, мультичат, QRight, QSign, бюро, биржа — открываем 10 сентября"
            note="Партия с движком, задача дня и тренер, который объясняет ход. Оставьте адрес — напишем в день запуска."
          />
        </section>
        <section style={styles.section}>
          <LandingView source={goSource} />
          <WaitlistCapture
            // Язык задан ЯВНО: страница объявлена lang="ru" на <main>.
            // Без этого форма пошла бы за языком посетителя и на русской
            // странице показала бы английские подписи.
            lang="ru"
            // Страница светлая (#fffdf8), а умолчание темы у компонента — тёмное:
            // форма отрисовывалась чёрным градиентом на кремовом фоне. Все четыре
            // страницы запуска передают light явно; здесь это просто не задали.
            tone="light"
            source={goSource}
            title="Написать вам, когда выйдет следующее"
            description="Модули выходят по одному. Оставьте адрес — придёт письмо в день запуска и условия раннего доступа, пока цена стартовая."
          />
        </section>

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
              href={withChannel(protocol.href, channel, "go")}
              external
              product={protocol}
              channel={channel}
              kicker={protocol.format}
              title="Тот же протокол в PDF"
              note="Чтобы заполнять на нулевой и двенадцатой неделе, не открывая сайт."
              price={priceOf(protocol)}
            />
          )}
          {antiGreyRu && (
            <LinkCard
              href={withChannel(antiGreyRu.href, channel, "go")}
              external
              product={antiGreyRu}
              channel={channel}
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
              href={withChannel(bookFull.href, channel, "go")}
              external
              product={bookFull}
              channel={channel}
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
            // Живое число из реестра, а при отказе запроса — LIVE_MODULES из
            // pitchFacts (заперт сторожем на тот же реестр). Прежние варианты
            // были хуже каждый по-своему: без запасного число ИСЧЕЗАЛО с
            // посадочной страницы, а без живого — застывало на дате сборки.
            title={`${liveModules ?? LIVE_MODULES} живых модулей AEVION`}
            note="Шахматы с ИИ-коучем, сметный тренажёр, венчурный аналитик, IP-бюро и другие."
          />
          {allAccess && (
            <LinkCard
              href={withChannel(allAccess.href, channel, "go")}
              external
              product={allAccess}
              channel={channel}
              kicker={allAccess.format}
              title="Доступ ко всему сразу"
              note="Вместо покупки модулей поштучно."
              price={priceOf(allAccess)}
            />
          )}
        </section>


        {/* Предупреждение о способах оплаты. Молчит, когда предупреждать
            не о чем: компонент спрашивает checkout/healthz и рисует что-либо
            только при недоступной оплате в тенге. Эта страница — единственная
            ссылка в шапках соцсетей, то есть первый экран для человека из
            рекламы; узнать, что заплатить нечем, он должен ДО кассы. */}
        <PaymentReachNotice style={styles.foot} />

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
  headLink: { color: MUTED, fontSize: 14.5, lineHeight: 1.6, margin: "12px 0 0" },

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
