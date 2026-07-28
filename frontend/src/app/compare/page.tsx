import type { Metadata } from "next";
import Link from "next/link";
import { COMPARISONS, NOT_COMPARED_NOTE, type ModuleComparison } from "@/data/competitors";

// /compare — «чем это лучше того, чем я уже пользуюсь».
//
// Вопрос, который задаёт каждый, кто впервые видит платформу из 41 модуля.
// Ответ «у нас всё в одном месте» его не устраивает, и правильно делает.
//
// Страница устроена так, чтобы ей можно было верить: у каждого модуля рядом с
// нашими сильными сторонами стоят сильные стороны аналога. Не «зона роста», не
// «мы работаем над этим» — прямо то, в чём чужой продукт сегодня лучше.
// Односторонняя таблица читается как реклама и обесценивает всё остальное на
// сайте, поэтому правило проверяется тестом (data/__tests__/competitors.guard).

export const metadata: Metadata = {
  title: "Сравнение с аналогами — честно, с обеих сторон",
  description:
    "Чем модули AEVION отличаются от продуктов, которыми люди пользуются сегодня: где мы сильнее и где аналог лучше. Без сравнительных цифр, которых мы не измеряли.",
  alternates: { canonical: "/compare" },
  // Этой ссылкой делятся в переписке — именно её кидают в ответ на «а чем вы
  // лучше». Без openGraph в мессенджере вышел бы голый URL.
  openGraph: {
    title: "AEVION против аналогов — сравнение с обеих сторон",
    // Число берём из самих данных: захардкоженное разошлось бы с таблицей при
    // первом же добавленном модуле — ровно тот случай, когда цифра на витрине
    // живёт своей жизнью.
    description: `${COMPARISONS.length} модулей рядом с продуктами, которыми пользуются сегодня. У каждого названо и то, в чём сильнее мы, и то, в чём сильнее они.`,
    type: "article",
    url: "/compare",
  },
};

const BASIS_LABEL: Record<ModuleComparison["basis"], string> = {
  measured: "есть наш замер",
  "public-facts": "по открытым фактам",
  reasoned: "вывод из устройства продуктов",
};

const BASIS_NOTE: Record<ModuleComparison["basis"], string> = {
  measured: "Сравнение опирается на прогон, который мы можем показать.",
  "public-facts": "Сравнение по общедоступным фактам: тарифы, наличие функций, лицензии.",
  reasoned:
    "Вывод из устройства продуктов, без замера. Самое слабое основание — годится для «у них закрыто, у нас открыто», не годится для «мы быстрее».",
};

/**
 * Обратный указатель: от знакомого продукта к нашему модулю.
 *
 * Человек редко ищет «модуль для подписи» — он ищет «чем заменить DocuSign».
 * Без этого списка ему пришлось бы просматривать 36 карточек, чтобы понять,
 * есть ли у нас вообще что-то на эту тему.
 */
function buildRivalIndex(): Array<{ rival: string; modules: ModuleComparison[] }> {
  const byRival = new Map<string, ModuleComparison[]>();
  for (const c of COMPARISONS) {
    for (const r of c.rivals) {
      // Один и тот же продукт встречается как аналог у нескольких модулей —
      // например, DocSend и у QVenture, и у QContract. Схлопываем в одну строку.
      const list = byRival.get(r) ?? [];
      list.push(c);
      byRival.set(r, list);
    }
  }
  return [...byRival.entries()]
    .map(([rival, modules]) => ({ rival, modules }))
    .sort((a, b) => a.rival.localeCompare(b.rival, "ru"));
}

