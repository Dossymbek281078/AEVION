/* AEVION Opening Explorer.

   Lichess-inspired tree of opening continuations from the current position,
   but with our own UI language (no copying CSS / layout from lichess.org).

   How it matches:
   - We have hist (SAN moves played so far) and openingsDb loaded from /openings.json.
   - Each opening has "moves" as space-separated UCI tokens (e.g. "e2e4 e7e5 g1f3").
   - We convert hist (SAN) → UCI by replaying through chess.js, then keep openings
     whose first N UCI plies exactly match.
   - For matching openings we group by the (N+1)-th ply (the next move) → tree of branches.
   - Each branch shows: next move SAN, opening count, top opening name, ECO band.
*/

"use client";
import { useMemo } from "react";
import { Chess, type Square } from "chess.js";

type OpeningRow = { eco: string; name: string; moves: string; desc: string };

type Branch = {
  uci: string;
  san: string;
  count: number;
  topOpening: OpeningRow;
  ecos: Set<string>;
};

type Props = {
  /** SAN history of the game so far. */
  histSan: string[];
  /** Full openings DB (already loaded into page state). */
  openingsDb: OpeningRow[];
  /** Optional: highlight the position-matching opening if any. */
  currentOpening?: { eco: string; name: string; desc: string } | null;
  /** When user clicks a branch, play that move on the live board. */
  onPlayMove: (uci: string, san: string) => void;
  /** Optional limit. Defaults to 8 branches shown. */
  maxBranches?: number;
};

function histToUci(hist: string[]): string[] {
  const g = new Chess();
  const out: string[] = [];
  for (const san of hist) {
    try {
      const m = g.move(san);
      if (!m) break;
      out.push(`${m.from}${m.to}${m.promotion || ""}`);
    } catch { break; }
  }
  return out;
}

function uciToSan(fen: string, uci: string): string | null {
  if (uci.length < 4) return null;
  try {
    const g = new Chess(fen);
    const m = g.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.length > 4 ? (uci[4] as any) : undefined });
    return m?.san || null;
  } catch { return null; }
}

export default function OpeningExplorer({ histSan, openingsDb, currentOpening, onPlayMove, maxBranches = 8 }: Props) {
  const data = useMemo(() => {
    if (!openingsDb || openingsDb.length === 0) {
      return { branches: [] as Branch[], matchedOpenings: [] as OpeningRow[], curFen: new Chess().fen() };
    }
    const histUci = histToUci(histSan);
    const N = histUci.length;
    const prefix = histUci.join(" ");

    // Replay hist on a Chess instance once for SAN conversion
    const g = new Chess();
    for (const san of histSan) { try { g.move(san); } catch {} }
    const curFen = g.fen();

    const matchedOpenings: OpeningRow[] = [];
    const branchMap = new Map<string, Branch>();

    for (const op of openingsDb) {
      const tokens = op.moves.trim().split(/\s+/).filter(t => t.length >= 4);
      if (tokens.length <= N) continue;
      // Prefix check (cheap — string compare)
      const opPrefix = tokens.slice(0, N).join(" ");
      if (opPrefix !== prefix) continue;
      matchedOpenings.push(op);
      const nextUci = tokens[N];
      const branch = branchMap.get(nextUci);
      if (branch) {
        branch.count++;
        branch.ecos.add(op.eco);
        // Replace top opening with deeper / more specific name (longer = more specific)
        if (op.moves.length > branch.topOpening.moves.length) branch.topOpening = op;
      } else {
        branchMap.set(nextUci, {
          uci: nextUci,
          san: uciToSan(curFen, nextUci) || nextUci,
          count: 1,
          topOpening: op,
          ecos: new Set([op.eco]),
        });
      }
    }

    const branches = Array.from(branchMap.values()).sort((a, b) => b.count - a.count);
    return { branches, matchedOpenings, curFen };
  }, [histSan, openingsDb]);

  // ECO band → tone (rough mapping for visual grouping)
  const ecoTone = (eco: string): string => {
    const letter = eco[0]?.toUpperCase();
    if (letter === "A") return "#0891b2";   // Flank/irreg
    if (letter === "B") return "#f59e0b";   // Semi-open (Sicilian etc)
    if (letter === "C") return "#dc2626";   // 1.e4 e5
    if (letter === "D") return "#7c3aed";   // 1.d4 d5
    if (letter === "E") return "#10b981";   // Indian defences
    return "#64748b";
  };

  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: "linear-gradient(135deg, #fafafa, #f3f4f6)",
      border: "1px solid #e5e7eb",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>📖</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", letterSpacing: 0.3 }}>
          OPENING EXPLORER
        </span>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          · {data.matchedOpenings.length} вариант{data.matchedOpenings.length === 1 ? "" : data.matchedOpenings.length < 5 ? "а" : "ов"}
        </span>
        <div style={{ flex: 1 }} />
        {currentOpening && (
          <span style={{
            fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 4,
            background: ecoTone(currentOpening.eco) + "22", color: ecoTone(currentOpening.eco),
            fontFamily: "ui-monospace, monospace", letterSpacing: 0.5,
          }}>
            {currentOpening.eco}
          </span>
        )}
      </div>

      {currentOpening && (
        <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 700, marginBottom: 6 }}>
          {currentOpening.name}
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 1, fontStyle: "italic" }}>
            {currentOpening.desc}
          </div>
        </div>
      )}

      {data.branches.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b", padding: "8px 0", fontStyle: "italic" }}>
          Эта позиция за пределами книги. Сделай ход — будем искать дебютные продолжения.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
            Продолжения · кликни чтобы сыграть
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.branches.slice(0, maxBranches).map(br => {
              const pct = Math.round((br.count / Math.max(1, data.matchedOpenings.length)) * 100);
              const tone = ecoTone([...br.ecos][0] || "");
              return (
                <button key={br.uci}
                  onClick={() => onPlayMove(br.uci, br.san)}
                  className="cc-focus-ring"
                  title={`${br.count} вариант${br.count === 1 ? "" : br.count < 5 ? "а" : "ов"} в нашей базе с этим продолжением`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: 8, alignItems: "center",
                    padding: "6px 10px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s ease",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = tone;
                    el.style.background = tone + "10";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#e5e7eb";
                    el.style.background = "#ffffff";
                  }}>
                  {/* SAN move — bold, monospace */}
                  <span style={{
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: 13, fontWeight: 900, color: tone,
                    minWidth: 56,
                  }}>{br.san}</span>
                  {/* Top opening name */}
                  <span style={{
                    fontSize: 12, color: "#0f172a", fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{br.topOpening.name}</span>
                  {/* Count + bar */}
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {br.count} · {pct}%
                  </span>
                  {/* ECO badge */}
                  <span style={{
                    fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 3,
                    background: tone + "22", color: tone,
                    fontFamily: "ui-monospace, monospace", letterSpacing: 0.4,
                  }}>{[...br.ecos][0] || ""}</span>
                  {/* visual proportion bar at bottom */}
                  <span style={{
                    position: "absolute", left: 0, bottom: 0, height: 2,
                    width: `${Math.max(6, pct)}%`,
                    background: `linear-gradient(90deg, ${tone}, ${tone}55)`,
                    borderTopRightRadius: 1,
                  }}/>
                </button>
              );
            })}
          </div>
          {data.branches.length > maxBranches && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, textAlign: "center", fontStyle: "italic" }}>
              + ещё {data.branches.length - maxBranches} продолжений
            </div>
          )}
        </>
      )}
    </div>
  );
}
