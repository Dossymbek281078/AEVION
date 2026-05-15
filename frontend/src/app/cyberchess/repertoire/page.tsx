"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import OpeningRepertoire from "../OpeningRepertoire";
import {
  BookReply,
  PositionTotals,
  RepertoireBranch,
  exportRepertoireJson,
  fetchPositionTotals,
  fetchRealBookStats,
  importRepertoireJson,
  loadRepertoire,
  mockBookStats,
  recentStreak,
  saveRepertoire,
  successRate,
} from "../openingRepertoireData";

const COLORS = {
  bg: "#0b0414",
  panel: "rgba(20, 10, 36, 0.92)",
  panelLight: "rgba(40, 22, 64, 0.7)",
  border: "rgba(168, 85, 247, 0.28)",
  borderStrong: "rgba(168, 85, 247, 0.55)",
  text: "#e7d6ff",
  textDim: "#a892c4",
  accent: "#c084fc",
  accentBright: "#d8b4fe",
  green: "#4ade80",
  greenDim: "rgba(74, 222, 128, 0.22)",
  red: "#f87171",
  yellow: "#facc15",
  white: "#f8fafc",
  black: "#1e1b2b",
};

type Mode = "manage" | "search" | "compare" | "print";

export default function RepertoirePage() {
  const [mode, setMode] = useState<Mode>("manage");
  const [branches, setBranches] = useState<RepertoireBranch[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  // Reload from storage when mode flips back to manage (after import etc.)
  useEffect(() => {
    setBranches(loadRepertoire());
  }, [refreshTick, mode]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Link
            href="/cyberchess"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: COLORS.accent,
              textDecoration: "none",
              fontSize: 14,
              padding: "8px 14px",
              background: "rgba(20, 10, 36, 0.7)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
            }}
          >
            ← Вернуться в CyberChess
          </Link>

          <ModeSwitcher mode={mode} setMode={setMode} />
        </div>

        {mode !== "manage" && (
          <ToolBar
            mode={mode}
            branches={branches}
            onImported={() => setRefreshTick((t) => t + 1)}
          />
        )}
      </div>

      {mode === "manage" && (
        <OpeningRepertoire open={true} onClose={() => {}} fullPage={true} />
      )}

      {mode === "search" && (
        <SearchView branches={branches} />
      )}

      {mode === "compare" && (
        <CompareView branches={branches} />
      )}

      {mode === "print" && (
        <PrintView branches={branches} />
      )}
    </div>
  );
}

// ===== Mode Switcher =====
function ModeSwitcher({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const modes: { key: Mode; label: string; icon: string }[] = [
    { key: "manage", label: "Управление", icon: "🗂" },
    { key: "search", label: "Поиск", icon: "🔍" },
    { key: "compare", label: "Сравнить", icon: "⚖" },
    { key: "print", label: "Печать", icon: "🖨" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: COLORS.panelLight,
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          style={{
            padding: "8px 14px",
            background: mode === m.key ? COLORS.accent : "transparent",
            color: mode === m.key ? COLORS.black : COLORS.text,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: mode === m.key ? 700 : 500,
            fontSize: 13,
          }}
        >
          {m.icon} {m.label}
        </button>
      ))}
    </div>
  );
}

