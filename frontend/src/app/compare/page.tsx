import Link from "next/link";
import {
  COMPARE_ROWS,
  COMPARE_UPDATED,
  NOT_COMPARED,
  type CompareRow,
  type Verdict,
} from "@/data/competitors";

const VERDICT_LABEL: Record<Verdict, { text: string; color: string; bg: string }> = {
  "we-stronger": { text: "сильнее мы", color: "#065f46", bg: "rgba(5,150,105,0.10)" },
  "they-stronger": { text: "сильнее аналог", color: "#9a3412", bg: "rgba(234,88,12,0.10)" },
  "different-league": { text: "разные задачи", color: "#3730a3", bg: "rgba(79,70,229,0.10)" },
};

function Card({ row }: { row: CompareRow }) {
  const v = VERDICT_LABEL[row.verdict];
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
          {row.title}
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
          {v.text}
        </span>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
        против: {row.rivals.join(" · ")}
      </div>

      <p style={{ margin: "12px 0 16px", fontSize: 15.5, lineHeight: 1.55, color: "#1e293b" }}>{row.headline}</p>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#059669", marginBottom: 7 }}>
            Где мы сильнее
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.5, color: "#334155" }}>
            {row.strengths.map((s) => (
              <li key={s} style={{ marginBottom: 6 }}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#dc2626", marginBottom: 7 }}>
            Где мы слабее
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.5, color: "#334155" }}>
            {row.weaknesses.map((w) => (
              <li key={w} style={{ marginBottom: 6 }}>{w}</li>
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
        <strong style={{ color: "#475569" }}>Чем проверено.</strong> {row.measured}
        {row.sources.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            {row.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? " · " : ""}
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>
                  {s.label}
                </a>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ComparePage() {
  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "28px 16px 64px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a", margin: "0 0 8px" }}>
        AEVION против аналогов
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: "0 0 6px" }}>
        Сравнение по фактам, а не по формулировкам. Про нас — только измеренное: прогон, запрос к рабочему
        серверу, счётчик по коду. Про других — только опубликованное, со ссылкой.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#475569", margin: "0 0 18px" }}>
        Колонка <strong>«где мы слабее»</strong> здесь обязательна и заполнена везде. Сравнение, в котором
        выигрываешь по всем строкам, — это не сравнение, а реклама, и доверия оно не прибавляет.
      </p>

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
        Сверено {COMPARE_UPDATED}. Тарифы и цифры аналогов меняются — если строка выглядит устаревшей,
        верьте источнику по ссылке, а не этой странице.
      </div>

      {COMPARE_ROWS.map((row) => (
        <Card key={row.module} row={row} />
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
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: "0 0 8px" }}>
          Где аналог есть, но сравнения мы ещё не делали
        </h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#475569", margin: "0 0 12px" }}>
          Эти модули сюда попадут, когда будет что предъявить замером. Пустая строка честнее придуманной.
        </p>
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
        Открыть модули целиком — <Link href="/explore" style={{ color: "#0d9488", fontWeight: 700 }}>каталог</Link>,
        посмотреть в работе — <Link href="/demo" style={{ color: "#0d9488", fontWeight: 700 }}>демо</Link>.
      </p>
    </main>
  );
}
