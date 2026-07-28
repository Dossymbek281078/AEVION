"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  COMPARE_ROWS,
  COMPARE_UPDATED,
  NOT_COMPARED,
  type CompareRow,
  type Txt,
  type Verdict,
} from "@/data/competitors";

/**
 * Язык берём из общего переключателя платформы, а не заводим свой: правило
 * «не плодить второй способ делать то, что уже делается одним». Языков в
 * переключателе больше двух, поэтому всё, кроме русского, показываем
 * по-английски — это честнее, чем показать половину строки на одном языке,
 * половину на другом.
 */
function useTxt() {
  const { lang } = useI18n();
  const key: "ru" | "en" = lang === "ru" ? "ru" : "en";
  return (x: Txt) => x[key];
}

const VERDICT: Record<Verdict, { ru: string; en: string; color: string; bg: string }> = {
  "we-stronger": { ru: "сильнее мы", en: "we are stronger", color: "#065f46", bg: "rgba(5,150,105,0.10)" },
  "they-stronger": { ru: "сильнее аналог", en: "the rival is stronger", color: "#9a3412", bg: "rgba(234,88,12,0.10)" },
  "different-league": { ru: "разные задачи", en: "different jobs", color: "#3730a3", bg: "rgba(79,70,229,0.10)" },
};

const COPY = {
  title: { ru: "AEVION против аналогов", en: "AEVION against the analogues" },
  lead1: {
    ru: "Сравнение по фактам, а не по формулировкам. Про нас — только измеренное: прогон, запрос к рабочему серверу, счётчик по коду. Про других — только опубликованное, со ссылкой.",
    en: "A comparison built on facts, not on wording. Our side is measured only: a run, a call to the live server, a count over the code. Their side is published material only, with a link.",
  },
  lead2: {
    ru: "Колонка «где мы слабее» здесь обязательна и заполнена везде. Сравнение, в котором выигрываешь по всем строкам, — это не сравнение, а реклама, и доверия оно не прибавляет.",
    en: "The «where we are weaker» column is mandatory here and filled in everywhere. A comparison you win on every line is not a comparison but advertising, and it earns no trust.",
  },
  checked: {
    ru: `Сверено ${COMPARE_UPDATED}. Тарифы и цифры аналогов меняются — если строка выглядит устаревшей, верьте источнику по ссылке, а не этой странице.`,
    en: `Checked on ${COMPARE_UPDATED}. Rival pricing and figures move — if a row looks stale, trust the linked source rather than this page.`,
  },
  against: { ru: "против:", en: "against:" },
  stronger: { ru: "Где мы сильнее", en: "Where we are stronger" },
  weaker: { ru: "Где мы слабее", en: "Where we are weaker" },
  howChecked: { ru: "Чем проверено.", en: "How this was checked." },
  notYetTitle: {
    ru: "Где аналог есть, но сравнения мы ещё не делали",
    en: "Where an analogue exists but we have not compared yet",
  },
  notYetLead: {
    ru: "Эти модули сюда попадут, когда будет что предъявить замером. Пустая строка честнее придуманной.",
    en: "These modules will appear here once there is a measurement to show. An empty row is more honest than an invented one.",
  },
  footer: {
    ru: "Открыть модули целиком — каталог, посмотреть в работе — демо.",
    en: "Browse every module in the catalogue, or see it running in the demo.",
  },
  catalogue: { ru: "каталог", en: "catalogue" },
  demo: { ru: "демо", en: "demo" },
};

function Card({ row, tr, lang }: { row: CompareRow; tr: (x: Txt) => string; lang: "ru" | "en" }) {
  const v = VERDICT[row.verdict];
  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        background: "#fff",
        padding: "18px 18px 16px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
          {tr(row.title)}
        </h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: v.color,
            background: v.bg,
            borderRadius: 999,
            padding: "3px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {v[lang]}
        </span>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
        {COPY.against[lang]} {row.rivals.join(" · ")}
      </div>

      <p style={{ margin: "12px 0 16px", fontSize: 15.5, lineHeight: 1.55, color: "#1e293b" }}>{tr(row.headline)}</p>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#059669", marginBottom: 7 }}>
            {COPY.stronger[lang]}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.5, color: "#334155" }}>
            {row.strengths.map((s) => (
              <li key={s.en} style={{ marginBottom: 6 }}>{tr(s)}</li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#dc2626", marginBottom: 7 }}>
            {COPY.weaker[lang]}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.5, color: "#334155" }}>
            {row.weaknesses.map((w) => (
              <li key={w.en} style={{ marginBottom: 6 }}>{tr(w)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px dashed rgba(15,23,42,0.12)",
          fontSize: 13,
          lineHeight: 1.5,
          color: "#64748b",
        }}
      >
        <strong style={{ color: "#475569" }}>{COPY.howChecked[lang]}</strong> {tr(row.measured)}
        {row.sources.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            {row.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? " · " : ""}
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>
                  {tr(s.label)}
                </a>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function CompareClient() {
  const { lang: rawLang } = useI18n();
  const lang: "ru" | "en" = rawLang === "ru" ? "ru" : "en";
  const tr = useTxt();

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "28px 16px 64px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a", margin: "0 0 8px" }}>
        {COPY.title[lang]}
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: "0 0 6px" }}>{COPY.lead1[lang]}</p>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#475569", margin: "0 0 18px" }}>{COPY.lead2[lang]}</p>

      <div
        style={{
          background: "rgba(13,148,136,0.06)",
          border: "1px solid rgba(13,148,136,0.22)",
          borderRadius: 12,
          padding: "12px 14px",
          fontSize: 14,
          lineHeight: 1.55,
          color: "#134e4a",
          marginBottom: 24,
        }}
      >
        {COPY.checked[lang]}
      </div>

      {COMPARE_ROWS.map((row) => (
        <Card key={row.module} row={row} tr={tr} lang={lang} />
      ))}

      <section
        style={{
          marginTop: 28,
          border: "1px dashed rgba(15,23,42,0.18)",
          borderRadius: 14,
          padding: "16px 18px",
          background: "rgba(248,250,252,0.7)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: "0 0 8px" }}>{COPY.notYetTitle[lang]}</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#475569", margin: "0 0 12px" }}>{COPY.notYetLead[lang]}</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.7, color: "#334155" }}>
          {NOT_COMPARED.map((n) => (
            <li key={n.module}>
              <Link href={`/${n.module}`} style={{ color: "#0f172a", fontWeight: 700 }}>
                {n.module}
              </Link>
              <span style={{ color: "#64748b" }}> — {n.rivals}</span>
            </li>
          ))}
        </ul>
      </section>

      <p style={{ marginTop: 24, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
        <Link href="/explore" style={{ color: "#0d9488", fontWeight: 700 }}>
          {COPY.catalogue[lang]}
        </Link>
        {" · "}
        <Link href="/demo" style={{ color: "#0d9488", fontWeight: 700 }}>
          {COPY.demo[lang]}
        </Link>
      </p>
    </main>
  );
}