function Card({ c }: { c: ModuleComparison }) {
  return (
    <article id={c.id} style={styles.card}>
      <div style={styles.cardHead}>
        <div>
          <h2 style={styles.cardTitle}>{c.name}</h2>
          <p style={styles.what}>{c.what}</p>
        </div>
        <span style={c.stage === "live" ? styles.badgeLive : styles.badgeMvp}>
          {c.stage === "live" ? "живой" : "MVP"}
        </span>
      </div>

      <div style={styles.rivals}>
        <span style={styles.rivalsLabel}>сравниваем с</span> {c.rivals.join(" · ")}
      </div>

      <div style={styles.cols}>
        <div style={styles.col}>
          <div style={styles.colHeadUs}>В чём сильнее мы</div>
          <ul style={styles.list}>
            {c.stronger.map((s) => (
              <li key={s} style={styles.item}>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div style={styles.col}>
          <div style={styles.colHeadThem}>В чём сильнее они</div>
          <ul style={styles.list}>
            {c.weaker.map((s) => (
              <li key={s} style={styles.item}>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={styles.basis} title={BASIS_NOTE[c.basis]}>
        основание: {BASIS_LABEL[c.basis]}
      </div>
    </article>
  );
}

export default function ComparePage() {
  const measured = COMPARISONS.filter((c) => c.basis === "measured").length;
  const rivalIndex = buildRivalIndex();

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        {/* Своего бренд-заголовка здесь нет сознательно: /compare не входит ни
            в APP_PREFIXES, ни в BARE_PREFIXES (ClientProviders), то есть сверху
            уже стоит глобальный SiteHeader. Второе «AEVION» подряд читалось бы
            как ошибка вёрстки. */}
        <header style={styles.head}>
          <h1 style={styles.h1}>Чем это отличается от того, чем вы уже пользуетесь</h1>
          <p style={styles.lede}>
            У каждого модуля здесь названо не только то, в чём сильнее мы, но и то, в чём сильнее
            аналог. Таблица, где одна сторона хороша во всём, ничего не сообщает — кроме того, что
            её писали не для читателя.
          </p>
        </header>

        <section style={styles.rules}>
          <h2 style={styles.rulesTitle}>Как читать</h2>
          <ul style={styles.list}>
            <li style={styles.item}>
              <b>Сравнительных цифр нет.</b> «На 40% быстрее» требует прогона, который можно
              показать. Мы не измеряли чужие продукты, а брать числа из их маркетинга — тот же
              выдуманный факт, только с чужой подписью.
            </li>
            <li style={styles.item}>
              <b>У каждого сравнения указано основание.</b> Замер, открытые факты или вывод из
              устройства продуктов — последнее самое слабое, и это видно.
            </li>
            <li style={styles.item}>
              <b>«Живой» значит «открыт и работает», а не «зрелый».</b> Почти всё, что здесь
              сравнивается, моложе своих аналогов и уже по охвату — рядом с Coursera или Tor
              бейдж «живой» иначе читался бы как заявка на равенство. MVP значит MVP: он
              работает, но судить его по надёжности наравне со зрелым продуктом рано.
            </li>
          </ul>
          <p style={styles.rulesFoot}>
            Разобрано модулей: {COMPARISONS.length}, из них с собственным замером: {measured}.
          </p>
        </section>

        <section style={styles.rules}>
          <h2 style={styles.rulesTitle}>Ищете замену чему-то конкретному?</h2>
          <p style={styles.rulesFoot}>
            Слева — продукт, которым вы, возможно, уже пользуетесь. Справа — наш модуль,
            который делает похожее.
          </p>
          <ul style={styles.rivalIndex}>
            {rivalIndex.map(({ rival, modules }) => (
              <li key={rival} style={styles.rivalRow}>
                <span style={styles.rivalName}>{rival}</span>
                <span>
                  {modules.map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && ", "}
                      <a href={`#${m.id}`} style={styles.link}>
                        {m.name}
                      </a>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {COMPARISONS.map((c) => (
          <Card key={c.id} c={c} />
        ))}

        <section style={styles.tail}>
          <h2 style={styles.rulesTitle}>Чего здесь нет</h2>
          <p style={styles.item}>{NOT_COMPARED_NOTE}</p>
          <p style={styles.item}>
            Общее, что верно про всю платформу: у нас нет пользовательской базы, сравнимой с
            перечисленными продуктами, нет команды поддержки и нет отраслевых сертификаций. Это
            главное, в чём аналоги сильнее, и на уровне отдельных модулей это не проговаривается
            каждый раз.
          </p>
          <p style={styles.item}>
            Посмотреть сами модули: <Link href="/explore" style={styles.link}>обзор платформы</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

/* Светлый газетный стиль — тот же, что на /go. */
const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const RULE = "#ddd9cf";
const GOLD = "#a9781a";
const GREEN = "#0a7d72";
const RED = "#b5241b";

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "32px 18px 64px" },
  wrap: { maxWidth: 860, margin: "0 auto" },

  head: { borderBottom: `2px solid ${INK}`, paddingBottom: 18 },
  h1: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 30,
    lineHeight: 1.15,
    margin: 0,
    fontWeight: 700,
  },
  lede: { color: MUTED, fontSize: 15, lineHeight: 1.6, margin: "10px 0 0" },

  rules: { marginTop: 26, background: "#fffdf8", border: `1px solid ${RULE}`, borderRadius: 4, padding: "16px 18px" },
  rulesTitle: { fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, margin: "0 0 10px" },
  rulesFoot: { color: MUTED, fontSize: 13, margin: "10px 0 0" },

  card: {
    marginTop: 22,
    background: "#fffdf8",
    border: `1px solid ${RULE}`,
    borderRadius: 4,
    padding: "18px 18px 14px",
  },
  cardHead: { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" },
  cardTitle: { fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 700, margin: 0 },
  what: { color: MUTED, fontSize: 14, lineHeight: 1.55, margin: "6px 0 0" },
  badgeLive: {
    flexShrink: 0,
    fontFamily: "monospace",
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 999,
    color: GREEN,
    border: `1px solid ${GREEN}`,
  },
  badgeMvp: {
    flexShrink: 0,
    fontFamily: "monospace",
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 999,
    color: GOLD,
    border: `1px solid ${GOLD}`,
  },

  rivals: { fontSize: 13.5, color: INK, margin: "12px 0 0" },
  rivalsLabel: { fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", color: MUTED, letterSpacing: "0.08em" },

  // Две колонки на широком экране, одна на телефоне — сравнение читают именно
  // построчно, и на 360px две колонки превращаются в кашу из переносов.
  cols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 14,
  },
  col: {},
  colHeadUs: {
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: GREEN,
    marginBottom: 6,
  },
  colHeadThem: {
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: RED,
    marginBottom: 6,
  },
  list: { margin: 0, paddingLeft: 18 },
  item: { color: INK, fontSize: 14, lineHeight: 1.6, marginBottom: 6 },

  basis: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: `1px solid ${RULE}`,
    fontFamily: "monospace",
    fontSize: 11.5,
    color: MUTED,
  },

  rivalIndex: { listStyle: "none", margin: "12px 0 0", padding: 0 },
  rivalRow: {
    display: "grid",
    // На телефоне две колонки схлопываются в одну: имя продукта и ссылка
    // на модуль иначе ужимаются до переносов по одному слову.
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 2,
    padding: "7px 0",
    borderTop: `1px solid ${RULE}`,
    fontSize: 14,
  },
  rivalName: { fontWeight: 700 },
  tail: { marginTop: 30, borderTop: `2px solid ${INK}`, paddingTop: 16 },
  link: { color: GOLD },
};
