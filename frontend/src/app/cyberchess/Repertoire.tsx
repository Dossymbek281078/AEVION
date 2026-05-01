/* AEVION Personal Opening Repertoire.

   Lets the user save (and later replay/check against) their preferred opening
   sequences per colour. Stored entirely in localStorage — no server.

   Lichess has a similar Studies / Repertoire feature; this is our lighter take:
   - Save current move history as a named entry (autodetected ECO when possible).
   - On replay, the panel highlights "✓ on book" vs "✗ off book" relative to all
     entries that played the same first N moves.
   - One-click "play next book move" from the matching entry.
*/

"use client";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "aevion_repertoire_v1";

export type RepertoireEntry = {
  id: string;          // local random id
  name: string;        // user-supplied label, e.g. "Italian Main Line"
  color: "w" | "b";    // which side this is for
  moves: string[];     // SAN list
  eco?: string;        // best-guess ECO if known
  ecoName?: string;    // best-guess opening name
  createdAt: number;
  uses: number;        // times this line was played
  wins: number;        // times you won when playing this
  losses: number;
  draws: number;
};

export type Repertoire = { v: 1; entries: RepertoireEntry[] };

const EMPTY: Repertoire = { v: 1, entries: [] };

export function loadRepertoire(): Repertoire {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const r = JSON.parse(raw);
    if (r && r.v === 1 && Array.isArray(r.entries)) return r as Repertoire;
  } catch {}
  return EMPTY;
}
export function saveRepertoire(r: Repertoire) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
}

/** Match current hist (SAN) against entries → returns matches by length of common prefix. */
export function matchHist(rep: Repertoire, hist: string[], color: "w" | "b") {
  const matches: { entry: RepertoireEntry; matchedPlies: number; nextMove: string | null; isFullMatch: boolean }[] = [];
  for (const e of rep.entries) {
    if (e.color !== color) continue;
    let matched = 0;
    while (matched < e.moves.length && matched < hist.length && e.moves[matched] === hist[matched]) matched++;
    if (matched === 0) continue;
    matches.push({
      entry: e,
      matchedPlies: matched,
      nextMove: matched < e.moves.length ? e.moves[matched] : null,
      isFullMatch: matched === hist.length,
    });
  }
  matches.sort((a, b) => b.matchedPlies - a.matchedPlies);
  return matches;
}

type Props = {
  open: boolean;
  onClose: () => void;
  histSan: string[];
  myColor: "w" | "b";
  ecoHint?: { eco: string; name: string } | null;
  /** When user clicks "play this move" inside the panel. */
  onPlayMove: (san: string) => void;
};

