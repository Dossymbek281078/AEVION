"use client";

/**
 * DevHub against the AI builders it gets compared to.
 *
 * The rule this page is built on: every cell shows where its claim comes from.
 * Our own numbers carry the date of the run that produced them; competitor
 * numbers carry the date they were read off public pricing and docs; anything
 * we have not measured stays blank rather than becoming a confident dash.
 *
 * It exists because a comparison table is the easiest place in a product to
 * lie by accident — and the first thing an investor or a journalist checks.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { indexCapabilities, type Capability, type CapabilityIndex } from "@/lib/devhubCapabilities";

/** Show the section that names where we are behind. Kept as one switch on
 *  purpose: it is a positioning decision, not an engineering one. */
const SHOW_WEAKNESSES = true;

/** When the competitor column was read off public pricing pages and docs. */
const COMPETITOR_DATA_DATE = "22 июля 2026";

/** The ecosystem table's competitor figures were collected separately, later.
 *  One date for both would have been wrong by six days — small, and exactly
 *  the kind of inaccuracy this page exists to refuse. */
const ECOSYSTEM_DATA_DATE = "28 июля 2026";

type Origin = "measured" | "public" | "unmeasured" | "broken";

const ORIGIN_STYLE: Record<Origin, { dot: string; label: string }> = {
  measured: { dot: "#0d9488", label: "наш прогон" },
  public: { dot: "#0369a1", label: "публичные данные" },
  unmeasured: { dot: "#cbd5e1", label: "не измеряли" },
  broken: { dot: "#dc2626", label: "сейчас не работает" },
};

type Cell = { text: string; origin: Origin };

type Row = {
  feature: string;
  aevion: Cell;
  others: Record<string, Cell>;
};

const COMPETITORS = ["Bolt.new", "Lovable", "v0", "Replit"] as const;

const ROWS: Row[] = [
  {
    feature: "Сколько стоит ИИ пользователю",
    aevion: { text: "Бесплатный флот моделей; роутинг сэкономил 99% — замер по трём прогонам, $0,23 против расчётных $30", origin: "measured" },
    others: {
      "Bolt.new": { text: "$20/мес, главная жалоба — сгорают токены", origin: "public" },
      Lovable: { text: "кредиты", origin: "public" },
      v0: { text: "$20/мес, с февраля — токены", origin: "public" },
      Replit: { text: "подписка + оплата использования", origin: "public" },
    },
  },
  {
    feature: "«Опиши идею — получи приложение»",
    aevion: { text: "102 с → 11 файлов (23.07); отдельная генерация 23 с (26.07)", origin: "measured" },
    others: {
      "Bolt.new": { text: "есть", origin: "public" },
      Lovable: { text: "есть", origin: "public" },
      v0: { text: "есть", origin: "public" },
      Replit: { text: "есть, самый автономный агент", origin: "public" },
    },
  },
  {
    feature: "Скриншот → код",
    aevion: { text: "11 с; заданный цвет попал в код точно (26.07)", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "", origin: "unmeasured" },
      v0: { text: "есть, сильная сторона", origin: "public" },
      Replit: { text: "", origin: "unmeasured" },
    },
  },
  {
    feature: "Превью без деплоя",
    aevion: { text: "React и Next рендерятся в браузере", origin: "measured" },
    others: {
      "Bolt.new": { text: "сильнее: настоящий Node и npm прямо в браузере", origin: "public" },
      Lovable: { text: "есть", origin: "public" },
      v0: { text: "есть", origin: "public" },
      Replit: { text: "сильнее: полноценная среда с процессами", origin: "public" },
    },
  },
  {
    feature: "Деплой называет адрес только после проверки",
    aevion: { text: "«Live» ставится, лишь когда страница реально ответила", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "", origin: "unmeasured" },
      v0: { text: "", origin: "unmeasured" },
      Replit: { text: "", origin: "unmeasured" },
    },
  },
  {
    feature: "Своя база данных проекту",
    aevion: { text: "Схема и роль на проект; изоляция проверена: соседний проект получает отказ", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "сильнее: Supabase по одному промту, с политиками доступа", origin: "public" },
      v0: { text: "Supabase", origin: "public" },
      Replit: { text: "встроенная база", origin: "public" },
    },
  },
  {
    feature: "Медиа прямо в редакторе (картинки, видео, озвучка, 3D)",
    aevion: { text: "Код и цепочки запасных провайдеров есть, но сейчас не работает: у провайдеров пустые балансы", origin: "broken" },
    others: {
      "Bolt.new": { text: "нет", origin: "public" },
      Lovable: { text: "нет", origin: "public" },
      v0: { text: "нет", origin: "public" },
      Replit: { text: "нет", origin: "public" },
    },
  },
  {
    feature: "Откат любой правки ИИ",
    aevion: { text: "Точка отката на каждую правку, история и откат импорта архива", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "", origin: "unmeasured" },
      v0: { text: "", origin: "unmeasured" },
      Replit: { text: "есть откат по чекпоинтам", origin: "public" },
    },
  },
  {
    feature: "Экосистема, шаблоны, сообщество",
    aevion: { text: "Слабее всех в этой таблице — нас пока никто не знает", origin: "measured" },
    others: {
      "Bolt.new": { text: "сильная", origin: "public" },
      Lovable: { text: "сильная", origin: "public" },
      v0: { text: "сильная", origin: "public" },
      Replit: { text: "сильнейшая", origin: "public" },
    },
  },
];

