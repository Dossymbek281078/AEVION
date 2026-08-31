"use client";

import { channelNow } from "@/lib/channelNow";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { channelFrom, withChannel } from "@/lib/products";
import ModulePricingChip from "@/components/ModulePricingChip";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";

// QMelanin — anti-graying protocol. Enter routine labs → the deterministic
// backend engine flags deficiencies that gate melanin synthesis and returns a
// food-first protocol with nutrient-interaction rules. Honest framing: wellness,
// not a medical device; visual pigment change (if any) needs ≥6 months.

interface Biomarker {
  key: string;
  label: string;
  unit: string;
  optimalLow: number;
  placeholder: string;
}

const BIOMARKERS: Biomarker[] = [
  { key: "ferritin", label: "Ферритин", unit: "нг/мл", optimalLow: 40, placeholder: "напр. 30" },
  { key: "b12", label: "Витамин B12", unit: "пг/мл", optimalLow: 400, placeholder: "напр. 350" },
  { key: "folate", label: "Фолат", unit: "нг/мл", optimalLow: 5, placeholder: "напр. 6" },
  { key: "vitaminD", label: "Витамин D (25-OH)", unit: "нг/мл", optimalLow: 30, placeholder: "напр. 25" },
  { key: "copper", label: "Медь", unit: "мкг/дл", optimalLow: 80, placeholder: "напр. 75" },
  { key: "zinc", label: "Цинк", unit: "мкг/дл", optimalLow: 80, placeholder: "напр. 90" },
  { key: "selenium", label: "Селен", unit: "мкг/л", optimalLow: 90, placeholder: "напр. 100" },
  { key: "tsh", label: "ТТГ", unit: "мЕд/л", optimalLow: 0.4, placeholder: "напр. 1.8" },
];

interface Interaction { rule: string; why: string; }
interface Targeted { nutrient: string; key: string; role: string; foods: string[]; }
interface FoundationBlock { block: string; foods: string[]; }
interface Plan {
  summary: string;
  /** Персональный план или общий. Общий выдаётся, когда человек не ввёл ни
   *  одного значения — раньше он был неотличим от «проверили, дефицитов нет». */
  personalised?: boolean;
  warning?: string;
  targeted: Targeted[];
  foundation: FoundationBlock[];
  interactions: Interaction[];
  schedule: { durationDays: number; retestInDays: number; visualEndpointInDays: number; note: string };
  disclaimer: string;
}

interface DayPlan {
  breakfast?: string[];
  lunch?: string[];
  dinner?: string[];
  snack?: string[];
  note?: string;
}
interface AiPlan {
  source: "ai" | "deterministic-fallback";
  model?: string;
  dayPlan: DayPlan;
  guardrail?: string;
  disclaimer: string;
}

