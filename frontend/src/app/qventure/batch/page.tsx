"use client";

// QVenture Batch — the due-diligence funnel. Upload several pitch decks at once;
// each is text-extracted, structured, and scored through the same engine as the
// single-deal flow, then ranked in one sortable league table with a one-click
// funnel PDF. Turns "a folder of decks" into "a triaged shortlist".

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { VERDICT_COLOR, VERDICT_LABEL, SECTION, H2, type Verdict } from "../_result";

interface Row {
  id: string;
  name: string;
  sector: string;
  stage: string;
  composite: number;
  verdict: Verdict;
  redFlags: number;
  resilience: string;
  coverage: number | null;
}

type SortKey = "composite" | "name" | "redFlags";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BatchPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("composite");
  const fileRef = useRef<HTMLInputElement>(null);

  // Analyze one deck: extract → analyze. Retries once on a rate-limit so larger
  // batches ride over the 6/min analyze cap instead of dropping deals.
  const analyzeDeck = useCallback(async (file: File): Promise<Row | { error: string }> => {
    const label = file.name.replace(/\.pdf$/i, "");
    // 1. Extract structured fields from the PDF.
    let fields: Record<string, unknown>;
    try {
      const ex = await fetch(apiUrl("/api/qventure/extract"), {
        method: "POST", headers: { "Content-Type": "application/pdf" }, body: file,
      });
      const ej = await ex.json();
      if (!ex.ok || !ej?.ok) return { error: `${label}: ${ej?.hint || ej?.error || "could not read deck"}` };
      fields = ej.data as Record<string, unknown>;
    } catch {
      return { error: `${label}: upload failed` };
    }

    // 2. Score it (retry once on rate-limit).
    const payload = {
      name: fields.name, sector: fields.sector, stage: fields.stage,
      geography: fields.geography, askUsd: fields.askUsd,
      description: fields.description, tractionNotes: fields.tractionNotes,
      financials: fields.financials, projections: fields.projections,
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const an = await fetch(apiUrl("/api/qventure/analyze"), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (an.status === 429 || an.status === 503) {
          setNote("Rate limit reached — waiting a few seconds before continuing…");
          await sleep(11_000);
          continue;
        }
        const aj = await an.json();
        if (!an.ok || !aj?.ok) {
          if (aj?.error === "rate_limited") { await sleep(11_000); continue; }
          return { error: `${label}: ${aj?.error || "analysis failed"}` };
        }
        setNote(null);
        const r = aj.data;
        const res = r.result || {};
        return {
          id: r.id, name: r.name, sector: res.sector?.label || r.sector, stage: r.stage,
          composite: r.composite, verdict: r.verdict as Verdict,
          redFlags: Array.isArray(res.redFlags) ? res.redFlags.length : 0,
          resilience: res.stress?.resilience && res.stress.resilience !== "insufficient-data" ? res.stress.resilience : "n/a",
          coverage: typeof res.signalCoverage === "number" ? res.signalCoverage : null,
        };
      } catch {
        return { error: `${label}: network error` };
      }
    }
    return { error: `${label}: skipped (rate limit)` };
  }, []);

  const onFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    e.target.value = "";
    if (!files.length) return;
    if (files.length > 20) { setErrors([`Max 20 decks per batch — first 20 of ${files.length} used.`]); }
    const batch = files.slice(0, 20);
    setBusy(true); setErrors([]); setNote(null);
    const collected: Row[] = [...rows];
    const errs: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      setProgress({ done: i, total: batch.length, current: batch[i].name });
      const out = await analyzeDeck(batch[i]);
      if ("error" in out) errs.push(out.error);
      else {
        // De-dup by id (re-uploading the same deck replaces its row).
        const idx = collected.findIndex((x) => x.id === out.id);
        if (idx >= 0) collected[idx] = out; else collected.push(out);
        setRows([...collected]);
      }
    }
    setProgress(null); setBusy(false); setErrors(errs);
  }, [rows, analyzeDeck]);

  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "redFlags") return b.redFlags - a.redFlags;
    return b.composite - a.composite;
  });

  const funnelHref = rows.length >= 2
    ? apiUrl(`/api/qventure/funnel/pdf?ids=${rows.map((r) => encodeURIComponent(r.id)).join(",")}`)
    : null;

  const invest = rows.filter((r) => r.verdict === "invest").length;
  const watch = rows.filter((r) => r.verdict === "watch").length;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", letterSpacing: 1, textTransform: "uppercase" }}>AEVION · QVenture</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>Deal funnel — batch analysis</h1>
          </div>
          <Link href="/qventure" style={{ padding: "9px 18px", background: "#fff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: 10, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
            ← Single deal
          </Link>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 15, color: "#475569", maxWidth: 760 }}>
          Upload up to 20 pitch decks at once. Each is scored through the full engine — quant score, red flags,
          stress test — then ranked into one shortlist you can export as a single funnel PDF.
        </p>

        <div style={{ border: "1px dashed #c4b5fd", background: "#faf5ff", borderRadius: 12, padding: "16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple onChange={onFiles} style={{ display: "none" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{
            padding: "11px 20px", background: busy ? "#a78bfa" : "#7c3aed", color: "#fff", border: "none",
            borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
            {busy ? "Analyzing…" : "📄 Upload decks (PDF, up to 20)"}
          </button>
          {progress && (
            <span style={{ fontSize: 13.5, color: "#7c3aed", fontWeight: 600 }}>
              {progress.done}/{progress.total} · {progress.current.slice(0, 40)}
            </span>
          )}
          {note && <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>{note}</span>}
          {!busy && !progress && rows.length === 0 && (
            <span style={{ fontSize: 12.5, color: "#94a3b8" }}>Text-based PDFs only (not scanned images).</span>
          )}
        </div>

        {errors.length > 0 && (
          <div style={{ ...SECTION, borderColor: "#fecaca", background: "#fef2f2", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", marginBottom: 6 }}>Skipped {errors.length} deck{errors.length > 1 ? "s" : ""}</div>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12.5, color: "#7f1d1d" }}>• {e}</div>)}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
              {[
                { k: "Deals scored", v: String(rows.length) },
                { k: "Invest", v: String(invest) },
                { k: "Watch", v: String(watch) },
                { k: "Pass", v: String(rows.length - invest - watch) },
              ].map((s) => (
                <div key={s.k} style={{ ...SECTION, padding: "10px 16px", margin: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.k}</div>
                </div>
              ))}
              <div style={{ flex: 1 }} />
              {funnelHref && (
                <a href={funnelHref} target="_blank" rel="noopener noreferrer" style={{
                  padding: "11px 20px", background: "#0f172a", color: "#fff", borderRadius: 10,
                  fontWeight: 700, fontSize: 13.5, textDecoration: "none", whiteSpace: "nowrap",
                }}>
                  ⬇ Export funnel PDF
                </a>
              )}
            </div>

            <div style={{ ...SECTION }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <h2 style={{ ...H2, margin: 0, flex: 1 }}>Ranking</h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>Sort:</span>
                {(["composite", "redFlags", "name"] as SortKey[]).map((k) => (
                  <button key={k} type="button" onClick={() => setSort(k)} style={{
                    padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: "1px solid " + (sort === k ? "#7c3aed" : "#e2e8f0"),
                    background: sort === k ? "#7c3aed" : "#fff", color: sort === k ? "#fff" : "#475569",
                  }}>{k === "composite" ? "Score" : k === "redFlags" ? "Red flags" : "Name"}</button>
                ))}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12, borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "8px 6px" }}>#</th>
                      <th style={{ padding: "8px 6px" }}>Company</th>
                      <th style={{ padding: "8px 6px" }}>Sector · Stage</th>
                      <th style={{ padding: "8px 6px", textAlign: "right" }}>Score</th>
                      <th style={{ padding: "8px 6px" }}>Verdict</th>
                      <th style={{ padding: "8px 6px", textAlign: "right" }}>Flags</th>
                      <th style={{ padding: "8px 6px" }}>Stress</th>
                      <th style={{ padding: "8px 6px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "9px 6px", fontWeight: 700, color: "#94a3b8" }}>{i + 1}</td>
                        <td style={{ padding: "9px 6px", fontWeight: 700, color: "#0f172a" }}>{r.name}</td>
                        <td style={{ padding: "9px 6px", color: "#475569" }}>{r.sector} · {r.stage}</td>
                        <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>{r.composite}</td>
                        <td style={{ padding: "9px 6px" }}>
                          <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: "#fff", background: VERDICT_COLOR[r.verdict] }}>
                            {VERDICT_LABEL[r.verdict]}
                          </span>
                        </td>
                        <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: r.redFlags > 0 ? "#b45309" : "#94a3b8" }}>{r.redFlags}</td>
                        <td style={{ padding: "9px 6px", color: r.resilience === "underwater" || r.resilience === "fragile" ? "#b45309" : "#475569", textTransform: "capitalize" }}>{r.resilience}</td>
                        <td style={{ padding: "9px 6px", textAlign: "right" }}>
                          <Link href={`/qventure/a/${r.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: "#7c3aed", textDecoration: "none", whiteSpace: "nowrap" }}>Report →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 12 }}>
              Each deck is scored deterministically then narrated by the four-role council. Figures are model estimates — research tool, not investment advice.
            </p>
          </>
        )}
      </ProductPageShell>
    </>
  );
}
