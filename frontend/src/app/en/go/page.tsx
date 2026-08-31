import type { Metadata } from "next";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { LandingView } from "@/components/LandingView";
import { BuyLink } from "@/components/BuyLink";
import { PageTracking } from "@/components/PageTracking";
import { productById, channelFrom, withChannel, keepChannel, type Product } from "@/lib/products";
import { PaymentReachNotice } from "@/components/PaymentReachNotice";

// /en/go — англоязычная посадочная под ссылку в профиле.
//
// ЗАЧЕМ. Замер 28.08.2026: английский пакет из шести роликов лежит готовым с
// 05.06, но вести его было НЕКУДА. Страница /go объявлена lang="en", а внутри
// 168 русских слов против 10 английских: двадцать две строки зашиты в код мимо
// механизма переводов. Англоязычный зритель приходил бы на русскую страницу, и
// по цифрам это выглядело бы как «контент не сработал», хотя не сработал язык.
//
// Почему отдельный адрес, а не перевод /go. Тот файл правят семь веток
// одновременно (проверено aevion-claim --file), и правка двадцати двух строк в
// нём — гарантированный конфликт у всех семи. Отдельная страница не трогает
// ничего чужого. Это НЕ дубль: у неё своя, более узкая задача — один вход для
// англоязычного трафика, без разделов про запуски русских модулей.
//
// ЧЕСТНОСТЬ ОФФЕРА. На момент заведения страницы бесплатного англоязычного
// входа не существовало: русскому зрителю мы отдаём протокол долголетия целиком
// на /longevity, а английского аналога не было. Тем же заходом заведена
// /en/longevity — тот же разбор, из готового английского издания протокола, —
// и теперь бесплатное стоит на странице ПЕРВЫМ, до всякой цены, как в
// работающей русской воронке.
//
// Два английских ролика («Free book», «3 chapters free») всё равно неверны:
// бесплатен протокол, а не книга и не её главы. Они пересобраны отдельно.
export const metadata: Metadata = {
  title: "AEVION — the book behind the videos",
  description:
    "Gratitude Forever Young: a 90-day practice, four minutes a day. Plus evidence-graded protocols on pigment aging. Wellness and education, not diagnosis or treatment.",
  alternates: { canonical: "https://aevion.app/en/go" },
  openGraph: {
    title: "AEVION — the book behind the videos",
    description: "A 90-day practice, four minutes a day. Evidence-first, no promises of outcome.",
    url: "https://aevion.app/en/go",
    type: "website",
  },
};

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const LINE = "#e2e0d8";
const GOLD = "#a9781a";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Цена берётся из каталога: вторая копия числа в вёрстке разошлась бы молча. */
function price(p: Product): string {
  return CURRENCY.format(p.priceUsd) + (p.billing === "monthly" ? " / mo" : "");
}

function Offer({
  p,
  channel,
  title,
  note,
  cta,
  format,
}: {
  p: Product | undefined;
  channel: string | null;
  title: string;
  note: string;
  cta: string;
  /**
   * Формат подписью, по-английски. Поле `format` каталога русское
   * («PDF + EPUB + аудио», «подписка · цена / мес») — на английской странице оно
   * даёт четыре русских вкрапления. Цену и ссылку по-прежнему берём из каталога:
   * дублируется только надпись, а не число.
   */
  format: string;
}) {
  if (!p) return null;
  return (
    <BuyLink
      href={withChannel(p.href, channel, "en-go")}
      source="en-go"
      productId={p.id}
      priceUsd={p.priceUsd}
      channel={channel}
      style={styles.card}
    >
      <div style={styles.cardKicker}>{format}</div>
      <div style={styles.cardTitle}>{title}</div>
      <p style={styles.cardNote}>{note}</p>
      <div style={styles.cardFoot}>
        <span style={styles.cardPrice}>{price(p)}</span>
        <span style={styles.cardBtn}>{cta}</span>
      </div>
    </BuyLink>
  );
}

