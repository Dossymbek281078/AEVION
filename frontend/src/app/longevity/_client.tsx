"use client";

import { Fragment, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";
import { keepChannel, productById, withChannel } from "@/lib/products";
import { BuyLink } from "@/components/BuyLink";
import { WaitlistCapture } from "@/components/WaitlistCapture";

// Longevity — the measure → act → re-measure protocol over the deterministic
// backend. Three live tools: your assessment (flag out-of-range markers + get a
// personalized, evidence-graded 12-week stack), a re-measure progress score,
// and the reference panel. Honest grading (A/B/C/E) is the point.

const GRADE_COLOR: Record<string, string> = { A: "#55C093", B: "#5BB6D0", C: "#DDB253", E: "#b39ddb" };

/** PDF-версия этого же протокола. Позиция каталога, а не хардкод цены/ссылки. */
const PROTOCOL_PDF = productById("oijxmq");

/**
 * Следующая ступень воронки. Замер 27.08.2026: весь трафик с роликов вёл на один
 * чек $19, а подписка и модули дороже в воронке не встречались вообще. На цель в
 * миллион это разница между десятками тысяч разовых продаж и парой тысяч
 * подписчиков — при том же контенте и той же аудитории.
 *
 * Числами цены здесь намеренно НЕ названы: сторож retiredPrices.guard поймал
 * первую версию этого комментария на «$39» — отставном номинале тарифа. Цена
 * живёт в каталоге, и повторять её в прозе значит заводить вторую копию,
 * которая устареет молча.
 *
 * Позиция каталога, а не хардкод: цена подписки уже менялась, и вторая её копия
 * в коде разошлась бы с чекаутом молча.
 */
const ALL_ACCESS = productById("xpxzam");

/**
 * Книга, из которой вырос протокол: «Gratitude ∞ Forever Young» — тот же
 * бренд ForeverYoung, та же тема долголетия. Замер 29.08.2026: книга
 * продавалась, а эта страница не упоминала её НИ РАЗУ, и своей страницы у
 * книги нет вовсе (/book отвечает 404). То есть человек, пришедший читать
 * про антиэйдж, о нашей книге про антиэйдж не узнавал.
 *
 * Позиция каталога, а не хардкод — по той же причине, что и выше: цену
 * называет чекаут, проза устаревает молча.
 */
const BOOK = productById("ghvzq");

interface AField { key: string; label: string; unit: string; placeholder: string; }
const ASSESS_FIELDS: AField[] = [
  { key: "vitD", label: "Витамин D", unit: "нг/мл", placeholder: "35" },
  { key: "hsCRP", label: "hs-CRP", unit: "мг/л", placeholder: "1.5" },
  { key: "homaIR", label: "HOMA-IR", unit: "", placeholder: "2.0" },
  { key: "omega3Index", label: "Омега-3 индекс", unit: "%", placeholder: "6" },
  { key: "glucose", label: "Глюкоза", unit: "ммоль/л", placeholder: "5.2" },
  { key: "apoB", label: "ApoB", unit: "г/л", placeholder: "0.9" },
  { key: "vo2max", label: "VO₂max", unit: "", placeholder: "35" },
  { key: "waist", label: "Талия", unit: "см", placeholder: "90" },
];

const FLAGS: { key: string; label: string }[] = [
  { key: "diabetes", label: "Диабет" },
  { key: "pregnant", label: "Беременность" },
  { key: "underweight", label: "Дефицит массы" },
  { key: "hypertension", label: "Гипертония" },
  { key: "heartCondition", label: "Болезнь сердца" },
];

const PROGRESS_FIELDS: AField[] = [
  { key: "hsCRP", label: "hs-CRP", unit: "мг/л", placeholder: "" },
  { key: "homaIR", label: "HOMA-IR", unit: "", placeholder: "" },
  { key: "vitD", label: "Витамин D", unit: "нг/мл", placeholder: "" },
  { key: "omega3Index", label: "Омега-3 индекс", unit: "%", placeholder: "" },
  { key: "vo2max", label: "VO₂max", unit: "", placeholder: "" },
  { key: "waist", label: "Талия", unit: "см", placeholder: "" },
  { key: "phenoAge", label: "PhenoAge (биовозраст)", unit: "лет", placeholder: "" },
];

interface Marker { key: string; name: string; group: string; shows: string; target: string; grade: string; }
interface PanelResp { groups: Record<string, Marker[]>; disclaimer: string; }

interface StackItem { id: string; name: string; domain: string; domainLabel: string; grade: string; targeted: boolean; note: string; }
interface Flagged { key: string; name: string; value: number; target: string; grade: string; }
interface AssessResp {
  flaggedMarkers: Flagged[];
  /** Сколько маркеров человек ВООБЩЕ прислал. Ноль отклонений при нуле
   *  измерений — это не хорошая новость, а отсутствие обследования. */
  measuredCount?: number;
  warning?: string;
  recommendedStack: StackItem[];
  contraindicationGated: { name: string; reason: string }[];
  informOnly: { name: string; grade: string; note: string }[];
  cycle: { weeks: number; phases: { week: string; title: string; detail: string }[] };
  disclaimer: string;
}

interface ProgMetric { key: string; name: string; baseline: number; latest: number; change: number; improved: boolean; }
interface ProgResp { metrics: ProgMetric[]; improvedCount: number; total: number; progressScore: number; trajectory: string; interpretation: string; }

export default function LongevityClient({ channel = null }: { channel?: string | null }) {
  const [panel, setPanel] = useState<PanelResp | null>(null);

  const [vals, setVals] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [assess, setAssess] = useState<AssessResp | null>(null);
  const [assessErr, setAssessErr] = useState<string | null>(null);
  const [assessLoading, setAssessLoading] = useState(false);

  const [base, setBase] = useState<Record<string, string>>({});
  const [late, setLate] = useState<Record<string, string>>({});
  const [prog, setProg] = useState<ProgResp | null>(null);
  const [progErr, setProgErr] = useState<string | null>(null);
  const [progLoading, setProgLoading] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/longevity/panel"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPanel(d as PanelResp))
      .catch(() => {});
  }, []);

  function numBody(src: Record<string, string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }

  async function runAssess() {
    setAssessLoading(true);
    setAssessErr(null);
    try {
      const activeFlags: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(flags)) if (v) activeFlags[k] = true;
      const res = await fetch(apiUrl("/api/longevity/assess"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: numBody(vals), flags: activeFlags }),
      });
      if (!res.ok) throw new Error(`Сервер вернул ${res.status}`);
      setAssess((await res.json()) as AssessResp);
    } catch (e) {
      setAssessErr(e instanceof Error ? e.message : "Не удалось оценить");
    } finally {
      setAssessLoading(false);
    }
  }

  async function runProgress() {
    setProgLoading(true);
    setProgErr(null);
    try {
      const res = await fetch(apiUrl("/api/longevity/progress"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseline: numBody(base), latest: numBody(late) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error === "no_comparable_metrics" ? "Заполни хотя бы одну метрику в обоих столбцах" : `Сервер вернул ${res.status}`);
      setProg(data as ProgResp);
    } catch (e) {
      setProgErr(e instanceof Error ? e.message : "Не удалось посчитать");
    } finally {
      setProgLoading(false);
    }
  }

  const byDomain: Record<string, StackItem[]> = {};
  if (assess) for (const it of assess.recommendedStack) (byDomain[it.domainLabel] ||= []).push(it);

  const scoreColor = prog ? (prog.trajectory === "improving" ? "#55C093" : prog.trajectory === "worsening" ? "#E0787F" : "#DDB253") : "#c3d0e0";

  // Язык объявляется на самом блоке: в корневом макете стоит lang="en"
  // (большая часть сайта английская), а эта страница русская — и
  // несоответствие браузер лечит машинным переводом НАШЕГО текста.
  // Ближайший lang выигрывает у корневого, поэтому общий шаблон трогать
  // не нужно. Приём взят у cyberchess/launch, чтобы способ был один.
  // Протокол целиком по-русски; английское издание живёт на /en/longevity.
  return (
    <main lang="ru" style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · Longevity</div>
        <h1 style={styles.h1}>Протокол долголетия: измерь → воздействуй → перемерь</h1>
        <HealthDisclaimer />
        <p style={styles.lede}>
          Один 12-недельный цикл. Стандартная панель показывает, чего не хватает и как стареет организм;
          движок собирает персональный стек по четырём рычагам, честно отсортированный по доказательности;
          в конце — повторный замер и объективная дельта.
        </p>

        {/* Step 1+2: assessment */}
        <section style={styles.card}>
          <h2 style={styles.h2}>Шаг 1–2 · Твоя оценка и план</h2>
          <p style={styles.sub}>Введи, что знаешь (можно не всё), отметь противопоказания — получишь подсвеченные маркеры и персональный стек.</p>
          <div style={styles.grid}>
            {ASSESS_FIELDS.map((f) => (
              <label key={f.key} style={styles.field}>
                <span style={styles.fieldLabel}>{f.label} {f.unit && <span style={styles.unit}>{f.unit}</span>}</span>
                <input type="number" inputMode="decimal" placeholder={f.placeholder}
                  value={vals[f.key] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                  style={styles.input} />
              </label>
            ))}
          </div>
          <div style={styles.flags}>
            {FLAGS.map((f) => (
              <label key={f.key} style={styles.flagChip}>
                <input type="checkbox" checked={!!flags[f.key]} onChange={(e) => setFlags((p) => ({ ...p, [f.key]: e.target.checked }))} />
                {f.label}
              </label>
            ))}
          </div>
          <button onClick={runAssess} disabled={assessLoading} style={styles.btn}>
            {assessLoading ? "Считаю…" : "Собрать план"}
          </button>
          {assessErr && <p style={styles.error}>{assessErr}</p>}

          {assess && (
            <div style={styles.result}>
              {/* Бэкенд с 20.08.2026 отличает «сдал анализы, всё в коридоре» от
                  «не сдавал ничего». До этой вставки страница показывала оба
                  случая одинаково — пустым списком отклонений, который человек
                  читает как хорошую новость. */}
              {assess.measuredCount === 0 && assess.warning && (
                <div role="alert" style={styles.noDataWarning}>
                  <b>Оценка не проведена.</b> {assess.warning}
                </div>
              )}
              {assess.flaggedMarkers.length > 0 && (
                <>
                  <div style={styles.blockTitle}>Вне коридора ({assess.flaggedMarkers.length})</div>
                  <div style={styles.chips}>
                    {assess.flaggedMarkers.map((m) => (
                      <span key={m.key} style={styles.flaggedChip}>{m.name}: {m.value} <span style={styles.unit}>(цель {m.target})</span></span>
                    ))}
                  </div>
                </>
              )}

              <div style={styles.blockTitle}>Рекомендуемый стек</div>
              {Object.entries(byDomain).map(([label, items]) => (
                <div key={label} style={styles.domain}>
                  <div style={styles.domainLabel}>{label}</div>
                  {items.map((it) => (
                    <div key={it.id} style={styles.stackItem}>
                      <span style={{ ...styles.gradeChip, color: GRADE_COLOR[it.grade], borderColor: GRADE_COLOR[it.grade] }}>{it.grade}</span>
                      <div>
                        <div style={styles.stackName}>{it.name} {it.targeted && <span style={styles.targeted}>под твои маркеры</span>}</div>
                        <div style={styles.stackNote}>{it.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {assess.contraindicationGated.length > 0 && (
                <div style={styles.gated}>
                  <div style={styles.blockTitle}>Отключено по противопоказаниям</div>
                  {assess.contraindicationGated.map((g) => (
                    <div key={g.name} style={styles.gatedItem}><b>{g.name}</b> — {g.reason}</div>
                  ))}
                </div>
              )}

              <div style={styles.blockTitle}>12-недельный цикл</div>
              <div style={styles.timeline}>
                {assess.cycle.phases.map((p) => (
                  <div key={p.week} style={styles.phase}>
                    <div style={styles.phaseWeek}>НЕД {p.week}</div>
                    <div><div style={styles.phaseTitle}>{p.title}</div><div style={styles.phaseDetail}>{p.detail}</div></div>
                  </div>
                ))}
              </div>

              {assess.informOnly.length > 0 && (
                <div style={styles.info}>
                  <div style={styles.blockTitle}>Только к сведению (не назначаем)</div>
                  {assess.informOnly.map((it) => (
                    <div key={it.name} style={styles.infoItem}>
                      <span style={{ ...styles.gradeChip, color: GRADE_COLOR[it.grade], borderColor: GRADE_COLOR[it.grade] }}>{it.grade}</span>
                      <span>{it.name} — {it.note}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={styles.disclaimer}>{assess.disclaimer}</p>
            </div>
          )}
        </section>

        {/* Step 3: progress */}
        <section style={styles.card}>
          <h2 style={styles.h2}>Шаг 3 · Перемер и прогресс</h2>
          <p style={styles.sub}>Введи ключевые метрики до и после цикла — движок посчитает дельту в правильную сторону.</p>
          <div style={styles.progGrid}>
            <div style={styles.progHead}></div>
            <div style={styles.progHead}>Было (baseline)</div>
            <div style={styles.progHead}>Стало (latest)</div>
            {PROGRESS_FIELDS.map((f) => (
              <Fragment key={f.key}>
                <div style={styles.progLabel}>{f.label} {f.unit && <span style={styles.unit}>{f.unit}</span>}</div>
                <input type="number" inputMode="decimal" value={base[f.key] ?? ""}
                  onChange={(e) => setBase((p) => ({ ...p, [f.key]: e.target.value }))} style={styles.input} />
                <input type="number" inputMode="decimal" value={late[f.key] ?? ""}
                  onChange={(e) => setLate((p) => ({ ...p, [f.key]: e.target.value }))} style={styles.input} />
              </Fragment>
            ))}
          </div>
          <button onClick={runProgress} disabled={progLoading} style={styles.btn}>
            {progLoading ? "Считаю…" : "Посчитать прогресс"}
          </button>
          {progErr && <p style={styles.error}>{progErr}</p>}

          {prog && (
            <div style={styles.result}>
              <div style={styles.scoreRow}>
                <div style={{ ...styles.scoreNum, color: scoreColor }}>{prog.progressScore}<span style={styles.scorePct}>%</span></div>
                <div>
                  <div style={styles.scoreCap}>улучшилось {prog.improvedCount} из {prog.total}</div>
                  <div style={{ ...styles.scoreTraj, color: scoreColor }}>
                    {prog.trajectory === "improving" ? "прогресс есть" : prog.trajectory === "worsening" ? "ухудшение" : "смешанно"}
                  </div>
                </div>
              </div>
              <p style={styles.bioInterp}>{prog.interpretation}</p>
              <div style={styles.metrics}>
                {prog.metrics.map((m) => (
                  <div key={m.key} style={styles.metricRow}>
                    <span style={styles.metricName}>{m.name}</span>
                    <span style={styles.metricVals}>{m.baseline} → {m.latest}</span>
                    <span style={{ ...styles.metricArrow, color: m.improved ? "#55C093" : "#E0787F" }}>{m.improved ? "✓" : "✗"} {m.change > 0 ? "+" : ""}{m.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Reference panel */}
        {panel && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Стандартная панель (справочно)</h2>
            <p style={styles.sub}>Что сдавать и на что смотреть. Оценка доказательности у каждого маркера.</p>
            {Object.entries(panel.groups).map(([group, markers]) => (
              <div key={group} style={styles.panelGroup}>
                <div style={styles.panelGroupName}>{group}</div>
                {markers.map((m) => (
                  <div key={m.key} style={styles.panelRow}>
                    <span style={{ ...styles.gradeChip, color: GRADE_COLOR[m.grade], borderColor: GRADE_COLOR[m.grade] }}>{m.grade}</span>
                    <div style={styles.panelInfo}>
                      <div style={styles.panelName}>{m.name} <span style={styles.panelTarget}>{m.target}</span></div>
                      <div style={styles.panelShows}>{m.shows}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <p style={styles.disclaimer}>{panel.disclaimer}</p>
          </section>
        )}

        {/* Протокол в PDF — модуль был живым с 13.07, но купить в нём было нечего.
            Цена и ссылка берутся из каталога @/lib/products, а не пишутся здесь. */}
        {PROTOCOL_PDF && (
          <BuyLink
            href={withChannel(PROTOCOL_PDF.href, channel, "longevity")}
            source="longevity"
            productId={PROTOCOL_PDF.id}
            priceUsd={PROTOCOL_PDF.priceUsd}
            channel={channel}
            style={styles.buyCard}
          >
            <div style={styles.buyLeft}>
              <div style={styles.buyKicker}>{PROTOCOL_PDF.format}</div>
              <div style={styles.buyTitle}>Забрать протокол с собой</div>
              <p style={styles.buyDesc}>
                Вся панель, стек с градацией доказательности и таблица результата — в PDF,
                чтобы заполнять на нулевой и двенадцатой неделе, не открывая сайт.
              </p>
            </div>
            <div style={styles.buyRight}>
              <div style={styles.buyPrice}>${PROTOCOL_PDF.priceUsd}</div>
              <div style={styles.buyBtn}>Купить&nbsp;→</div>
            </div>
          </BuyLink>
        )}

        {/* Книга той же темы — см. комментарий у BOOK. */}
        {BOOK && (
          <BuyLink
            href={withChannel(BOOK.href, channel, "longevity-book")}
            source="longevity-book"
            productId={BOOK.id}
            priceUsd={BOOK.priceUsd}
            channel={channel}
            style={styles.buyCard}
          >
            <div style={styles.buyLeft}>
              <div style={styles.buyKicker}>{BOOK.format}</div>
              <div style={styles.buyTitle}>Книга, из которой вырос этот протокол</div>
              <p style={styles.buyDesc}>
                «{BOOK.title.split(" — ")[0]}» — то же направление целиком: почему старение
                считают управляемым процессом и что из этого следует на практике.
                Протокол выше — короткая выжимка из неё.
              </p>
            </div>
            <div style={styles.buyRight}>
              <div style={styles.buyPrice}>${BOOK.priceUsd}</div>
              <div style={styles.buyBtn}>Книга&nbsp;→</div>
            </div>
          </BuyLink>
        )}

        {/* Ступень после $19 — и только ПОСЛЕ него, а не вместо.
            Человек уже получил обещанное бесплатно и увидел, что протокол
            настоящий: предлагать подписку раньше значит просить денег до того,
            как показал ценность. Формулировка без обещаний результата — тема
            здоровья ограничена и у поисковиков, и у рекламных систем. */}
        {ALL_ACCESS && (
          <BuyLink
            href={withChannel(ALL_ACCESS.href, channel, "longevity-upsell")}
            source="longevity-upsell"
            productId={ALL_ACCESS.id}
            priceUsd={ALL_ACCESS.priceUsd}
            channel={channel}
            style={styles.upsellCard}
          >
            <div style={styles.buyLeft}>
              <div style={styles.upsellKicker}>{ALL_ACCESS.format}</div>
              <div style={styles.buyTitle}>Дальше — вся платформа</div>
              <p style={styles.buyDesc}>
                Протокол долголетия — один из модулей AEVION. По подписке
                открываются остальные: реестр прав, подпись документов, ИИ-инструменты,
                платежи. Одна подписка вместо покупки по одному.
              </p>
            </div>
            <div style={styles.buyRight}>
              <div style={styles.buyPrice}>${ALL_ACCESS.priceUsd}<span style={styles.upsellPer}>/мес</span></div>
              <div style={styles.upsellBtn}>Открыть&nbsp;→</div>
            </div>
          </BuyLink>
        )}


        {/* Сбор адреса ставится ЗДЕСЬ, а не на /go, и вот почему.
            /go — перевалочная страница: на ней не задерживаются. Ценность
            человек получает тут: панель маркеров, стек с градацией
            доказательности, двенадцать недель. Замер 20.08.2026: форма была
            только на /go, то есть посетитель забирал всё и уходил, не оставив
            контакта. Подписчиков в системе на тот момент было три. */}
        <WaitlistCapture
          source="longevity"
          tone="dark"
          title="Прислать, когда протокол обновится"
          description="Разбор пересматривается, когда выходят новые исследования: что-то поднимается в градации, что-то опускается. Оставьте адрес — напишем, если изменится то, что вы уже делаете."
          promise="Пишем только по делу — при изменении градации или панели. Отписка одной ссылкой."
          buttonLabel="Присылать обновления"
        />
        <p style={styles.foot}>
          Связанные модули: <a href="/qrenew" style={styles.link}>QRenew</a> (биовозраст) · <a href="/qmelanin" style={styles.link}>QMelanin</a> (пигмент, Zn:Cu) · <a href={keepChannel("/shop", channel)} style={styles.link}>магазин</a>.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070b14", color: "#e8eef6", padding: "48px 20px" },
  wrap: { maxWidth: 880, margin: "0 auto" },
  eyebrow: { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#35c9b3" },
  h1: { fontSize: 32, margin: "10px 0 0", fontWeight: 700, lineHeight: 1.2 },
  lede: { color: "#9fb0c4", marginTop: 14, lineHeight: 1.6, maxWidth: 660 },
  card: { background: "#0d1422", border: "1px solid #1c2942", borderRadius: 16, padding: 24, marginTop: 26 },
  h2: { fontSize: 20, margin: "0 0 6px" },
  sub: { color: "#8b9bb0", fontSize: 13.5, margin: "0 0 16px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 13, color: "#c3d0e0" },
  unit: { color: "#6c7d92", fontSize: 11 },
  input: { background: "#0a101c", border: "1px solid #24344f", borderRadius: 8, padding: "9px 11px", color: "#e8eef6", fontSize: 14, width: "100%" },
  flags: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 },
  flagChip: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#c3d0e0", background: "#0a101c", border: "1px solid #24344f", borderRadius: 8, padding: "6px 11px", cursor: "pointer" },
  btn: { marginTop: 20, background: "#35c9b3", color: "#04120f", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  error: { color: "#e0787f", marginTop: 12 },
  result: { marginTop: 20 },
  blockTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6c7d92", margin: "18px 0 10px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  flaggedChip: { fontSize: 13, background: "#2a1616", border: "1px solid #6b2f2f", borderRadius: 8, padding: "6px 11px", color: "#f0c9c9" },
  domain: { marginTop: 8 },
  domainLabel: { fontSize: 14, fontWeight: 600, color: "#c3d0e0", margin: "12px 0 6px" },
  stackItem: { display: "flex", gap: 12, alignItems: "flex-start", background: "#0a101c", border: "1px solid #1c2942", borderRadius: 10, padding: 12, marginTop: 8 },
  gradeChip: { fontFamily: "monospace", fontSize: 12, fontWeight: 700, border: "1px solid", borderRadius: 6, padding: "1px 8px", flexShrink: 0, marginTop: 2 },
  stackName: { fontWeight: 600, fontSize: 14.5 },
  targeted: { fontFamily: "monospace", fontSize: 11, color: "#35c9b3", marginLeft: 6 },
  stackNote: { fontSize: 12.5, color: "#8b9bb0", marginTop: 3 },
  gated: { marginTop: 6 },
  gatedItem: { fontSize: 13, color: "#c9b78b", background: "#221c10", border: "1px solid #4a3d1a", borderRadius: 8, padding: "8px 11px", marginTop: 8 },
  timeline: { display: "flex", flexDirection: "column", gap: 8 },
  phase: { display: "flex", gap: 14, alignItems: "flex-start", background: "#0a101c", border: "1px solid #1c2942", borderRadius: 10, padding: 12 },
  phaseWeek: { fontFamily: "monospace", fontSize: 12, color: "#35c9b3", minWidth: 62, flexShrink: 0 },
  phaseTitle: { fontWeight: 600, fontSize: 14 },
  phaseDetail: { fontSize: 12.5, color: "#8b9bb0", marginTop: 2 },
  info: { marginTop: 6 },
  infoItem: { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#9fb0c4", marginTop: 8 },
  disclaimer: { marginTop: 18, fontSize: 12.5, color: "#8b9bb0", borderTop: "1px solid #1c2942", paddingTop: 14 },
  progGrid: { display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, alignItems: "center" },
  progHead: { fontSize: 11.5, color: "#6c7d92", textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 4 },
  progLabel: { fontSize: 13, color: "#c3d0e0" },
  scoreRow: { display: "flex", alignItems: "center", gap: 18 },
  scoreNum: { fontSize: 46, fontWeight: 700, lineHeight: 1, fontFamily: "monospace" },
  scorePct: { fontSize: 22 },
  scoreCap: { fontSize: 13, color: "#c3d0e0" },
  scoreTraj: { fontSize: 15, fontWeight: 700, marginTop: 2 },
  bioInterp: { marginTop: 14, color: "#c3d0e0", lineHeight: 1.6 },
  metrics: { marginTop: 16, display: "flex", flexDirection: "column", gap: 6 },
  metricRow: { display: "flex", alignItems: "center", gap: 10, background: "#0a101c", border: "1px solid #1c2942", borderRadius: 8, padding: "8px 12px" },
  metricName: { fontSize: 13, color: "#c3d0e0", flex: 1 },
  metricVals: { fontFamily: "monospace", fontSize: 13, color: "#9fb0c4" },
  metricArrow: { fontFamily: "monospace", fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: "right" },
  panelGroup: { marginTop: 14 },
  panelGroupName: { fontSize: 13, fontWeight: 600, color: "#35c9b3", margin: "10px 0 6px" },
  panelRow: { display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid #141d30" },
  panelInfo: { flex: 1 },
  panelName: { fontSize: 14, fontWeight: 500 },
  panelTarget: { fontFamily: "monospace", fontSize: 12, color: "#35c9b3", marginLeft: 6 },
  panelShows: { fontSize: 12.5, color: "#8b9bb0", marginTop: 2 },
  foot: { marginTop: 26, color: "#8b9bb0", fontSize: 14 },
  link: { color: "#35c9b3" },
  buyCard: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    background: "linear-gradient(135deg,#0f1a2c 0%,#0d1422 100%)",
    border: "1px solid #2a3f5f",
    borderRadius: 16,
    padding: 24,
    marginTop: 26,
    textDecoration: "none",
    color: "#e8eef6",
  },
  buyLeft: { flex: "1 1 320px", minWidth: 0 },
  buyKicker: {
    fontFamily: "monospace",
    fontSize: 11.5,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#35c9b3",
  },
  buyTitle: { fontSize: 19, fontWeight: 700, margin: "8px 0 0" },
  buyDesc: { color: "#9fb0c4", fontSize: 13.5, lineHeight: 1.55, margin: "8px 0 0" },
  buyRight: { display: "flex", alignItems: "center", gap: 14, flexShrink: 0 },
  buyPrice: { fontSize: 24, fontWeight: 700 },
  buyBtn: {
    background: "#35c9b3",
    color: "#06231f",
    borderRadius: 10,
    padding: "11px 20px",
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  // Вторая карточка намеренно ТИШЕ первой: одинаковый вид двух предложений
  // подряд читается как стена продаж, и человек уходит от обеих.
  upsellCard: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    background: "#0c1320",
    border: "1px solid #24344c",
    borderRadius: 16,
    padding: 22,
    marginTop: 12,
    textDecoration: "none",
    color: "#dbe5f0",
  },
  upsellKicker: {
    fontFamily: "monospace",
    fontSize: 11.5,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#7f9bc0",
  },
  upsellPer: { fontSize: 14, fontWeight: 500, color: "#8b9bb0" },
  upsellBtn: {
    background: "transparent",
    color: "#9fd8ce",
    border: "1px solid #35c9b3",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  noDataWarning: {
    border: "1px solid #fbbf24", background: "#fffbeb", color: "#78350f",
    borderRadius: 10, padding: "12px 14px", marginBottom: 16,
    fontSize: 14, lineHeight: 1.55,
  }
};
