"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import ModulePricingChip from "@/components/ModulePricingChip";
import ModuleStatusNote from "./ModuleStatusNote";
import { apiUrl } from "@/lib/apiBase";
import paper from "@/styles/aevionPaper.module.css";
import {
  ResultView, ScoreGauge, STAGES, STAGE_LABEL, VERDICT_COLOR, VERDICT_LABEL,
  SECTION, H2, SERIF, type AnalysisResult, type Verdict,
} from "./_result";

interface SectorOption { id: string; label: string; }

// One-click showcase: a realistic seed-stage opportunity so a first-time
// visitor sees a full memo without typing anything.
const SAMPLE = {
  name: "NeuroDx",
  sector: "healthtech",
  stage: "seed" as (typeof STAGES)[number],
  geography: "US",
  askUsd: "6,000,000",
  description:
    "FDA-pathway diagnostic that detects early-stage Alzheimer's from a standard retinal scan using a self-supervised vision model, turning any optometrist's chair into a screening point years before symptom onset.",
  tractionNotes:
    "$55k MRR across 14 clinics growing 22% MoM, breakthrough-device designation filed, 89% sensitivity vs PET baseline in a 1,200-patient cohort, LTV/CAC 5.1x.",
};

type FormShape = {
  name: string; sector: string; stage: (typeof STAGES)[number];
  geography: string; askUsd: string; description: string; tractionNotes: string;
  // Optional exact financials — override the text parser for precise scoring.
  finArr: string; finGrossMargin: string; finLtvCac: string; finChurn: string;
  // Churn only means something with its period: 4%/mo and 4%/yr are different companies.
  finChurnPeriod: "weekly" | "monthly" | "quarterly" | "annual";
  finCustomers: string; finGrowth: string; finGrowthPeriod: "WoW" | "MoM" | "YoY"; finTam: string;
  // Optional 3-year revenue projection (this year, +1, +2).
  projY0: string; projY1: string; projY2: string;
};
const emptyForm = (): FormShape => ({
  name: "", sector: "ai_app", stage: "seed", geography: "US", askUsd: "", description: "", tractionNotes: "",
  finArr: "", finGrossMargin: "", finLtvCac: "", finChurn: "", finChurnPeriod: "monthly",
  finCustomers: "", finGrowth: "", finGrowthPeriod: "MoM", finTam: "",
  projY0: "", projY1: "", projY2: "",
});