export default function RepertoireModal({ open, onClose, histSan, myColor, ecoHint, onPlayMove }: Props) {
  const [rep, setRep] = useState<Repertoire>(() => loadRepertoire());
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<"all" | "w" | "b">("all");

  useEffect(() => { saveRepertoire(rep); }, [rep]);

  const visibleEntries = useMemo(
    () => rep.entries.filter(e => filter === "all" || e.color === filter)
                     .sort((a, b) => b.uses - a.uses || b.createdAt - a.createdAt),
    [rep.entries, filter]
  );

  const canSave = histSan.length >= 2;

  const handleSave = () => {
    if (!canSave) return;
    const entry: RepertoireEntry = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim() || (ecoHint?.name || `Линия ${rep.entries.length + 1}`),
      color: myColor,
      moves: histSan.slice(0, Math.min(20, histSan.length)),
      eco: ecoHint?.eco,
      ecoName: ecoHint?.name,
      createdAt: Date.now(),
      uses: 0, wins: 0, losses: 0, draws: 0,
    };
    setRep(r => ({ ...r, entries: [entry, ...r.entries] }));
    setName("");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Удалить эту линию из репертуара?")) return;
    setRep(r => ({ ...r, entries: r.entries.filter(e => e.id !== id) }));
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-label="Personal Opening Repertoire"
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>📚</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a", flex: 1 }}>
            Мой дебютный репертуар
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginLeft: 8 }}>
              · {rep.entries.length} {rep.entries.length === 1 ? "линия" : "линий"}
            </span>
          </h2>
          <button onClick={onClose} aria-label="Закрыть"
            style={{ border: "none", background: "#f1f5f9", color: "#0f172a", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>✕</button>
        </div>

        {/* Save current */}
        <div style={{ padding: 12, borderRadius: 10, background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)", border: "1px solid #a7f3d0", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#065f46", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
            Сохранить текущую партию
          </div>
          <div style={{ fontSize: 12, color: "#065f46", marginBottom: 8 }}>
            Текущая линия: <span style={{ fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>
              {histSan.length > 0 ? histSan.slice(0, 14).join(" ") + (histSan.length > 14 ? "…" : "") : "(пока нет ходов)"}
            </span>
            {ecoHint && <span style={{ marginLeft: 6, padding: "1px 6px", background: "#10b981", color: "#fff", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>{ecoHint.eco} · {ecoHint.name}</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={ecoHint?.name || "Название линии (опционально)"}
              style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1fae5", borderRadius: 6, fontSize: 12 }}/>
            <button onClick={handleSave} disabled={!canSave}
              style={{ padding: "8px 14px", border: "none", borderRadius: 6, background: canSave ? "#10b981" : "#cbd5e1", color: "#fff", fontSize: 12, fontWeight: 800, cursor: canSave ? "pointer" : "default" }}>
              💾 Сохранить ({myColor === "w" ? "белые" : "чёрные"})
            </button>
          </div>
          {!canSave && <div style={{ fontSize: 10, color: "#92400e", marginTop: 6 }}>Сделай хотя бы 2 хода чтобы сохранить линию.</div>}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {([["all", "Все"], ["w", "♔ Белые"], ["b", "♚ Чёрные"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ padding: "5px 12px", borderRadius: 16, border: filter === v ? "2px solid #0f766e" : "1px solid #e2e8f0", background: filter === v ? "#ccfbf1" : "#fff", color: "#0f172a", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>

        {/* List */}
        {visibleEntries.length === 0 ? (
          <div style={{ padding: 18, textAlign: "center", color: "#64748b", fontSize: 12, fontStyle: "italic" }}>
            Пока нет сохранённых линий. Сыграй партию и сохрани её сверху.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visibleEntries.map(e => {
              const total = e.uses;
              const wr = total > 0 ? Math.round((e.wins / total) * 100) : 0;
              return (
                <div key={e.id} style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fafafa" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{e.color === "w" ? "♔" : "♚"}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    {e.eco && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 5px", background: "#ddd6fe", color: "#5b21b6", borderRadius: 3, fontFamily: "ui-monospace, monospace" }}>{e.eco}</span>}
                    <button onClick={() => handleDelete(e.id)}
                      title="Удалить"
                      style={{ border: "none", background: "#fee2e2", color: "#991b1b", borderRadius: 4, padding: "1px 7px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#475569", marginBottom: 4, lineHeight: 1.4 }}>
                    {e.moves.slice(0, 12).map((m, i) => <span key={i}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}{m} </span>)}
                    {e.moves.length > 12 && "…"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "#64748b" }}>
                    <span>сыграно: <b style={{ color: "#0f172a" }}>{e.uses}</b></span>
                    {total > 0 && <>
                      <span>побед: <b style={{ color: "#10b981" }}>{e.wins}</b></span>
                      <span>ничьих: <b style={{ color: "#64748b" }}>{e.draws}</b></span>
                      <span>пораж.: <b style={{ color: "#dc2626" }}>{e.losses}</b></span>
                      <span>WR: <b style={{ color: wr >= 50 ? "#10b981" : "#dc2626" }}>{wr}%</b></span>
                    </>}
                    {/* Quick "play first 3 moves" preview */}
                    {e.moves.length > 0 && histSan.length === 0 && (
                      <button onClick={() => onPlayMove(e.moves[0])}
                        title="Сыграть первый ход линии"
                        style={{ marginLeft: "auto", border: "none", background: "#0e766e", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                        ▶ {e.moves[0]}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        <div style={{ marginTop: 14, padding: "8px 10px", background: "#f1f5f9", borderRadius: 6, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
          💡 Репертуар хранится локально в браузере. Открой Coach-таб → используй кнопку 📚 чтобы вернуться сюда. Сохранённые линии помогут тебе видеть «в книге ли я» прямо во время партии.
        </div>
      </div>
    </div>
  );
}
