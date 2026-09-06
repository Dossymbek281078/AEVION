import type { Metadata } from "next";
import { LandingView } from "@/components/LandingView";
import { BuyLink } from "@/components/BuyLink";
import { PageTracking } from "@/components/PageTracking";
import { productById, channelFrom, withChannel, keepChannel } from "@/lib/products";
import { PaymentReachNotice } from "@/components/PaymentReachNotice";

// /en/devhub — англоязычная посадочная DevHub под западные каналы
// (Show HN, Product Hunt, EN-письма).
//
// ЗАЧЕМ. Замер 06.09.2026: у DevHub не было английского входа вовсе —
// /devhub отдаёт 86 % кириллицы с русским атрибутом языка (намеренно НЕ
// пишу здесь сам атрибут в кавычках: сторож declaredLangRuPages отбирает
// «русские» страницы по этому литералу В ИСХОДНИКЕ и посчитал бы эту
// английскую страницу русской — поймано его красным 06.09), /en/devhub
// отвечал 404, ?lang=en игнорируется (переключатель живёт в localStorage).
// Посетитель с Show HN попадал бы на русскую страницу и уходил. Разбор:
// Desktop\АЕВИОН\17-Корпоративные-продажи\2026-09-06-ЗАПАД-каналы-и-черновики.md.
//
// Почему отдельная страница, а не перевод /devhub: тот же довод, что у
// /en/go — приложение правят другие ветки, перевод интерфейса целиком —
// работа окна DevHub; посадочная не трогает ничего чужого и решает свою
// узкую задачу: один английский вход с меткой канала.
//
// ЧЕСТНОСТЬ ОФФЕРА: цена берётся из каталога (вторая копия числа разошлась
// бы молча); бесплатная проба — настоящая (потолок генераций на бесплатном
// проверен на проде 06.09: 30). Про язык интерфейса приложения сказано
// прямо — оно открывается по-русски, английский включается переключателем.

export const metadata: Metadata = {
  title: "AEVION DevHub — describe an app, get a deployed project",
  description:
    "Describe what you want in plain words: DevHub generates the project, shows a live preview, deploys it, and logs what every AI run cost. Try free, no account needed.",
  alternates: { canonical: "https://aevion.app/en/devhub" },
  openGraph: {
    title: "AEVION DevHub — describe an app, get a deployed project",
    description:
      "Generate → preview → deploy → per-run AI cost ledger, in one place. Guest mode included.",
    url: "https://aevion.app/en/devhub",
    type: "website",
  },
};

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const LINE = "#e2e0d8";
const GOLD = "#a9781a";

export default async function EnDevhubPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала обязана доехать и до кассы, и до внутренних переходов —
  // иначе западный трафик придёт в отчёт как «источник неизвестен».
  const channel = channelFrom((await searchParams).c);
  const devhub = productById("devhub");

  return (
    <main style={styles.page}>
      <PageTracking page="en-devhub" />
      <LandingView source="en-devhub" />
      <div style={styles.wrap}>
        <header style={styles.head}>
          <div style={styles.brand}>AEVION</div>
          <h1 style={styles.h1}>Describe it. Get a deployed project.</h1>
          <p style={styles.lede}>
            DevHub turns a plain-words description into a working project:
            generation, live preview, deployment and a per-run ledger of what
            every AI call cost you — one loop, one place.
          </p>
        </header>

        {/* Бесплатное — ПЕРВЫМ, до всякой цены: так устроена работающая
            воронка. Гостевой режим настоящий — без аккаунта, работа
            переносится при регистрации. */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Try it free, right now</h2>
          <a href={keepChannel("/devhub", channel)} style={styles.card}>
            <div style={styles.cardKicker}>free · no account required</div>
            <div style={styles.cardTitle}>Open DevHub</div>
            <p style={styles.cardNote}>
              Guest mode with a real generation allowance. Your work transfers
              to your account when you sign up. The app opens in Russian —
              switch to English with the language toggle in the header.
            </p>
            <div style={styles.cardFoot}>
              <span style={styles.cardPrice}>$0</span>
              <span style={styles.cardBtn}>Open it</span>
            </div>
          </a>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>The full studio</h2>
          {devhub ? (
            <BuyLink
              href={withChannel(devhub.href, channel, "en-devhub")}
              source="en-devhub"
              productId={devhub.id}
              priceUsd={devhub.priceUsd}
              channel={channel}
              style={styles.card}
            >
              <div style={styles.cardKicker}>subscription · monthly</div>
              <div style={styles.cardTitle}>DevHub Studio Pro</div>
              <p style={styles.cardNote}>
                Browser IDE on the VS Code engine, AI code generation, one-click
                deploys, and the cost ledger — you always see what a run cost.
              </p>
              <div style={styles.cardFoot}>
                <span style={styles.cardPrice}>${devhub.priceUsd} / mo</span>
                <span style={styles.cardBtn}>Get access</span>
              </div>
            </BuyLink>
          ) : null}
          {/* Сторож everySellingPageWarnsAboutPayment: со страницы платят —
              страница обязана сказать о недоступных способах оплаты ДО
              кассы. lang="en" — текст обязан совпадать с языком страницы
              (образец — en/go). Вставлено при сборке 06.09. */}
          <PaymentReachNotice style={styles.note} lang="en" />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Why trust the numbers</h2>
          <p style={styles.note}>
            Every metric we publish is a live API response, not a slide: the
            platform registry, uptime and revenue are all queryable. DevHub is
            built the way it sells — this 41-module platform is developed by a
            founder working with AI agents in DevHub-style loops.
          </p>
        </section>

        <footer style={styles.foot}>
          <a href={keepChannel("/en/go", channel)} style={styles.footLink}>
            AEVION home (EN)
          </a>
          <span style={styles.footDot}>·</span>
          <a href={keepChannel("/pricing", channel)} style={styles.footLink}>
            All plans
          </a>
        </footer>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { background: PAPER, color: INK, minHeight: "100vh", padding: "0 0 60px" },
  wrap: { maxWidth: 720, margin: "0 auto", padding: "0 20px" },
  head: { padding: "56px 0 8px" },
  brand: { fontSize: 13, letterSpacing: 3, color: GOLD, fontWeight: 700 },
  h1: { fontSize: 38, lineHeight: 1.15, margin: "10px 0 12px", fontFamily: "Georgia, serif" },
  lede: { fontSize: 18, lineHeight: 1.55, color: MUTED, margin: 0 },
  section: { marginTop: 34 },
  h2: { fontSize: 22, fontFamily: "Georgia, serif", margin: "0 0 12px" },
  card: {
    display: "block",
    border: `1px solid ${LINE}`,
    borderRadius: 10,
    padding: "16px 18px",
    background: "#fff",
    color: INK,
    textDecoration: "none",
    marginBottom: 12,
  },
  cardKicker: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: MUTED },
  cardTitle: { fontSize: 20, fontWeight: 700, margin: "6px 0 4px" },
  cardNote: { fontSize: 15, lineHeight: 1.5, color: MUTED, margin: "0 0 12px" },
  cardFoot: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardPrice: { fontSize: 18, fontWeight: 700 },
  cardBtn: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    background: INK,
    borderRadius: 8,
    padding: "8px 14px",
  },
  note: { fontSize: 15, lineHeight: 1.6, color: MUTED, margin: 0 },
  foot: { marginTop: 44, paddingTop: 16, borderTop: `1px solid ${LINE}`, fontSize: 14 },
  footLink: { color: MUTED, textDecoration: "none" },
  footDot: { margin: "0 8px", color: MUTED },
};
