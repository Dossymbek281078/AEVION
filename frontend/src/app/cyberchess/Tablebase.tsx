/* AEVION Tablebase panel.

   For endgame positions with ≤7 pieces total we hit the free public Lichess
   tablebase API at https://tablebase.lichess.ovh/standard which returns
   perfect-play classification (Win/Draw/Loss + DTZ + best moves).

   We never hit it for positions with >7 pieces (would 4xx anyway), and
   debounce per-FEN. Cached responses are kept in a module-level Map.
*/

"use client";
import { useEffect, useState } from "react";
import { Chess } from "chess.js";

type TbCategory = "win" | "loss" | "draw" | "cursed-win" | "blessed-loss" | "maybe-win" | "maybe-loss" | "unknown";
export type TbMove = { uci: string; san: string; category: TbCategory; dtz?: number; dtm?: number; zeroing?: boolean; checkmate?: boolean; stalemate?: boolean };
export type TbResponse = {
  category: TbCategory;
  dtz?: number; dtm?: number;
  checkmate?: boolean; stalemate?: boolean;
  moves: TbMove[];
};

const cache = new Map<string, TbResponse>();
let lastFetch = 0;

async function fetchTb(fen: string): Promise<TbResponse | null> {
  const cached = cache.get(fen);
  if (cached) return cached;
  // Throttle: at most one new request per 350ms (safe for free public API)
  const wait = Math.max(0, 350 - (Date.now() - lastFetch));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetch = Date.now();
  try {
    const r = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as TbResponse;
    cache.set(fen, j);
    return j;
  } catch { return null; }
}

function pieceCount(fen: string): number {
  // Count letters (pieces) in the placement field
  const placement = fen.split(" ")[0];
  return placement.replace(/[^a-zA-Z]/g, "").length;
}

const CAT_LABEL: Record<TbCategory, string> = {
  "win": "WIN", "loss": "LOSS", "draw": "DRAW",
  "cursed-win": "WIN (cursed)", "blessed-loss": "LOSS (blessed)",
  "maybe-win": "WIN?", "maybe-loss": "LOSS?", "unknown": "?",
};
const CAT_COLOR: Record<TbCategory, string> = {
  "win": "#10b981", "loss": "#dc2626", "draw": "#64748b",
  "cursed-win": "#0e766e", "blessed-loss": "#9a3412",
  "maybe-win": "#84cc16", "maybe-loss": "#f87171", "unknown": "#94a3b8",
};

type Props = {
  fen: string;
  /** Whether the panel should run at all (e.g. only in analysis/coach tab). */
  enabled: boolean;
  /** When user clicks a tablebase move. */
  onPlay: (uci: string, san: string) => void;
};

export default function TablebasePanel({ fen, enabled, onPlay }: Props) {
  const [data, setData] = useState<TbResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pieces = pieceCount(fen);
  const eligible = enabled && pieces > 0 && pieces <= 7;

  useEffect(() => {
    if (!eligible) { setData(null); setErr(null); return; }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchTb(fen)
      .then(r => { if (!cancelled) setData(r); if (!r && !cancelled) setErr("Tablebase недоступен"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fen, eligible]);

  if (!enabled) return null;
  if (pieces > 7) return null; // only show panel when potentially answerable

  // Compute SAN for each move (the API returns UCI plus SAN, but be defensive)
  const movesWithSan = (data?.moves || []).slice(0, 8).map(m => {
    if (m.san) return m;
    try {
      const g = new Chess(fen);
      const mv = g.move({ from: m.uci.slice(0, 2) as any, to: m.uci.slice(2, 4) as any, promotion: m.uci.length > 4 ? (m.uci[4] as any) : undefined });
      return { ...m, san: mv?.san || m.uci };
    } catch { return m; }
  });

  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: "linear-gradient(135deg,#fafafa,#f5f3ff)",
      border: "1px solid #e9d5ff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🧮</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", letterSpacing: 0.3 }}>TABLEBASE</span>
        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{pieces} фигур · perfect play</span>
        {data && (
          <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 900, background: CAT_COLOR[data.category] + "22", color: CAT_COLOR[data.category], letterSpacing: 0.4 }}>
            {CAT_LABEL[data.category]}{data.dtz !== undefined ? ` · DTZ ${Math.abs(data.dtz)}` : ""}
          </span>
        )}
      </div>
      {loading && <div style={{ fontSize: 11, color: "#64748b", padding: 4 }}>Запрашиваю tablebase…</div>}
      {err && <div style={{ fontSize: 11, color: "#dc2626", padding: 4 }}>{err}</div>}
      {data && data.moves && data.moves.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {movesWithSan.map(m => (
            <button key={m.uci} onClick={() => onPlay(m.uci, m.san)}
              title={`${CAT_LABEL[m.category]}${m.dtz !== undefined ? ` · DTZ ${m.dtz}` : ""}${m.dtm !== undefined ? ` · DTM ${m.dtm}` : ""}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 14,
                border: `1px solid ${CAT_COLOR[m.category]}55`,
                background: `${CAT_COLOR[m.category]}10`,
                color: CAT_COLOR[m.category],
                cursor: "pointer", fontSize: 12, fontWeight: 800,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${CAT_COLOR[m.category]}25`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${CAT_COLOR[m.category]}10`; }}>
              {m.san}
              {m.dtz !== undefined && Math.abs(m.dtz) > 0 && <span style={{ fontSize: 10, opacity: 0.75 }}>· {Math.abs(m.dtz)}</span>}
            </button>
          ))}
        </div>
      )}
      {data && (!data.moves || data.moves.length === 0) && (
        <div style={{ fontSize: 11, color: "#64748b", padding: 4 }}>Позиция терминальная: {data.checkmate ? "мат" : data.stalemate ? "пат" : CAT_LABEL[data.category]}.</div>
      )}
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
        Источник: tablebase.lichess.ovh · работает для ≤7 фигур · 7-фигурный решён в 2018 (Lomonosov)
      </div>
    </div>
  );
}