// ===== Tool Bar (Export / Import on non-manage modes) =====
function ToolBar({
  mode,
  branches,
  onImported,
}: {
  mode: Mode;
  branches: RepertoireBranch[];
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportRepertoireJson(branches);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `cyberchess-repertoire-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = importRepertoireJson(text);
    if (!imported) {
      alert("Не удалось распарсить файл. Ожидается JSON, экспортированный отсюда.");
      return;
    }
    if (!confirm(`Импортировать ${imported.length} веток? Текущий репертуар будет ЗАМЕНЁН.`)) {
      return;
    }
    saveRepertoire(imported);
    onImported();
    alert(`Импортировано: ${imported.length}`);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <button onClick={handleExport} style={ghostBtn}>
        ⬇ Экспорт JSON
      </button>
      <button onClick={handleImportClick} style={ghostBtn}>
        ⬆ Импорт JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        style={{ display: "none" }}
      />
      {mode === "print" && (
        <button
          onClick={() => window.print()}
          style={{ ...ghostBtn, color: COLORS.accentBright, borderColor: COLORS.accentBright }}
        >
          🖨 Печать страницы
        </button>
      )}
      <span style={{ fontSize: 12, color: COLORS.textDim, marginLeft: "auto" }}>
        Всего веток: <strong style={{ color: COLORS.text }}>{branches.length}</strong>
      </span>
    </div>
  );
}

// ===== Search View =====
function SearchView({ branches }: { branches: RepertoireBranch[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => {
      return (
        b.name.toLowerCase().includes(q) ||
        b.eco.toLowerCase().includes(q) ||
        (b.notes || "").toLowerCase().includes(q) ||
        b.moves.join(" ").toLowerCase().includes(q)
      );
    });
  }, [branches, query]);

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 20px 40px" }}>
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.accentBright, marginBottom: 10 }}>
          Поиск по веткам
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ECO, имя, заметки, ходы…"
          autoFocus
          style={{
            ...inputStyle,
            fontSize: 16,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        />
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 14 }}>
          Найдено: <strong style={{ color: COLORS.text }}>{filtered.length}</strong> из {branches.length}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((b) => (
            <SearchHitCard key={b.id} branch={b} query={query} />
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: COLORS.textDim }}>
              Ничего не найдено.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchHitCard({ branch, query }: { branch: RepertoireBranch; query: string }) {
  const colorBadge = branch.color === "white" ? "♔" : "♚";
  const rate = successRate(branch);

  return (
    <div
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span
          style={{
            background: branch.color === "white" ? COLORS.white : COLORS.black,
            color: branch.color === "white" ? COLORS.black : COLORS.white,
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {colorBadge}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 6px",
            background: "rgba(192, 132, 252, 0.15)",
            color: COLORS.accentBright,
            borderRadius: 5,
            fontFamily: "monospace",
            fontWeight: 600,
          }}
        >
          <Highlight text={branch.eco} query={query} />
        </span>
        <span style={{ fontWeight: 600 }}>
          <Highlight text={branch.name} query={query} />
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: COLORS.textDim }}>
          {rate}% успех · {branch.attempts} попыток
        </span>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textDim }}>
        <Highlight text={branch.moves.join(" ")} query={query} />
      </div>
      {branch.notes && (
        <div
          style={{
            fontSize: 12,
            color: COLORS.textDim,
            fontStyle: "italic",
            borderLeft: `2px solid ${COLORS.accent}`,
            paddingLeft: 8,
            marginTop: 8,
          }}
        >
          <Highlight text={branch.notes} query={query} />
        </div>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: "rgba(250, 204, 21, 0.35)",
          color: COLORS.text,
          padding: "0 2px",
          borderRadius: 2,
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ===== Compare View =====
function CompareView({ branches }: { branches: RepertoireBranch[] }) {
  const [leftId, setLeftId] = useState<string>(branches[0]?.id || "");
  const [rightId, setRightId] = useState<string>(branches[1]?.id || branches[0]?.id || "");

  // Sync when branches first load
  useEffect(() => {
    if (!leftId && branches[0]) setLeftId(branches[0].id);
    if (!rightId && branches[1]) setRightId(branches[1].id);
  }, [branches, leftId, rightId]);

  const left = branches.find((b) => b.id === leftId);
  const right = branches.find((b) => b.id === rightId);

  if (branches.length < 2) {
    return (
      <div style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 20px 40px" }}>
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 30,
            textAlign: "center",
            color: COLORS.textDim,
          }}
        >
          Для сравнения нужно минимум 2 ветки. Добавь ещё в режиме «Управление».
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 20px 40px" }}>
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.accentBright, marginBottom: 14 }}>
          Сравнение веток
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <BranchPicker
            branches={branches}
            value={leftId}
            onChange={setLeftId}
            label="Ветка A"
          />
          <BranchPicker
            branches={branches}
            value={rightId}
            onChange={setRightId}
            label="Ветка B"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          {left && <CompareCard branch={left} />}
          {right && <CompareCard branch={right} />}
        </div>
      </div>
    </div>
  );
}

function BranchPicker({
  branches,
  value,
  onChange,
  label,
}: {
  branches: RepertoireBranch[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {branches.map((b) => (
          <option key={b.id} value={b.id} style={{ background: COLORS.bg }}>
            {b.eco} — {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompareCard({ branch }: { branch: RepertoireBranch }) {
  const [replies, setReplies] = useState<BookReply[] | null>(null);
  const [totals, setTotals] = useState<PositionTotals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      const r = await fetchRealBookStats(branch.moves, { signal: ctrl.signal });
      const t = await fetchPositionTotals(branch.moves, { signal: ctrl.signal });
      if (cancelled) return;
      setReplies(r);
      setTotals(t);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [branch.id, branch.moves]);

  const stats = replies || mockBookStats(branch);
  const rate = successRate(branch);
  const colorBadge = branch.color === "white" ? "♔" : "♚";

  return (
    <div
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span
          style={{
            background: branch.color === "white" ? COLORS.white : COLORS.black,
            color: branch.color === "white" ? COLORS.black : COLORS.white,
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {colorBadge}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 6px",
            background: "rgba(192, 132, 252, 0.15)",
            color: COLORS.accentBright,
            borderRadius: 5,
            fontFamily: "monospace",
            fontWeight: 600,
          }}
        >
          {branch.eco}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{branch.name}</span>
      </div>

      <div
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: COLORS.textDim,
          marginBottom: 12,
        }}
      >
        {branch.moves.map((m, i) => (
          <span key={i}>
            {i % 2 === 0 && (
              <span style={{ color: COLORS.accent, marginRight: 3 }}>
                {Math.floor(i / 2) + 1}.
              </span>
            )}
            {m}{" "}
          </span>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <MiniStat label="Попыток" value={branch.attempts} />
        <MiniStat
          label="Успех"
          value={`${rate}%`}
          color={rate >= 70 ? COLORS.green : rate >= 40 ? COLORS.yellow : COLORS.red}
        />
      </div>

      {loading && <div style={{ fontSize: 12, color: COLORS.textDim }}>Грузим Lichess…</div>}

      {totals && totals.total > 0 && (
        <div
          style={{
            fontSize: 11,
            padding: "6px 8px",
            background: "rgba(74,222,128,0.06)",
            border: `1px solid ${COLORS.greenDim}`,
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          <strong>{shortNum(totals.total)}</strong> игр · W{" "}
          {Math.round((totals.white / totals.total) * 100)}% / D{" "}
          {Math.round((totals.draws / totals.total) * 100)}% / B{" "}
          {Math.round((totals.black / totals.total) * 100)}%
        </div>
      )}

      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>
        Топ ответы:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {stats.slice(0, 3).map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 40, fontFamily: "monospace", color: COLORS.accentBright }}>
              {s.move}
            </span>
            <span style={{ width: 50, color: COLORS.textDim }}>
              {shortNum(s.games)}
            </span>
            <div
              style={{
                flex: 1,
                height: 12,
                display: "flex",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${s.white}%`, background: COLORS.white }} />
              <div style={{ width: `${s.draw}%`, background: COLORS.textDim }} />
              <div style={{ width: `${s.black}%`, background: COLORS.black }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || COLORS.text }}>{value}</div>
    </div>
  );
}

