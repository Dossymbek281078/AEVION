/* AEVION CyberChess — Opening Explorer panel (Lichess Masters).

   Right-panel view showing master-game statistics for the current position.
   Uses the shared ./openingExplorer helper (fetchOpening) which wraps the
   public, CORS-enabled, CC0 Lichess Masters API (no API key) with a 30-min
   cache. Renders the opening name (ECO + name) plus a ranked list of master
   moves — each with total games, a W/D/B percentage bar and average rating.
   Clicking a row plays that move (if onPlayMove is provided).

   Robustness:
     - debounced ~350ms on fen change
     - AbortController cancels the in-flight request on fen change / unmount
     - never throws; on error or empty book shows a calm out-of-book message. */

"use client";
import { useEffect, useState } from "react";
import { fetchOpening, shortNum as oeShortNum, type OpeningEntry } from "./openingExplorer";

export default function OpeningExplorerPanel({
  fen,
  onPlayMove,
}: {
  fen: string;
  onPlayMove?: (uci: string) => void;
}) {
  const [data, setData] = useState<OpeningEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      setErr(false);
      fetchOpening(fen, ac.signal)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setErr(d === null);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setData(null);
          setErr(true);
          setLoading(false);
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
      ac.abort();
    };
  }, [fen]);

  const wrap: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.18)",
    color: "#e2e8f0",
    fontSize: 12,
  };
  const label: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.4,
  };

  if (loading && !data) {
    return (
      <div style={wrap}>
        <div style={label}>ДЕБЮТ · МАСТЕРА</div>
        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>Загружаю мастер-партии…</div>
      </div>
    );
  }

  const moves = data?.moves ?? [];
  if (err || moves.length === 0) {
    return (
      <div style={wrap}>
        <div style={label}>ДЕБЮТ · МАСТЕРА</div>
        {data?.opening?.name && (
          <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>
            {data.opening.eco ? `${data.opening.eco} ` : ""}
            {data.opening.name}
          </div>
        )}
        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
          Нет мастер-партий из этой позиции
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={label}>ДЕБЮТ · МАСТЕРА</div>
        {loading && <span style={{ fontSize: 10, color: "#64748b" }}>…</span>}
      </div>
      {data?.opening?.name && (
        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#a5b4fc" }}>
          {data.opening.eco ? `${data.opening.eco} ` : ""}
          {data.opening.name}
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {moves.map((m) => {
          const total = m.white + m.draws + m.black;
          const wp = total > 0 ? (m.white / total) * 100 : 0;
          const dp = total > 0 ? (m.draws / total) * 100 : 0;
          const bp = total > 0 ? (m.black / total) * 100 : 0;
          const clickable = !!onPlayMove;
          return (
            <div
              key={m.uci}
              onClick={clickable ? () => onPlayMove!(m.uci) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 6px",
                borderRadius: 7,
                background: "rgba(148,163,184,0.06)",
                cursor: clickable ? "pointer" : "default",
              }}
              title={clickable ? `Сыграть ${m.san}` : m.san}
            >
              <span
                style={{
                  minWidth: 42,
                  fontWeight: 800,
                  fontFamily: "ui-monospace,monospace",
                  color: "#f1f5f9",
                }}
              >
                {m.san}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    height: 6,
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "#334155",
                  }}
                >
                  <div style={{ width: `${wp}%`, background: "#f8fafc" }} />
                  <div style={{ width: `${dp}%`, background: "#94a3b8" }} />
                  <div style={{ width: `${bp}%`, background: "#0f172a" }} />
                </div>
              </div>
              <span
                style={{
                  minWidth: 44,
                  textAlign: "right",
                  fontSize: 11,
                  color: "#cbd5e1",
                  fontFamily: "ui-monospace,monospace",
                }}
                title="Всего мастер-партий"
              >
                {oeShortNum(total)}
              </span>
              <span
                style={{
                  minWidth: 34,
                  textAlign: "right",
                  fontSize: 10.5,
                  color: "#64748b",
                  fontFamily: "ui-monospace,monospace",
                }}
                title="Средний рейтинг"
              >
                {m.averageRating || "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
