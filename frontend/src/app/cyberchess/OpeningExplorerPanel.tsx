/* AEVION CyberChess — Opening Explorer panel.

   Right-panel view of opening theory for the current position. Two data tiers:

   1. LIVE Lichess Masters stats (fetchOpening → /api-backend/api/cyberchess-opening
      backend proxy). Full W/D/B bars + game counts + avg rating. Requires a
      Lichess API token on the backend (LICHESS_API_TOKEN), because since Feb 2026
      Lichess gated explorer.lichess.ovh behind login (anonymous → 401).
   2. FALLBACK self-contained book (getBookContinuations → bundled /openings.json,
      ~3,800 CC0 ECO lines / ~5,500 positions, computed client-side). Book/theory
      continuations with opening names, no stats. Always works offline — the panel
      is never empty on a known line.

   Robustness:
     - debounced ~350ms on fen change
     - AbortController cancels the in-flight request on fen change / unmount
     - never throws; out-of-book shows a calm message. */

"use client";
import { useEffect, useState } from "react";
import { fetchOpening, shortNum as oeShortNum, type OpeningEntry } from "./openingExplorer";
import { getBookContinuations, type BookResult } from "./localOpeningBook";

export default function OpeningExplorerPanel({
  fen,
  onPlayMove,
}: {
  fen: string;
  onPlayMove?: (uci: string) => void;
}) {
  const [data, setData] = useState<OpeningEntry | null>(null);
  const [book, setBook] = useState<BookResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      setErr(false);
      fetchOpening(fen, ac.signal)
        .then(async (d) => {
          if (!alive) return;
          setData(d);
          // Live master data present (token configured) → use it. Otherwise
          // fall back to the self-contained book so the panel is never empty.
          if (d && d.moves.length > 0) {
            setBook(null);
            setErr(false);
          } else {
            const b = await getBookContinuations(fen);
            if (!alive) return;
            setBook(b);
            setErr(b.moves.length === 0);
          }
          setLoading(false);
        })
        .catch(async () => {
          if (!alive) return;
          setData(null);
          try {
            const b = await getBookContinuations(fen);
            if (!alive) return;
            setBook(b);
            setErr(b.moves.length === 0);
          } catch {
            if (alive) setErr(true);
          }
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

  if (loading && !data && !book) {
    return (
      <div style={wrap}>
        <div style={label}>ДЕБЮТ</div>
        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>Загружаю дебютную теорию…</div>
      </div>
    );
  }

  const masterMoves = data?.moves ?? [];
  const isMaster = masterMoves.length > 0;
  const bookMoves = book?.moves ?? [];
  const opening = data?.opening ?? book?.opening ?? null;

  // Nothing to show from either tier → calm out-of-book message.
  if (!isMaster && bookMoves.length === 0) {
    return (
      <div style={wrap}>
        <div style={label}>ДЕБЮТ</div>
        {opening?.name && (
          <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>
            {opening.eco ? `${opening.eco} ` : ""}
            {opening.name}
          </div>
        )}
        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
          Позиция вне дебютной книги
        </div>
      </div>
    );
  }

  // ── Fallback tier: self-contained opening book (no master stats) ──
  if (!isMaster) {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={label}>ДЕБЮТНАЯ КНИГА</div>
          {loading && <span style={{ fontSize: 10, color: "#64748b" }}>…</span>}
        </div>
        {opening?.name && (
          <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#a5b4fc" }}>
            {opening.eco ? `${opening.eco} ` : ""}
            {opening.name}
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {bookMoves.map((m) => {
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
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 11,
                    color: "#cbd5e1",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`${m.eco} ${m.name}`}
                >
                  {m.name}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
          Книжные ходы из дебютной теории. Полная статистика мастер-партий Lichess —
          после подключения токена.
        </div>
      </div>
    );
  }

  // ── Live tier: Lichess master statistics ──
  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={label}>ДЕБЮТ · МАСТЕРА</div>
        {loading && <span style={{ fontSize: 10, color: "#64748b" }}>…</span>}
      </div>
      {opening?.name && (
        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#a5b4fc" }}>
          {opening.eco ? `${opening.eco} ` : ""}
          {opening.name}
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {masterMoves.map((m) => {
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