function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// ===== Print View =====
function PrintView({ branches }: { branches: RepertoireBranch[] }) {
  return (
    <div style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 20px 40px" }}>
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            background: #fff !important;
            color: #000 !important;
            border: 1px solid #ccc !important;
            page-break-inside: avoid;
          }
          .print-eco {
            background: #eee !important;
            color: #000 !important;
          }
          .print-move-num {
            color: #555 !important;
          }
          .print-notes {
            color: #333 !important;
            border-left: 2px solid #888 !important;
          }
        }
      `}</style>

      <div
        className="print-card"
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.accentBright,
            marginBottom: 6,
          }}
          className="print-card"
        >
          Дебютный репертуар — печать
        </div>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 20 }}>
          Сгенерировано {new Date().toLocaleString("ru-RU")} · Всего веток: {branches.length}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {branches.map((b) => (
            <PrintBranchCard key={b.id} branch={b} />
          ))}
          {branches.length === 0 && (
            <div style={{ color: COLORS.textDim, padding: 20, textAlign: "center" }}>
              Репертуар пуст.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintBranchCard({ branch }: { branch: RepertoireBranch }) {
  const rate = successRate(branch);
  const streak = recentStreak(branch);

  return (
    <div
      className="print-card"
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          className="print-eco"
          style={{
            fontSize: 12,
            padding: "2px 8px",
            background: "rgba(192, 132, 252, 0.15)",
            color: COLORS.accentBright,
            borderRadius: 5,
            fontFamily: "monospace",
            fontWeight: 600,
          }}
        >
          {branch.eco}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{branch.name}</span>
        <span style={{ fontSize: 11, color: COLORS.textDim }}>
          {branch.color === "white" ? "(За белых)" : "(За чёрных)"}
        </span>
        <span style={{ fontSize: 11, color: COLORS.textDim, marginLeft: "auto" }}>
          Успех: <strong style={{ color: COLORS.text }}>{rate}%</strong> · {branch.attempts} попыток
        </span>
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 8 }}>
        {branch.moves.map((m, i) => (
          <span key={i} style={{ marginRight: 6 }}>
            {i % 2 === 0 && (
              <span className="print-move-num" style={{ color: COLORS.accent, marginRight: 3 }}>
                {Math.floor(i / 2) + 1}.
              </span>
            )}
            <strong>{m}</strong>
          </span>
        ))}
      </div>

      {branch.notes && (
        <div
          className="print-notes"
          style={{
            fontSize: 12,
            color: COLORS.textDim,
            fontStyle: "italic",
            borderLeft: `2px solid ${COLORS.accent}`,
            paddingLeft: 10,
            marginTop: 8,
          }}
        >
          {branch.notes}
        </div>
      )}

      <div style={{ display: "flex", gap: 3, marginTop: 8 }} className="no-print">
        {streak.map((s, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: s ? COLORS.green : "transparent",
              border: `1px solid ${s ? COLORS.green : COLORS.border}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ===== Shared styles =====
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: COLORS.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: COLORS.bg,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 13,
};
