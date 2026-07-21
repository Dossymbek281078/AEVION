import type { Metadata } from "next";
import Link from "next/link";
import { SYSTEMS, ROWS, benchmarkDelta, benchmarkLatestMeta, type Verdict } from "./data";
import BenchmarkDeltaChart from "./BenchmarkDeltaChart";

export const metadata: Metadata = {
  title: "QCoreAI vs. AutoGen, CrewAI, LangGraph, Agents SDK, MetaGPT",
  description:
    "A code-level, source-cited comparison of AEVION QCoreAI's multi-agent Council against the other well-known multi-agent AI frameworks — what's automatic, what's built in, and what's still manual elsewhere.",
};

const BORDER = "1px solid rgba(15,23,42,0.08)";
const CARD_SHADOW = "0 4px 20px rgba(15,23,42,0.06)";
const LABEL_COL = "minmax(240px, 1.7fr)";
const SYS_COLS = `repeat(${SYSTEMS.length}, minmax(108px, 1fr))`;

export default function QCoreAiVsPage() {
  const benchmarkRow = ROWS.find((r) => r.id === "quality-benchmark");
  return (
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "28px 20px 64px",
        fontFamily: "system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Link href="/qcoreai" style={{ fontSize: 13, color: "#0d9488", textDecoration: "none", fontWeight: 700 }}>
          ← QCoreAI
        </Link>
      </div>

      <section style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 14,
          }}
        >
          MULTI-AGENT ARCHITECTURE
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 10, letterSpacing: "-0.02em" }}>
          QCoreAI vs. the multi-agent field
        </h1>
        <p style={{ fontSize: 15, color: "#475569", maxWidth: 720, lineHeight: 1.55, margin: 0 }}>
          Every row below points at a real file in this codebase — not a slogan. Where a framework
          plausibly does something too (just manually, or via a separate add-on), it's marked
          <b> partial</b>, not crossed out. See the honest caveats at the bottom before you take this
          as the whole picture.
        </p>
      </section>

      <div style={{ overflowX: "auto", marginBottom: 8 }}>
        <div style={{ minWidth: 880 }}>
          {/* System header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${LABEL_COL} ${SYS_COLS}`,
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div />
            {SYSTEMS.map((s) => (
              <div
                key={s.id}
                style={{
                  textAlign: "center",
                  padding: "10px 6px",
                  borderRadius: 12,
                  background: s.isUs ? "linear-gradient(180deg, #0f172a, #1e293b)" : "#fff",
                  color: s.isUs ? "#f8fafc" : "#0f172a",
                  border: s.isUs ? "none" : BORDER,
                  boxShadow: s.isUs ? "0 12px 32px rgba(15,23,42,0.22)" : CARD_SHADOW,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em" }}>{s.name}</div>
                <div style={{ fontSize: 10, color: s.isUs ? "#94a3b8" : "#64748b", marginTop: 2 }}>{s.maker}</div>
              </div>
            ))}
          </div>

          {/* Matrix */}
          <div
            style={{
              background: "#fff",
              border: BORDER,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: CARD_SHADOW,
            }}
          >
            {ROWS.map((row, i) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `${LABEL_COL} ${SYS_COLS}`,
                  gap: 8,
                  padding: "14px 14px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                  alignItems: "center",
                  background: i % 2 === 1 ? "#fafbfd" : "#fff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>{row.label}</div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3, lineHeight: 1.45 }}>{row.detail}</div>
                  {row.source && (
                    <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 3 }}>{row.source}</div>
                  )}
                </div>
                {SYSTEMS.map((s) => (
                  <VerdictCell key={s.id} verdict={row.values[s.id].verdict} note={row.values[s.id].note} highlight={!!s.isUs} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <section
        style={{
          marginTop: 20,
          marginBottom: 28,
          padding: 16,
          background: "#f8fafc",
          borderRadius: 10,
          border: BORDER,
        }}
      >
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#475569", margin: 0, marginBottom: 10, letterSpacing: "0.06em" }}>
          LEGEND
        </h3>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <LegendItem verdict="yes" label="Shipped and automatic" />
          <LegendItem verdict="partial" label="Possible, but manual / a separate add-on" />
          <LegendItem verdict="no" label="Not part of the framework" />
        </div>
      </section>

      {/* Historical vs. latest-run delta */}
      {benchmarkDelta.length > 0 && (
        <section
          style={{
            marginBottom: 20,
            padding: 20,
            background: "#fff",
            border: BORDER,
            borderRadius: 12,
            boxShadow: CARD_SHADOW,
            overflowX: "auto",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 900, margin: 0, marginBottom: 4, color: "#0f172a" }}>
            Historical vs. latest run — per category
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
            Win-rate (%) vs. a single flagship. The curated historical entry is the citable baseline;
            the latest run is whatever a maintainer most recently reproduced — see the caveat below if
            they diverge.
          </p>
          <BenchmarkDeltaChart data={benchmarkDelta} latestDate={benchmarkLatestMeta?.generatedAt} />
          {benchmarkLatestMeta?.caveat && (
            <p style={{ fontSize: 11.5, color: "#92400e", background: "#fef3c7", padding: "8px 12px", borderRadius: 8, marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
              <b>Caveat on the latest run:</b> {benchmarkLatestMeta.caveat}
            </p>
          )}
        </section>
      )}

      {/* Honest caveats */}
      <section
        style={{
          padding: 20,
          background: "#fff",
          border: BORDER,
          borderRadius: 12,
          boxShadow: CARD_SHADOW,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 900, margin: 0, marginBottom: 10, color: "#0f172a" }}>
          Where we don't claim to win
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
          <li>
            <b>Ecosystem &amp; community.</b> AutoGen, LangGraph and CrewAI have years of public issues,
            plugins, tutorials and third-party integrations. QCoreAI is a single-team platform layer —
            younger, narrower, and without an open-source community around it.
          </li>
          <li>
            <b>Generality.</b> LangGraph in particular is a general graph-execution engine, not just a
            chat-agent framework — it's used for workflows this comparison doesn't cover at all.
          </li>
          <li>
            <b>Portability.</b> These frameworks run anywhere you can `pip install`/`npm install` them.
            QCoreAI's Council is a service inside the AEVION platform, not a standalone library.
          </li>
        </ul>
        <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
          Quality benchmark methodology: questions across 7 categories, order-randomised A/B to cancel
          position bias, judged by Claude Fable 5. {benchmarkRow?.detail} Reproduce it with
          <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, margin: "0 4px" }}>
            node scripts/qcore-eval.js
          </code>
          then
          <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, margin: "0 4px" }}>
            node scripts/sync-qcore-benchmark.js
          </code>
          in the backend.
        </p>
      </section>
    </main>
  );
}

function VerdictCell({ verdict, note, highlight }: { verdict: Verdict; note?: string; highlight: boolean }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "6px 4px",
        borderRadius: 8,
        background: verdict === "yes" && highlight ? "rgba(13,148,136,0.12)" : verdict === "yes" ? "rgba(13,148,136,0.06)" : "transparent",
      }}
      title={note}
    >
      <VerdictMark verdict={verdict} />
      {note && (
        <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.3 }}>{note}</div>
      )}
    </div>
  );
}

function VerdictMark({ verdict }: { verdict: Verdict }) {
  if (verdict === "yes") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#0d9488",
          color: "#fff",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        ✓
      </span>
    );
  }
  if (verdict === "partial") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fef3c7",
          color: "#92400e",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        ~
      </span>
    );
  }
  return <span style={{ color: "#cbd5e1", fontSize: 16 }}>—</span>;
}

function LegendItem({ verdict, label }: { verdict: Verdict; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <VerdictMark verdict={verdict} />
      <span>{label}</span>
    </span>
  );
}