export default function QMelaninClient() {
  // Метка канала для ссылок в кассу. Ролики ведут именно сюда, поэтому
  // потеря метки на этой странице стоит дороже всего: покупка приходит
  // как пришедшая ниоткуда. Держится в состоянии и заполняется после
  // отрисовки — на сервере адреса ещё нет, и чтение из window разошлось
  // бы с серверной разметкой.
  const [channel, setChannel] = useState<string | null>(null);
  useEffect(() => {
    setChannel(channelNow());
  }, []);
  const [values, setValues] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function setVal(k: string, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  async function buildDayMenu() {
    setAiLoading(true);
    try {
      const numeric: Record<string, number> = {};
      for (const [k, v] of Object.entries(values)) {
        const n = parseFloat(v);
        if (Number.isFinite(n)) numeric[k] = n;
      }
      const res = await fetch(apiUrl("/api/qmelanin/ai-plan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: numeric }),
      });
      if (res.ok) setAiPlan((await res.json()) as AiPlan);
    } catch {
      /* AI-раскладка опциональна; детерминированный протокол выше остаётся источником истины */
    } finally {
      setAiLoading(false);
    }
  }

  async function buildPlan() {
    setLoading(true);
    setError(null);
    try {
      const numeric: Record<string, number> = {};
      for (const [k, v] of Object.entries(values)) {
        const n = parseFloat(v);
        if (Number.isFinite(n)) numeric[k] = n;
      }
      const res = await fetch(apiUrl("/api/qmelanin/plan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: numeric }),
      });
      if (!res.ok) throw new Error(`Сервер вернул ${res.status}`);
      setPlan((await res.json()) as Plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось построить план");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · QMelanin</div>
        <h1 style={styles.h1}>Протокол против седины</h1>
        <HealthDisclaimer />
        <p style={styles.lede}>
          Седину нельзя измерить анализом напрямую — поэтому мы измеряем биомаркеры, которые управляют
          синтезом меланина, и строим питание на доступных продуктах с учётом взаимодействия нутриентов.
          Введите свои анализы (что есть) — движок отметит дефициты и соберёт протокол.
        </p>
        <div style={{ marginTop: 14 }}>
          <ModulePricingChip moduleId="qmelanin" theme="dark" />
        </div>

        <div style={styles.buyRow}>
          <a
            href={withChannel("https://aevion.gumroad.com/l/tmuyxw", channel, "qmelanin-ru")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track({ type: "checkout_start", source: "qmelanin/ru", value: 9, meta: { permalink: "tmuyxw", processor: "gumroad" } })}
            style={{ ...styles.buyCard, flex: 1, minWidth: 280, marginTop: 0 }}
          >
            <span>
              <span style={styles.buyTitle}>🇷🇺 Гайд «Протокол Анти-седина» (PDF)</span>
              <span style={styles.buySub}>
                Вся наука без хайпа: почему волос седеет, какие рычаги реально работают
                (медь/цинк, спермидин, окислительный стресс) и 12-недельный план. Wellness, не медицина.
              </span>
            </span>
            <span style={styles.buyBtn}>Получить за&nbsp;$9&nbsp;→</span>
          </a>
          <a
            href={withChannel("https://aevion.gumroad.com/l/kkiavh", channel, "qmelanin-en")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track({ type: "checkout_start", source: "qmelanin/en", value: 19, meta: { permalink: "kkiavh", processor: "gumroad" } })}
            style={{ ...styles.buyCard, flex: 1, minWidth: 280, marginTop: 0 }}
          >
            <span>
              <span style={styles.buyTitle}>🇬🇧 The Anti-Grey Protocol (PDF, English)</span>
              <span style={styles.buySub}>
                Same protocol, English edition: why hair greys, which levers actually work
                (copper/zinc, spermidine, oxidative stress) and the 12-week plan. Wellness, not medicine.
              </span>
            </span>
            <span style={styles.buyBtn}>Get for&nbsp;$19&nbsp;→</span>
          </a>
        </div>

        <section style={styles.card}>
          <h2 style={styles.h2}>Ваши анализы</h2>
          <div style={styles.grid}>
            {BIOMARKERS.map((b) => (
              <label key={b.key} style={styles.field}>
                <span style={styles.fieldLabel}>
                  {b.label} <span style={styles.unit}>{b.unit}</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={b.placeholder}
                  value={values[b.key] ?? ""}
                  onChange={(e) => setVal(b.key, e.target.value)}
                  style={styles.input}
                />
                <span style={styles.optimal}>оптимум ≥ {b.optimalLow}</span>
              </label>
            ))}
          </div>
          <button onClick={buildPlan} disabled={loading} style={styles.btn}>
            {loading ? "Собираю протокол…" : "Построить протокол"}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </section>

        {plan && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Ваш 90-дневный протокол</h2>
            {/* Бэкенд с 20.08.2026 отличает персональный план от общего.
                До этой вставки страница показывала оба одинаково, и человек с
                пустой формой читал сводку как результат проверки. */}
            {plan.personalised === false && plan.warning && (
              <div role="alert" style={styles.noDataWarning}>
                <b>План общий, не персональный.</b> {plan.warning}
              </div>
            )}
            <p style={styles.summary}>{plan.summary}</p>

            {plan.targeted.length > 0 && (
              <>
                <h3 style={styles.h3}>Целевая коррекция дефицитов</h3>
                {plan.targeted.map((t) => (
                  <div key={t.key} style={styles.block}>
                    <div style={styles.blockTitle}>{t.nutrient}</div>
                    <div style={styles.blockRole}>{t.role}</div>
                    <div style={styles.foods}>
                      {t.foods.map((f) => (
                        <span key={f} style={styles.chip}>{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            <h3 style={styles.h3}>База (всем)</h3>
            {plan.foundation.map((fb) => (
              <div key={fb.block} style={styles.block}>
                <div style={styles.blockTitle}>{fb.block}</div>
                <div style={styles.foods}>
                  {fb.foods.map((f) => (
                    <span key={f} style={styles.chip}>{f}</span>
                  ))}
                </div>
              </div>
            ))}

            <h3 style={styles.h3}>Правила совместимости нутриентов</h3>
            <ul style={styles.rules}>
              {plan.interactions.map((it, i) => (
                <li key={i} style={styles.ruleItem}>
                  <b>{it.rule}</b>
                  <span style={styles.ruleWhy}>{it.why}</span>
                </li>
              ))}
            </ul>

            <div style={styles.schedule}>
              <b>Сроки.</b> Ретест биомаркеров через {plan.schedule.retestInDays} дней; оценка видимого
              пигмента — через {plan.schedule.visualEndpointInDays} дней. {plan.schedule.note}
            </div>

            <p style={styles.disclaimer}>{plan.disclaimer}</p>

            <div style={styles.aiBar}>
              <button onClick={buildDayMenu} disabled={aiLoading} style={styles.btnGhost}>
                {aiLoading ? "AI собирает меню дня…" : "AI-раскладка на день"}
              </button>
              <span style={styles.aiHint}>
                AI только распределяет те же продукты по приёмам с учётом совместимости — дозы и добавки не назначает.
              </span>
            </div>
          </section>
        )}

        {aiPlan && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Меню на день {aiPlan.source === "ai" ? "(AI)" : "(детерминированное)"}</h2>
            {(["breakfast", "lunch", "dinner", "snack"] as const).map((meal) => {
              const items = aiPlan.dayPlan[meal];
              if (!items || items.length === 0) return null;
              const title = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" }[meal];
              return (
                <div key={meal} style={styles.block}>
                  <div style={styles.blockTitle}>{title}</div>
                  <div style={styles.foods}>
                    {items.map((f, i) => (
                      <span key={`${f}-${i}`} style={styles.chip}>{f}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {aiPlan.dayPlan.note && <p style={styles.summary}>{aiPlan.dayPlan.note}</p>}
            {aiPlan.model && <p style={styles.method}>Модель: {aiPlan.model}. {aiPlan.guardrail}</p>}
            <p style={styles.disclaimer}>{aiPlan.disclaimer}</p>
          </section>
        )}

        <p style={styles.foot}>
          <a href="/qmelanin/track" style={styles.link}>Дневник седины →</a> · фотофиксация и недельный тренд.
        </p>
        <p style={styles.foot}>
          Связанный модуль: <a href="/qrenew" style={styles.link}>QRenew</a> — программа клеточного
          обновления, где седина рассматривается как видимый биомаркер общего старения.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070b14", color: "#e8eef6", padding: "48px 20px" },
  wrap: { maxWidth: 860, margin: "0 auto" },
  eyebrow: { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c8823f" },
  h1: { fontSize: 34, margin: "10px 0 0", fontWeight: 700 },
  lede: { color: "#9fb0c4", marginTop: 14, lineHeight: 1.6, maxWidth: 640 },
  buyRow: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 },
  buyCard: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", background: "#0d1422", border: "1px solid #c8823f", borderRadius: 16, padding: "18px 22px", marginTop: 16, textDecoration: "none", color: "#e8eef6" },
  buyTitle: { display: "block", fontSize: 16, fontWeight: 700 },
  buySub: { display: "block", fontSize: 13, color: "#9fb0c4", marginTop: 5, maxWidth: 470, lineHeight: 1.5 },
  buyBtn: { background: "#c8823f", color: "#0a0a0a", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" },
  card: { background: "#0d1422", border: "1px solid #1c2942", borderRadius: 16, padding: 24, marginTop: 26 },
  h2: { fontSize: 20, margin: "0 0 16px" },
  h3: { fontSize: 15, margin: "22px 0 10px", color: "#c8823f" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 13, color: "#c3d0e0" },
  unit: { color: "#6c7d92", fontSize: 11 },
  input: { background: "#0a101c", border: "1px solid #24344f", borderRadius: 8, padding: "9px 11px", color: "#e8eef6", fontSize: 14 },
  optimal: { fontSize: 11, color: "#6c7d92", fontFamily: "monospace" },
  btn: { marginTop: 20, background: "#c8823f", color: "#0a0a0a", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  error: { color: "#e0787f", marginTop: 12 },
  summary: { color: "#c3d0e0", lineHeight: 1.6 },
  noDataWarning: {
    border: "1px solid #fbbf24", background: "#fffbeb", color: "#78350f",
    borderRadius: 10, padding: "12px 14px", marginBottom: 16,
    fontSize: 14, lineHeight: 1.55,
  },
  block: { background: "#0a101c", border: "1px solid #1c2942", borderRadius: 12, padding: 14, marginTop: 10 },
  blockTitle: { fontWeight: 600 },
  blockRole: { fontSize: 12, color: "#8b9bb0", marginTop: 2 },
  foods: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { fontFamily: "monospace", fontSize: 12, background: "#13203a", border: "1px solid #24344f", borderRadius: 7, padding: "4px 9px", color: "#c3d0e0" },
  rules: { listStyle: "none", padding: 0, margin: 0 },
  ruleItem: { padding: "10px 0", borderBottom: "1px dashed #1c2942", display: "flex", flexDirection: "column", gap: 3, fontSize: 14 },
  ruleWhy: { color: "#8b9bb0", fontSize: 12.5 },
  schedule: { marginTop: 18, background: "#13203a", borderRadius: 12, padding: 14, fontSize: 13.5, color: "#c3d0e0", lineHeight: 1.6 },
  disclaimer: { marginTop: 16, fontSize: 12.5, color: "#8b9bb0", borderTop: "1px solid #1c2942", paddingTop: 14 },
  foot: { marginTop: 20, color: "#8b9bb0", fontSize: 14 },
  link: { color: "#c8823f" },
  aiBar: { marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #1c2942", paddingTop: 16 },
  aiHint: { fontSize: 12.5, color: "#8b9bb0", flex: "1 1 240px" },
  btnGhost: { background: "transparent", color: "#c8823f", border: "1px solid #c8823f", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  method: { marginTop: 12, fontSize: 12.5, color: "#8b9bb0", fontFamily: "monospace" },
};