const WEAKNESSES = [
  "Нет настоящей среды исполнения в браузере: у Bolt и Replit можно поставить пакеты и запустить сервер прямо на странице, у нас — превью и деплой.",
  "Интеграция с базой слабее, чем у Lovable: у них схема и правила доступа рождаются из одного промта, у нас — схема и роль, остальное руками.",
  "Медиа-возможности сейчас мертвы из-за пустых балансов у провайдеров. Код готов, деньги — нет.",
  "Экосистема и узнаваемость — наша самая слабая позиция, и быстро это не чинится.",
];


/**
 * The rest of the ecosystem. The founder asked for every module with an
 * analogue — and the honest answer is that only three besides DevHub have
 * facts behind them. Listing the others with invented advantages would turn a
 * checkable page into a brochure, so they are named with what is missing.
 */
type EcoRow = { module: string; rivals: string; ours: Cell; missing: string };

const ECOSYSTEM: EcoRow[] = [
  {
    module: "CyberChess",
    rivals: "Chess.com, Lichess",
    ours: { text: "502 584 задачи; ИИ-разбор партии; бот, играющий по-человечески — 0 зевков на 476 ходов (26.07)", origin: "measured" },
    missing: "у Lichess 6 057 356 задач — в 12 раз больше; аудитории и рейтинга у нас нет, силу движка не сравнивали",
  },
  {
    module: "Smeta Trainer",
    rivals: "АВС-4, «Смета РК», «Сана»",
    ours: { text: "Тренажёр на реальном корпусе расценок РК — учит методике, а не заменяет сметную программу", origin: "measured" },
    missing: "долю рынка и скорость обучения не мерили",
  },
  {
    module: "QSkyway",
    rivals: "сервисы полётных зон для дронов",
    ours: { text: "Правила трёх регуляторов (США, Япония, Казахстан) с доказуемой свежестью и подписью источника", origin: "measured" },
    missing: "покрытие против конкурентов не считали",
  },
  {
    module: "QReal Studio",
    rivals: "Higgsfield, Runway, Kling",
    ours: { text: "Директивы реализма добавляются к каждому видеопромту из общего модуля", origin: "measured" },
    missing: "сравнение качества не проводилось — и публиковать его нельзя, пока нет слепого бенчмарка",
  },
  {
    module: "QSign и IP-бюро",
    rivals: "DocuSign",
    ours: { text: "Нет платы за пользователя и потолка документов — у DocuSign 100 конвертов на человека в год; авторство фиксируется хешем", origin: "public" },
    missing: "подпись не квалифицированная, личность подписанта не проверяется",
  },
  {
    module: "QContract",
    rivals: "PandaDoc, DocuSign",
    ours: { text: "Ссылка с паролем, лимитом просмотров, сроком и отзывом; списание просмотра атомарное", origin: "measured" },
    missing: "на проде два документа; нет шаблонов, согласований и CRM — того, ради чего покупают PandaDoc за $19–49 с человека",
  },
  {
    module: "Платёжный API",
    rivals: "Stripe, Paddle",
    ours: { text: "Привычная форма API, бесплатная песочница", origin: "measured" },
    missing: "эквайринга нет — деньги не двигаются; нет лицензии и PCI DSS",
  },
  {
    module: "QStore",
    rivals: "Gumroad, Lemon Squeezy",
    ours: { text: "Без комиссии — у Gumroad 10% плюс $0,50 с продажи", origin: "public" },
    missing: "мы не merchant of record: НДС и отчётность остаются на продавце, выплат нет",
  },
  {
    module: "Остальные модули экосистемы",
    rivals: "у части аналоги есть",
    ours: { text: "", origin: "unmeasured" },
    missing: "нужен замер: строка в таблице без него — обещание, а не факт",
  },
];