const INPUT: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 4, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", background: "var(--card, #fffefb)", color: "var(--ink, #17181a)" };
const LABEL: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-faint, #74767c)", marginBottom: 5 };

// Pure request helper — returns the analysis or an error string, no state.
async function analyzeReq(data: FormShape): Promise<{ ok: true; data: AnalysisResult } | { ok: false; error: string; upgradeUrl?: string | null }> {
  if (!data.name.trim()) return { ok: false, error: "Укажите название компании или продукта." };
  if (data.description.trim().length < 12) return { ok: false, error: "Добавьте описание подробнее — не меньше 12 знаков." };
  try {
    const payload: Record<string, unknown> = {
      name: data.name.trim(), sector: data.sector, stage: data.stage,
      geography: data.geography.trim() || "US", description: data.description.trim(),
      tractionNotes: data.tractionNotes.trim() || undefined,
    };
    const ask = parseFloat(data.askUsd.replace(/[^0-9.]/g, ""));
    if (isFinite(ask) && ask > 0) payload.askUsd = ask;

    // Optional exact financials → override the text parser.
    const num = (s: string) => { const v = parseFloat((s || "").replace(/[^0-9.]/g, "")); return isFinite(v) && v > 0 ? v : undefined; };
    const financials: Record<string, number> = {};
    const map: [string, string][] = [
      ["arrUsd", data.finArr], ["grossMarginPct", data.finGrossMargin], ["ltvCacRatio", data.finLtvCac],
      ["churnPct", data.finChurn], ["customers", data.finCustomers], ["growthPct", data.finGrowth], ["bottomUpTamUsd", data.finTam],
    ];
    for (const [k, v] of map) { const n = num(v); if (n !== undefined) financials[k] = n; }
    if (Object.keys(financials).length) {
      // Periods travel with their figures — without them the engine has to assume.
      const withPeriods: Record<string, unknown> = { ...financials };
      if (financials.churnPct !== undefined) withPeriods.churnPeriod = data.finChurnPeriod;
      if (financials.growthPct !== undefined) withPeriods.growthPeriod = data.finGrowthPeriod;
      payload.financials = withPeriods;
    }

    // Optional 3-year projection.
    const y0 = new Date().getFullYear();
    const proj = [data.projY0, data.projY1, data.projY2]
      .map((v, i) => ({ year: y0 + i, revenueUsd: num(v) }))
      .filter((p) => p.revenueUsd !== undefined)
      .map((p) => ({ year: p.year, revenueUsd: p.revenueUsd as number }));
    if (proj.length >= 2) payload.projections = proj;

    const res = await fetch(apiUrl("/api/qventure/analyze"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok || !j?.ok) {
      // Сервер уже прислал ГОТОВЫЙ текст для человека и ссылку на оплату —
      // берём их, а не машинный код. Прежняя строка брала j.error, и в день
      // включения платной стены человек прочитал бы на экране слово
      // "upgrade_required", а ссылка upgradeUrl, по которой он мог бы
      // заплатить, была бы выброшена. Замер 31.08.2026: у ответа 402 из
      // planGate есть поля message (по-русски) и upgradeUrl, и оба терялись.
      const human =
        (typeof j?.message === "string" && j.message) ||
        (typeof j?.error === "string" && j.error) ||
        "Не удалось выполнить разбор.";
      const url = typeof j?.upgradeUrl === "string" ? j.upgradeUrl : null;
      return { ok: false, error: human, upgradeUrl: url };
    }
    return { ok: true, data: j.data as AnalysisResult };
  } catch {
    // Не спрашиваем человека, запущен ли бэкенд: это вопрос к нам, а не к
    // нему, и на экране покупателя ему не место.
    return { ok: false, error: "Не удалось связаться с сервером. Попробуйте ещё раз." };
  }
}

export default function QVenturePage() {
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [mode, setMode] = useState<"single" | "compare">("single");

  useEffect(() => {
    fetch(apiUrl("/api/qventure/sectors"))
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.data)) setSectors(j.data); })
      .catch(() => { /* non-fatal — dropdown falls back to empty */ });
  }, []);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
       <div className={paper.paper} style={{ background: "transparent", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <ModulePricingChip moduleId="qventure" theme="light" />
          <ModuleStatusNote moduleId="qventure" />
        </div>

        {/* Masthead — newspaper treatment: kicker rule, serif headline. */}
        <div style={{ borderTop: "3px solid var(--rule-bold, #17181a)", paddingTop: 14, marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep, #075b53)", letterSpacing: "0.32em", textTransform: "uppercase" }}>AEVION · QVenture</div>
          <h1 style={{ margin: "8px 0 10px", fontFamily: SERIF, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink, #17181a)", lineHeight: 1.1 }}>
            ИИ-аналитик инвестиций для любого бизнеса
          </h1>
          <p style={{ margin: 0, fontSize: 15.5, color: "var(--ink-soft, #45474c)", maxWidth: 760, lineHeight: 1.55 }}>
            Проверка сделки уровня фонда за секунды. Прозрачная количественная оценка, совет из четырёх ролей
            (учёный · аналитик данных · экономист · юрист) и конкретная стратегия входа — сколько
            вложить, по какой оценке, какими этапами и с какой доходностью с поправкой на риск.
          </p>
          <Link href="/qventure/a/demo-neurodx" style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
            fontSize: 14, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none",
            borderBottom: "1px solid color-mix(in srgb, var(--teal, #0a7d72) 45%, transparent)",
          }}>
            Живой пример → <span style={{ fontWeight: 400, color: "var(--ink-faint, #74767c)" }}>(разбор NeuroDx)</span>
          </Link>
        </div>

        {/* Mode switch + watchlist link */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--paper-2, #efeee8)", borderRadius: 10 }}>
            {(["single", "compare"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} style={{
                padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13.5, fontWeight: 700,
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "var(--teal-deep, #075b53)" : "#64748b",
                boxShadow: mode === m ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
              }}>
                {m === "single" ? "Одна сделка" : "⚖ Сравнить две"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/qventure/batch" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ☰ Разбор пачкой →
            </Link>
            <Link href="/qventure/gallery" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ▦ Примеры →
            </Link>
            <Link href="/qventure/watchlist" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ★ Список наблюдения →
            </Link>
          </div>
        </div>

        {mode === "single"
          ? <SinglePanel sectors={sectors} />
          : <ComparePanel sectors={sectors} />}

        <MarketingSections />
       </div>
      </ProductPageShell>
    </>
  );
}

// ─── Marketing block ──────────────────────────────────────────────────────────

function MarketingSections() {
  const steps = [
    { icon: "📝", title: "Опишите сделку", body: "Компания, отрасль, стадия и абзац о том, что она делает. Показатели роста необязательны, но уточняют оценку исполнения." },
    { icon: "🧠", title: "ИИ проводит разбор", body: "Детерминированная оценка 0–100 по восьми факторам, затем совет из четырёх ролей пишет записку и стратегию входа." },
    { icon: "📊", title: "Действуйте по записке", body: "Вердикт, размер чека, диапазон оценки, этапы траншей и доходность с поправкой на риск — выгрузка в PDF, сохранение, ссылка." },
  ];
  const audience = [
    { icon: "👼", label: "Бизнес-ангелы", body: "Отсеивайте входящий поток за секунды и пишите по существу, а не по ощущениям." },
    { icon: "🏦", label: "Микрофонды и одиночные управляющие", body: "Одна повторяемая рубрика на все сделки в работе." },
    { icon: "🔭", label: "Скауты", body: "Превратите разговор с основателем в записку уровня фонда, которой можно поделиться." },
    { icon: "🤝", label: "Синдикаты", body: "Сведите группу к одной прозрачной оценке и стратегии." },
  ];
  const trust = [
    ["Детерминированно", "Оценка — воспроизводимый расчёт, а не чёрный ящик."],
    ["18 отраслей", "Опирается на выверенную базу знаний о рынке."],
    ["4 эксперта", "Учёный · аналитик данных · экономист · юрист."],
    ["Прозрачно", "У каждого фактора виден его вес и обоснование."],
  ];
  return (
    <div style={{ marginTop: 28 }}>
      <div style={SECTION}>
        <h2 style={H2}>Как это работает</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ padding: "4px 4px" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal-deep, #075b53)" }}>ШАГ {i + 1}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink, #17181a)", margin: "2px 0 6px" }}>{s.title}</div>
              <p style={{ margin: 0, fontSize: 13.5, color: "#475569", lineHeight: 1.5 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Кому подходит</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {audience.map((a, i) => (
            <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink, #17181a)" }}>{a.label}</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...SECTION, background: "var(--ink, #17181a)", borderColor: "transparent" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {trust.map(([k, v], i) => (
            <div key={i}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--teal, #0a7d72)" }}>{k}</div>
              <div style={{ fontSize: 12.5, color: "#cbd5e1", marginTop: 3, lineHeight: 1.4 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 11.5, color: "#94a3b8" }}>
          QVenture — инструмент ИИ-отбора для исследовательских целей: это не инвестиционный совет, не оферта и не предложение. Числа — оценки модели, а не гарантии.
          {" "}
          {/* Доступ выдаётся по почте подписки: planGate спрашивает
              hasActiveAppSubscription(plan.email, "qventure"), а plan.email берётся
              из токена входа. Модуль при этом работает и анонимно, поэтому
              человек может оплатить подписку и не связать покупку с собой —
              сегодня это незаметно (платная стена включена у 6 модулей из 43,
              QVenture среди них нет), но включение стены и есть запуск.
              Строка на языке окружающего блока: язык интерфейса модуля —
              открытый вопрос к основателю, и вводить второй язык внутри
              одного абзаца хуже, чем следовать соседнему тексту. */}
          Платный доступ привязан к адресу почты в подписке — после оплаты входите с тем же
          адресом, иначе разборы останутся на бесплатном тарифе.
        </div>
      </div>
    </div>
  );
}

// ─── Single analysis ──────────────────────────────────────────────────────────

function SinglePanel({ sectors }: { sectors: SectorOption[] }) {
  const [form, setForm] = useState<FormShape>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ссылка на оплату приходит в отказе 402 вместе с текстом. Без неё человек
  // читает, что модуль платный, и не знает, куда идти платить.
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const set = (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = useCallback(async (data: FormShape) => {
    setError(null); setUpgradeUrl(null); setLoading(true); setResult(null);
    const r = await analyzeReq(data);
    if (r.ok) { setResult(r.data); } else { setError(r.error); setUpgradeUrl(r.upgradeUrl ?? null); }
    setLoading(false);
  }, []);

  const runSample = useCallback(() => {
    const s: FormShape = { ...emptyForm(), ...SAMPLE };
    setForm(s);
    run(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [run]);

  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDeckFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-selected later
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setExtractNote("Загрузите презентацию в формате PDF."); return;
    }
    setExtracting(true); setError(null); setExtractNote(null);
    try {
      const res = await fetch(apiUrl("/api/qventure/extract"), {
        method: "POST", headers: { "Content-Type": "application/pdf" }, body: file,
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setExtractNote(j?.hint || j?.error || "Не удалось разобрать презентацию — заполните поля вручную."); return; }
      const d = j.data;
      const fin = d.financials || {};
      const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? String(v) : "");
      const proj: Array<{ year: number; revenueUsd: number }> = Array.isArray(d.projections) ? d.projections : [];
      const projRev = (i: number) => (proj[i] && isFinite(proj[i].revenueUsd) ? String(proj[i].revenueUsd) : "");
      setForm({
        ...emptyForm(),
        name: d.name || "",
        sector: d.sector || "ai_app",
        stage: ((STAGES as readonly string[]).includes(d.stage) ? d.stage : "seed") as FormShape["stage"],
        geography: d.geography || "US",
        askUsd: d.askUsd ? String(d.askUsd) : "",
        description: d.description || "",
        tractionNotes: d.tractionNotes || "",
        finArr: num(fin.arrUsd),
        finGrossMargin: num(fin.grossMarginPct),
        finLtvCac: num(fin.ltvCacRatio),
        finChurn: num(fin.churnPct),
        // Keep the period the deck stated; only fall back to the default when it said nothing.
        finChurnPeriod: (["weekly", "monthly", "quarterly", "annual"].includes(fin.churnPeriod) ? fin.churnPeriod : "monthly") as FormShape["finChurnPeriod"],
        finCustomers: num(fin.customers),
        finGrowth: num(fin.growthPct),
        finGrowthPeriod: (["WoW", "MoM", "YoY"].includes(fin.growthPeriod) ? fin.growthPeriod : "MoM") as FormShape["finGrowthPeriod"],
        finTam: num(fin.bottomUpTamUsd),
        projY0: projRev(0),
        projY1: projRev(1),
        projY2: projRev(2),
      });
      const gotExact = Object.values(fin).some((v) => typeof v === "number" && v) || proj.length > 0;
      setExtractNote(
        (d.aiUsed
          ? "✓ Заполнено по вашей презентации (разобрано ИИ). "
          : "✓ Заполнено по вашей презентации (разобрано по тексту). ") +
          (gotExact ? "Точные финансовые данные заполнены ниже — проверьте и запускайте разбор." : "Проверьте поля и запускайте разбор."),
      );
    } catch {
      setExtractNote("Загрузить не удалось — проверьте связь и попробуйте ещё раз.");
    } finally {
      setExtracting(false);
    }
  }, []);

  return (
    <>
      <div style={SECTION}>
        <h2 style={H2}>Разбор сделки</h2>
        <div style={{ border: "1px dashed var(--rule-mid, #b9b8b0)", background: "var(--paper-2, #efeee8)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onDeckFile} style={{ display: "none" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={extracting || loading} style={{
            padding: "10px 18px", background: extracting ? "var(--teal, #0a7d72)" : "var(--teal-deep, #075b53)", color: "#fff", border: "none",
            borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: extracting ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
            {extracting ? "Читаем презентацию…" : "📄 Загрузить презентацию (PDF)"}
          </button>
          <span style={{ fontSize: 12.5, color: extractNote ? "var(--teal-deep, #075b53)" : "#94a3b8", fontWeight: extractNote ? 600 : 400 }}>
            {extractNote || "Мы вытащим поля и заполним форму — вы проверяете и запускаете."}
          </span>
        </div>
        <FormFields form={form} set={set} sectors={sectors} full />
        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
            {error}
            {/* Ссылка приходит в отказе 402 вместе с текстом. Без неё человек
                читает, что модуль платный, и не знает, куда идти платить —
                тупик ровно в том месте, где он готов заплатить. */}
            {upgradeUrl && (
              <>
                {" "}
                <a href={upgradeUrl} style={{ color: "#dc2626", fontWeight: 700, textDecoration: "underline" }}>
                  Посмотреть тарифы
                </a>
              </>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => run(form)} disabled={loading} style={primaryBtn(loading)}>
            {loading ? "Разбираем…" : "Разобрать"}
          </button>
          <button onClick={runSample} disabled={loading} type="button" style={ghostBtn(loading)}>
            ✨ Показать пример разбора
          </button>
          <span style={{ fontSize: 12.5, color: "#94a3b8" }}>Ничего вводить не нужно — загрузим настоящий пример стадии посева.</span>
        </div>
      </div>
      {result && <ResultView result={result} />}
    </>
  );
}

// ─── Compare two ──────────────────────────────────────────────────────────────

function ComparePanel({ sectors }: { sectors: SectorOption[] }) {
  const [a, setA] = useState<FormShape>(() => ({ ...emptyForm(), name: "Компания А" }));
  const [b, setB] = useState<FormShape>(() => ({ ...emptyForm(), name: "Компания Б" }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Своё состояние: это отдельный компонент, у него нет доступа к первому.
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [pair, setPair] = useState<[AnalysisResult, AnalysisResult] | null>(null);

  const setter = (which: "a" | "b") => (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const upd = (f: FormShape) => ({ ...f, [k]: e.target.value });
    if (which === "a") setA(upd); else setB(upd);
  };

  const run = useCallback(async () => {
    setError(null); setUpgradeUrl(null); setLoading(true); setPair(null);
    const [ra, rb] = await Promise.all([analyzeReq(a), analyzeReq(b)]);
    // Ссылку на оплату теряли и здесь: текст брался человеческий, а путь,
    // куда идти платить, выбрасывался. Одна и та же мера обязана стоять на
    // ОБЕИХ поверхностях — правка только на первой выглядит законченной.
    if (!ra.ok) { setError(`Company A: ${ra.error}`); setUpgradeUrl(ra.upgradeUrl ?? null); setLoading(false); return; }
    if (!rb.ok) { setError(`Company B: ${rb.error}`); setUpgradeUrl(rb.upgradeUrl ?? null); setLoading(false); return; }
    setPair([ra.data, rb.data]);
    setLoading(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [a, b]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {([["a", a], ["b", b]] as const).map(([which, f]) => (
          <div key={which} style={SECTION}>
            <h2 style={H2}>{which === "a" ? "Компания А" : "Компания Б"}</h2>
            <FormFields form={f} set={setter(which)} sectors={sectors} />
          </div>
        ))}
      </div>
        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
            {error}
            {upgradeUrl && (
              <>
                {" "}
                <a href={upgradeUrl} style={{ color: "#dc2626", fontWeight: 700, textDecoration: "underline" }}>
                  Посмотреть тарифы
                </a>
              </>
            )}
          </div>
        )}
      <button onClick={run} disabled={loading} style={{ ...primaryBtn(loading), marginBottom: 18 }}>
        {loading ? "Разбираем оба…" : "⚖ Compare"}
      </button>
      {pair && <CompareResult a={pair[0]} b={pair[1]} />}
    </>
  );
}

function CompareResult({ a, b }: { a: AnalysisResult; b: AnalysisResult }) {
  const winner = a.composite === b.composite ? null : a.composite > b.composite ? "a" : "b";
  const head = (r: AnalysisResult, side: "a" | "b") => (
    <div style={{
      ...SECTION, flex: "1 1 300px", marginBottom: 0,
      borderColor: winner === side ? "var(--teal-deep, #075b53)" : "#e2e8f0",
      borderWidth: winner === side ? 2 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <h2 style={{ ...H2, marginBottom: 4 }}>{r.name}</h2>
          <div style={{ fontSize: 13, color: "#64748b" }}>{r.result.sector.label} · {r.result.stage}</div>
          {winner === side && <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal-deep, #075b53)", marginTop: 6 }}>◆ Оценка выше</div>}
        </div>
      </div>
      <div style={{ marginTop: 12 }}><ScoreGauge score={r.composite} verdict={r.verdict} size={104} /></div>
    </div>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        {head(a, "a")}
        {head(b, "b")}
      </div>
      <div style={{ marginBottom: 18 }}>
        <a
          href={apiUrl(`/api/qventure/compare/pdf?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", background: "#fff", color: "var(--teal-deep, #075b53)",
            border: "1px solid #ddd6fe", borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: "none",
          }}
        >
          ⬇ Export comparison to PDF
        </a>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Разница по факторам</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12 }}>
                <th style={{ padding: "6px 8px" }}>Фактор</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>{a.name}</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>{b.name}</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>Δ (B−A)</th>
              </tr>
            </thead>
            <tbody>
              {a.result.factors.map((fa) => {
                const fb = b.result.factors.find((x) => x.key === fa.key);
                const bs = fb ? fb.score : 0;
                const delta = bs - fa.score;
                const dColor = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#94a3b8";
                return (
                  <tr key={fa.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px", color: "var(--ink, #17181a)", fontWeight: 600 }}>{fa.label}
                      <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {Math.round(fa.weight * 100)}%</span></td>
                    <td style={{ padding: "8px", textAlign: "center", color: "#334155" }}>{fa.score}</td>
                    <td style={{ padding: "8px", textAlign: "center", color: "#334155" }}>{bs}</td>
                    <td style={{ padding: "8px", textAlign: "center", fontWeight: 800, color: dColor }}>
                      {delta > 0 ? "+" : ""}{delta}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                <td style={{ padding: "8px", fontWeight: 800, color: "var(--ink, #17181a)" }}>Итог</td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: 800 }}>{a.composite}</td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: 800 }}>{b.composite}</td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: 800, color: b.composite - a.composite >= 0 ? "#16a34a" : "#dc2626" }}>
                  {b.composite - a.composite > 0 ? "+" : ""}{Math.round((b.composite - a.composite) * 10) / 10}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Verdict + one-line memo per side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {([a, b] as const).map((r) => (
          <div key={r.id} style={SECTION}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ padding: "4px 12px", borderRadius: 999, background: VERDICT_COLOR[r.verdict], color: "#fff", fontWeight: 800, fontSize: 13 }}>
                {VERDICT_LABEL[r.verdict as Verdict]}
              </span>
              <strong style={{ color: "var(--ink, #17181a)" }}>{r.name}</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{firstSentences(r.result.council.memo)}</p>
            <a href={apiUrl(`/api/qventure/analyses/${r.id}/pdf`)} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ⬇ PDF memo
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function firstSentences(text: string, max = 2): string {
  const parts = text.split(/(?<=[.!?])\s+/).slice(0, max);
  return parts.join(" ");
}

// ─── Shared form fields ───────────────────────────────────────────────────────

function FormFields({ form, set, sectors, full = false }: {
  form: FormShape;
  set: (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  sectors: SectorOption[];
  full?: boolean;
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={LABEL}>Название компании или продукта *</label>
          <input aria-label="Название компании или продукта" style={INPUT} value={form.name} onChange={set("name")} placeholder="напр.: NeuroDx" />
        </div>
        <div>
          <label style={LABEL}>Отрасль</label>
          <select aria-label="Отрасль" style={INPUT} value={form.sector} onChange={set("sector")}>
            {sectors.length === 0 && <option value="ai_app">ИИ-приложения</option>}
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL}>Стадия</label>
          <select aria-label="Стадия" style={INPUT} value={form.stage} onChange={set("stage")}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </div>
        {full && (
          <>
            <div>
              <label style={LABEL}>Целевой рынок</label>
              <input aria-label="Целевой рынок" style={INPUT} value={form.geography} onChange={set("geography")} placeholder="США" />
            </div>
            <div>
              <label style={LABEL}>Привлекают (USD, необязательно)</label>
              <input aria-label="Привлекают (USD, необязательно)" style={INPUT} value={form.askUsd} onChange={set("askUsd")} placeholder="5,000,000" inputMode="numeric" />
            </div>
          </>
        )}
      </div>
      <div style={{ marginBottom: full ? 14 : 0 }}>
        <label style={LABEL}>Что делает продукт? *</label>
        <textarea aria-label="Что делает продукт?" style={{ ...INPUT, minHeight: 72, resize: "vertical" }} value={form.description} onChange={set("description")}
          placeholder="Один абзац: что за продукт, какую задачу решает и чем заходит на рынок." />
      </div>
      {full && (
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Тяга и метрики</label>
          <textarea aria-label="Тяга и метрики" style={{ ...INPUT, minHeight: 56, resize: "vertical" }} value={form.tractionNotes} onChange={set("tractionNotes")}
            placeholder="напр.: $40k MRR, рост 18% в месяц, 3 корпоративных пилота, удержание 92%, LTV/CAC 4.2x" />
          {/* Execution carries 28% of the composite and scores low — not neutral — when
              nothing is submitted. Saying so here beats letting someone submit an empty
              field and be surprised by the number. */}
          {!form.tractionNotes.trim() && (
            <div style={{
              marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "#92400e",
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px",
            }}>
              Оставите пустым — оценка упрётся примерно в 58: ни одна заявка без показателей
              ещё не доходила до вердикта «invest». Исполнение это 28% итога, и без данных оно
              считается недоказанным, а не нейтральным. Сдвигает любая настоящая цифра:
              выручка, клиенты, рост, удержание.
            </div>
          )}
        </div>
      )}
      {full && (
        <details style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", background: "#f8fafc" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#334155" }}>
            Точные финансы и прогноз (необязательно — точные числа лучше разбора текста)
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
            <div><label style={LABEL}>ARR (USD)</label><input aria-label="ARR (USD)" style={INPUT} value={form.finArr} onChange={set("finArr")} placeholder="3,000,000" inputMode="numeric" /></div>
            <div><label style={LABEL}>Валовая маржа (%)</label><input aria-label="Валовая маржа (%)" style={INPUT} value={form.finGrossMargin} onChange={set("finGrossMargin")} placeholder="82" inputMode="numeric" /></div>
            <div><label style={LABEL}>LTV / CAC</label><input aria-label="LTV / CAC" style={INPUT} value={form.finLtvCac} onChange={set("finLtvCac")} placeholder="4" inputMode="numeric" /></div>
            <div>
              <label style={LABEL}>Отток (%)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input aria-label="Отток (%)" style={{ ...INPUT, flex: 1 }} value={form.finChurn} onChange={set("finChurn")} placeholder="3" inputMode="numeric" />
                <select style={{ ...INPUT, width: 104 }} value={form.finChurnPeriod} onChange={set("finChurnPeriod")} aria-label="Период оттока">
                  <option value="weekly">/ неделя</option>
                  <option value="monthly">/ месяц</option>
                  <option value="quarterly">/ квартал</option>
                  <option value="annual">/ год</option>
                </select>
              </div>
            </div>
            <div><label style={LABEL}>Клиенты</label><input aria-label="Клиенты" style={INPUT} value={form.finCustomers} onChange={set("finCustomers")} placeholder="2,000" inputMode="numeric" /></div>
            <div>
              <label style={LABEL}>Рост (%)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input aria-label="Рост (%)" style={{ ...INPUT, flex: 1 }} value={form.finGrowth} onChange={set("finGrowth")} placeholder="15" inputMode="numeric" />
                <select style={{ ...INPUT, width: 104 }} value={form.finGrowthPeriod} onChange={set("finGrowthPeriod")} aria-label="Период роста">
                  <option value="WoW">WoW</option>
                  <option value="MoM">MoM</option>
                  <option value="YoY">YoY</option>
                </select>
              </div>
            </div>
            <div><label style={LABEL}>TAM снизу вверх (USD)</label><input aria-label="TAM снизу вверх (USD)" style={INPUT} value={form.finTam} onChange={set("finTam")} placeholder="12,000,000,000" inputMode="numeric" /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={LABEL}>Прогноз выручки (USD) — этот год / +1 год / +2 года (проверка на «хоккейную клюшку»)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <input aria-label="Выручка, год 0" style={INPUT} value={form.projY0} onChange={set("projY0")} placeholder="Год 0: 2,000,000" inputMode="numeric" />
              <input aria-label="Выручка, год 1" style={INPUT} value={form.projY1} onChange={set("projY1")} placeholder="Год 1: 5,000,000" inputMode="numeric" />
              <input aria-label="Выручка, год 2" style={INPUT} value={form.projY2} onChange={set("projY2")} placeholder="Год 2: 12,000,000" inputMode="numeric" />
            </div>
          </div>
        </details>
      )}
    </>
  );
}

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  padding: "12px 28px", background: loading ? "var(--ink-faint, #74767c)" : "var(--teal-deep, #075b53)", color: "#fff", border: "none",
  borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer",
});
const ghostBtn = (loading: boolean): React.CSSProperties => ({
  padding: "12px 22px", background: "#fff", color: "var(--teal-deep, #075b53)", border: "1px solid #ddd6fe",
  borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
});