export default async function EnGoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала обязана доехать до кассы: без неё покупка приходит в отчёт
  // как «источник неизвестен», и после всех роликов нельзя сказать, сработали
  // ли они.
  // Метка канала обязана доехать и до кассы, и до внутренних переходов: без неё
  // покупка приходит в отчёт как «источник неизвестен», и после всех роликов
  // нельзя сказать, сработали ли они. keepChannel — общий механизм каталога,
  // он же не даёт подставить нормализованное значение вместо короткого ключа.
  const channel = channelFrom((await searchParams).c);
  const book = productById("orcfbo");
  const bookAudio = productById("lelzw");
  const bundle = productById("ghvzq");
  const antiGrey = productById("kkiavh");
  const allAccess = productById("xpxzam");

  return (
    <main style={styles.page}>
      <PageTracking page="en-go" />
      {/* source обязателен: по нему просмотр посадочной отличается от других
          страниц в отчёте, иначе английский трафик сольётся с русским. */}
      <LandingView source="en-go" />
      <div style={styles.wrap}>
        <header style={styles.head}>
          <div style={styles.brand}>AEVION</div>
          <h1 style={styles.h1}>The book behind the videos</h1>
          <p style={styles.lede}>
            Ninety days, four minutes a day. What you repeat to yourself shapes
            attention — and the book walks through the mechanism, not the magic.
          </p>
        </header>

        {/* Бесплатное — ПЕРВЫМ, до всякой цены. Так устроена работающая русская
            воронка: человек получает обещанное роликом, убеждается, что разбор
            настоящий, и только потом видит платное. На 28.08.2026 английского
            бесплатного входа не существовало вовсе — /en/longevity заведена
            тем же заходом. */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Free, and the whole thing</h2>
          <a href={keepChannel("/en/longevity", channel)} style={styles.card}>
            <div style={styles.cardKicker}>free · no email required</div>
            <div style={styles.cardTitle}>The Longevity Protocol</div>
            <p style={styles.cardNote}>
              What to measure, which interventions are actually evidenced
              (graded A/B/C) and which popular ones are not. Twelve weeks,
              measure and measure again.
            </p>
            <div style={styles.cardFoot}>
              <span style={styles.cardPrice}>$0</span>
              <span style={styles.cardBtn}>Read it</span>
            </div>
          </a>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Start here</h2>
          <Offer
            p={book}
            channel={channel}
            title="Gratitude Forever Young"
            format="PDF + EPUB"
            note="The full text. The lowest way in — the same material the videos are built from."
            cta="Get it"
          />
          <Offer
            p={bookAudio}
            channel={channel}
            title="Book and audiobook"
            format="PDF + EPUB + audio"
            note="Read it or listen on the move. Same practice, both formats."
            cta="Get it"
          />
          <Offer
            p={bundle}
            channel={channel}
            title="Everything in one pack"
            format="PDF + EPUB + audio + workbook"
            note="Book, audiobook and the 90-day workbook together."
            cta="Get it"
          />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Also in English</h2>
          <Offer
            p={antiGrey}
            channel={channel}
            title="The Anti-Grey Protocol"
            format="PDF guide"
            note="What is actually shown to slow pigment aging — graded by evidence, including what is overrated."
            cta="Read it"
          />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>The whole platform</h2>
          <Offer
            p={allAccess}
            channel={channel}
            title="AEVION All-Access"
            format="subscription"
            note="Every module on one subscription instead of buying them one by one."
            cta="Open"
          />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Told when the next one lands</h2>
          <p style={styles.lede}>
            Modules ship one at a time. Leave an address and you get a note on
            launch day — nothing else.
          </p>
          {/* source="en-go": по нему видно, что подписчик пришёл с английской
              посадочной, и письмо можно писать на его языке. */}
          <div style={{ marginTop: 12 }}>
            <WaitlistCapture
              // Та же светлая страница, что и русская /go — см. пояснение там.
              tone="light"
              source="en-go"
              lang="en"
              title="Told when the next module lands"
              description="AEVION ships modules one at a time. Leave an address and you get a note on launch day, with early-access terms."
              promise="One email per launch. Unsubscribe with a single link in every message."
              buttonLabel="Keep me posted"
            />
          </div>
        </section>

        {/* Payment-reach notice. Silent unless there is something to warn
            about: it asks checkout/healthz and renders only when tenge payment
            is unavailable. lang="en" — the copy must match the page, otherwise
            we introduce the very language mismatch we fix elsewhere. */}
        <PaymentReachNotice style={styles.foot} lang="en" />

        <p style={styles.foot}>
          Wellness and education. Not diagnosis, not treatment, and no promises
          of outcome.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Узкая колонка: страницу открывают с телефона, сразу после ролика.
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "32px 18px 56px" },
  wrap: { maxWidth: 520, margin: "0 auto" },
  head: { borderBottom: `2px solid ${INK}`, paddingBottom: 18 },
  brand: { fontFamily: "monospace", fontSize: 13, letterSpacing: "0.3em", fontWeight: 700, color: GOLD },
  h1: {
    fontFamily: "Georgia, serif",
    fontSize: 30,
    lineHeight: 1.15,
    margin: "12px 0 0",
    fontWeight: 700,
  },
  lede: { color: MUTED, fontSize: 15, lineHeight: 1.6, margin: "10px 0 0" },
  section: { marginTop: 30 },
  h2: {
    fontFamily: "Georgia, serif",
    fontSize: 19,
    margin: "0 0 12px",
    fontWeight: 700,
  },
  card: {
    display: "block",
    border: `1px solid ${LINE}`,
    borderRadius: 12,
    padding: "16px 18px",
    marginBottom: 12,
    background: "#fff",
    textDecoration: "none",
    color: INK,
  },
  cardKicker: { fontFamily: "monospace", fontSize: 11.5, letterSpacing: "0.08em", color: GOLD },
  cardTitle: { fontSize: 18, fontWeight: 700, margin: "6px 0 0" },
  cardNote: { color: MUTED, fontSize: 14, lineHeight: 1.55, margin: "6px 0 0" },
  cardFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 },
  cardPrice: { fontSize: 20, fontWeight: 700 },
  cardBtn: {
    border: `1px solid ${INK}`,
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  foot: { marginTop: 32, color: MUTED, fontSize: 13, lineHeight: 1.6 },
};