function OriginDot({ origin }: { origin: Origin }) {
  const s = ORIGIN_STYLE[origin];
  return (
    <span
      title={s.label}
      aria-label={s.label}
      style={{
        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
        background: s.dot, marginRight: 7, flexShrink: 0, verticalAlign: "middle",
      }}
    />
  );
}

function CellView({ cell }: { cell: Cell }) {
  if (!cell.text) {
    return <span style={{ color: "#94a3b8", fontSize: 12.5 }}><OriginDot origin="unmeasured" />не измеряли</span>;
  }
  return (
    <span style={{ color: cell.origin === "broken" ? "#991b1b" : "#334155", fontSize: 13, lineHeight: 1.5 }}>
      <OriginDot origin={cell.origin} />
      {cell.text}
    </span>
  );
}

export default function ComparePage() {
  const [caps, setCaps] = useState<CapabilityIndex | null>(null);
  const [capList, setCapList] = useState<Capability[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Capability[] = Array.isArray(d.capabilities) ? d.capabilities : [];
        setCapList(list);
        setCaps(indexCapabilities(list));
      })
      .catch(() => {});
  }, []);

  const liveNow = capList.filter((c) => c.status === "live").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <Wave1Nav />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 16px 64px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          DevHub и те, с кем нас сравнивают
        </h1>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, maxWidth: 760, marginBottom: 20 }}>
          В каждой клетке видно, откуда взято утверждение. Наши цифры — из наших же
          прогонов, с датой. Данные о других — с их публичных страниц, собраны{" "}
          {COMPETITOR_DATA_DATE}. Там, где мы не измеряли, стоит «не измеряли», а не
          уверенный прочерк.
        </p>

        {/* Our own state, live — the same source the shelf uses. */}
        {capList.length > 0 && (
          <div style={{
            border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12,
            padding: "12px 16px", marginBottom: 24, fontSize: 13.5, color: "#0f172a",
          }}>
            <strong>Прямо сейчас у нас работает {liveNow} из {capList.length} возможностей.</strong>{" "}
            <span style={{ color: "#64748b" }}>
              Это живая цифра с сервера, а не строка в презентации — она меняется, когда
              что-то ломается у провайдера.{" "}
              <Link href="/devhub" style={{ color: "#0d9488", fontWeight: 600 }}>Открыть DevHub →</Link>
            </span>
          </div>
        )}

        {/* Two presentations of the same array: a table where there is room and
            stacked cards on a phone. Reading five columns of a 1270px table
            through a 390px window is not reading. Nothing is duplicated but
            markup — both render from ROWS, so they cannot drift apart. */}
        <style>{`
          .cmp-wide { display: block; }
          .cmp-narrow { display: none; }
          @media (max-width: 780px) {
            .cmp-wide { display: none; }
            .cmp-narrow { display: block; }
          }
        `}</style>

        <div className="cmp-narrow">
          {ROWS.map((row) => (
            <div key={row.feature} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10, lineHeight: 1.35 }}>{row.feature}</div>
              <div style={{ background: "#f0fdfa", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0d9488", marginBottom: 4 }}>AEVION DevHub</div>
                <CellView cell={row.aevion} />
              </div>
              {COMPETITORS.map((c) => (
                <div key={c} style={{ display: "flex", gap: 10, padding: "6px 0", borderTop: "1px solid #f8fafc" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, minWidth: 78, flexShrink: 0 }}>{c}</div>
                  <div style={{ flex: 1 }}><CellView cell={row.others[c]} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="cmp-wide" style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12.5, color: "#475569", fontWeight: 700 }}>Возможность</th>
                <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12.5, color: "#0d9488", fontWeight: 800 }}>AEVION DevHub</th>
                {COMPETITORS.map((c) => (
                  <th key={c} style={{ textAlign: "left", padding: "12px 14px", fontSize: 12.5, color: "#475569", fontWeight: 700 }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0f172a", minWidth: 210 }}>{row.feature}</td>
                  <td style={{ padding: "12px 14px", background: "#f0fdfa", minWidth: 260 }}><CellView cell={row.aevion} /></td>
                  {COMPETITORS.map((c) => (
                    <td key={c} style={{ padding: "12px 14px", minWidth: 200 }}><CellView cell={row.others[c]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 2px 28px", fontSize: 12.5, color: "#64748b" }}>
          {(["measured", "public", "unmeasured", "broken"] as Origin[]).map((o) => (
            <span key={o}><OriginDot origin={o} />{ORIGIN_STYLE[o].label}</span>
          ))}
        </div>

        {SHOW_WEAKNESSES && (
          <section style={{
            border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12,
            padding: "16px 18px", marginBottom: 28,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#991b1b", marginBottom: 10 }}>
              Где мы слабее — без этого таблица не стоит ничего
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#7f1d1d", fontSize: 13.5, lineHeight: 1.7 }}>
              {WEAKNESSES.map((w) => <li key={w.slice(0, 24)}>{w}</li>)}
            </ul>
          </section>
        )}


        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginTop: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            Остальная экосистема — и почему таблица здесь короче, чем модулей
          </h2>
          <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
            {/* 41, а не 38: число берётся из реестра модулей, и сторож scaleClaims
                сверяет его на каждом прогоне. Тридцать восемь было верно на день,
                когда страницу писали, — на публичной странице такое число живёт до
                первого нового модуля и потом молча врёт. */}
            В AEVION 41 модуль, у части есть аналоги. Но сравнивать по фактам можно
            только те, где мы что-то измерили. Остальные названы честно — с тем, чего
            не хватает. Цифры по чужим продуктам в этой таблице собраны{" "}
            {ECOSYSTEM_DATA_DATE} — отдельно от таблицы выше.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12.5, color: "#475569" }}>Модуль</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12.5, color: "#475569" }}>С чем сравнивают</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12.5, color: "#0d9488" }}>Что у нас проверено</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12.5, color: "#92400e" }}>Чего не хватает для сравнения</th>
                </tr>
              </thead>
              <tbody>
                {ECOSYSTEM.map((row) => (
                  <tr key={row.module} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{row.module}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12.5, color: "#64748b" }}>{row.rivals}</td>
                    <td style={{ padding: "10px 12px" }}><CellView cell={row.ours} /></td>
                    <td style={{ padding: "10px 12px", fontSize: 12.5, color: "#92400e" }}>{row.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginTop: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Про экономию — честно</h2>
          <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.65, margin: 0 }}>
            Набор из семи сервисов, которые обычно собирают вручную (билдер, видео,
            музыка, озвучка, картинки, 3D, хостинг), стоит около <strong>$162 в месяц</strong>{" "}
            по их публичным ценам. Наш тариф — $149. Разница мала, и продавать её как
            главную выгоду было бы неправдой. Настоящая разница в другом: не нужно
            переносить файлы между семью сервисами, у всего один общий контекст проекта.
            Насколько это быстрее в часах — <strong>мы не мерили и потому не пишем</strong>.
          </p>
        </section>
      </main>
    </div>
  );
}
