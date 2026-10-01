import type { Metadata } from "next";
import { BuyLink } from "@/components/BuyLink";
import { PageTracking } from "@/components/PageTracking";
import { productById, channelFrom, channelFromRef, withChannel, keepChannel } from "@/lib/products";
import { fromPricePerMonth } from "@/lib/termPricing";
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
  searchParams: Promise<{ c?: string | string[]; ref?: string | string[] }>;
}) {
  // Метка канала обязана доехать и до кассы, и до внутренних переходов —
  // иначе западный трафик придёт в отчёт как «источник неизвестен».
  // Карточка Product Hunt ведёт сюда с ?ref=producthunt — параметр ставит сама
  // площадка. Без этой строки день запуска на PH считался бы прямыми заходами.
  const параметры = await searchParams;
  const channel = channelFrom(параметры.c) ?? channelFromRef(параметры.ref);
  const devhub = productById("devhub");

  return (
    <main style={styles.page}>
      <PageTracking page="en-devhub" />
      <div style={styles.wrap}>
        <header style={styles.head}>
          <div style={styles.brand}>AEVION</div>
          <h1 style={styles.h1}>Describe it. Get a deployed project.</h1>
          <p style={styles.lede}>
            DevHub turns a plain-words description into a working project:
            generation, live preview, deployment and a per-run ledger of what
            every AI call cost you — one loop, one place.
          </p>

          {/*
            ЦЕНА В ПЕРВОМ ЭКРАНЕ (01.10.2026).
            Повод денежный: с Product Hunt и LaunchNest пришло 16 сессий на
            /en/devhub и /devhub, до страницы цен не дошёл НИ ОДИН. Ссылки на
            /pricing были, но ниже сгиба — человек их не видел.

            Бесплатный вход ниже остаётся первым по весу: так устроена воронка,
            и менять это не требовалось. Здесь — только факт цены и прямой путь
            в кассу, одной строкой.

            Числа НЕ вписаны руками: $200 это devhub.priceUsd (из STANDALONE_APPS),
            $100 — fromPricePerMonth от той же базы, то есть цена за 12 месяцев.
            Оба конца сверяются с бэкендом тестом termPricingMatchesBackend —
            иначе страница обещала бы цену, которой касса не знает.
          */}
          {devhub ? (
            <p data-devhub-price="1" style={styles.heroPrice}>
              Full studio{" "}
              <strong>from ${fromPricePerMonth(devhub.priceUsd)}/mo</strong>{" "}
              on the 12-month term, ${devhub.priceUsd}/mo billed monthly.{" "}
              <a href={withChannel(devhub.href, channel)} style={styles.heroPriceLink}>
                See plans and buy →
              </a>
            </p>
          ) : null}
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
              to your account when you sign up. The interface follows your
              browser language — English out of the box, with a switcher in
              the header for Russian and Kazakh.
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

        {/*
          Провенанс генераций. Добавлен 08.09.2026 сверкой ЧЕРНОВИКА
          ОБЪЯВЛЕНИЯ с этой страницей: текст Show HN обещает «provenance
          stamps … only its sha256 is stored», а страница о них молчала —
          человек пришёл бы по ссылке за тем, чего здесь нет. Русская
          /devhub про них рассказывает, английская была вчетверо короче.

          Формулировки сверены с реализацией (lib/devhubProvenance.ts), а не
          с объявлением: отметка ставится ПО ЗАПРОСУ на генерацию, а не
          автоматически (флаг provenance: true, v1 без миграции схемы), и
          только для настоящих ИИ-генераций — у заглушки отметки не будет.
          Обещать «automatic» здесь значило бы повторить ошибку объявления.
        */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Provenance for AI generations</h2>
          <p style={styles.note}>
            Ask for it on a generation and DevHub records where the result came
            from: which model produced it, when, and a hash of the files — a
            verifiable page you can link to. Your prompt never leaves the
            system; only its SHA-256 is stored. Built for the EU AI Act era,
            where &laquo;an AI made this&raquo; has to be provable rather than
            claimed.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Why trust the numbers</h2>
          <p style={styles.note}>
            Every metric we publish is a live API response, not a slide: the
            platform registry, uptime and revenue are all queryable. DevHub is
            built the way it sells — this platform, 40+ modules and counting, is
            developed by a founder working with AI agents in DevHub-style loops.
            The exact count comes from the live registry, not from this page.
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

          {/*
            Значок LaunchNest — условие их бесплатного размещения.
            Заявка подана 30.09.2026, листинг создан и ждёт проверки:
            launchnest.io/p/aevion-devhub, статус «Pending — verify to publish».
            Пока картинки нет на ЭТОЙ странице, размещение не публикуется.

            Что они проверяют (с их же страницы badges): картинка есть на
            странице по указанному адресу, обёрнута ссылкой на листинг, и у
            ссылки НЕТ rel="nofollow" / "sponsored" / "ugc" — любой из них
            отменяет обратную ссылку. Поэтому rel здесь не ставим намеренно.

            Картинкой, а не их скриптом: сторонний скрипт на продающей
            странице — это чужой код в нашем окне и лишняя точка отказа.
            Их встраивание и так даёт чистые <a><img>, ничего не теряем.

            loading="lazy" и явные размеры: значок стоит в подвале, ниже
            первого экрана, и не должен ни задерживать отрисовку, ни дёргать
            вёрстку, когда догрузится.
          */}
          <span style={styles.footDot}>·</span>
          <a
            href="https://launchnest.io/p/aevion-devhub"
            target="_blank"
            style={styles.footLink}
          >
            <img
              src="https://launchnest.io/badge/aevion-devhub.svg?variant=featured"
              alt="AEVION DevHub on LaunchNest"
              width={220}
              height={56}
              loading="lazy"
              style={{ verticalAlign: "middle", maxWidth: "100%", height: "auto" }}
            />
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
  // Цена в первом экране: заметна, но тише h1 — она факт, а не призыв.
  heroPrice: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 15.5,
    lineHeight: 1.5,
    color: INK,
  },
  heroPriceLink: { color: INK, fontWeight: 700, whiteSpace: "nowrap" as const },
  foot: { marginTop: 44, paddingTop: 16, borderTop: `1px solid ${LINE}`, fontSize: 14 },
  footLink: { color: MUTED, textDecoration: "none" },
  footDot: { margin: "0 8px", color: MUTED },
};
