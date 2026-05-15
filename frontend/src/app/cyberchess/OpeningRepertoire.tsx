"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookReply,
  ECO_PRESETS,
  EcoInfo,
  EcoPreset,
  GMGame,
  PositionTotals,
  RepertoireBranch,
  RepertoireColor,
  TTL_PRESETS,
  TtlKey,
  clearRepertoireCaches,
  defaultRepertoire,
  detectECO,
  detectECOFromMoves,
  fetchGMGames,
  fetchPositionTotals,
  fetchRealBookStats,
  getCacheTtl,
  loadRepertoire,
  mockBookStats,
  newBranchFromEco,
  newBranchFromPreset,
  recentStreak,
  saveRepertoire,
  setCacheTtl,
  successRate,
} from "./openingRepertoireData";

type Tab = "branches" | "drill" | "stats" | "gmgames" | "settings";

type Props = {
  open: boolean;
  onClose: () => void;
  /** if true → render as full page, not modal overlay */
  fullPage?: boolean;
  /** Current game FEN (for auto-detect button) */
  currentFen?: string;
  /** Current game UCI move list (preferred for Lichess explorer) */
  currentUciMoves?: string[];
  /** Current game SAN move list (used when adding from current position) */
  currentSanMoves?: string[];
};

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

export default function OpeningRepertoire({
  open,
  onClose,
  fullPage = false,
  currentFen,
  currentUciMoves,
  currentSanMoves,
}: Props) {
  const [branches, setBranches] = useState<RepertoireBranch[]>([]);
  const [tab, setTab] = useState<Tab>("branches");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [drillStep, setDrillStep] = useState(0);
  const [drillInput, setDrillInput] = useState("");
  const [drillStatus, setDrillStatus] = useState<"idle" | "good" | "bad" | "done">("idle");
  const [drillErrors, setDrillErrors] = useState(0);

  // Load from storage on mount
  useEffect(() => {
    if (!open && !fullPage) return;
    const loaded = loadRepertoire();
    setBranches(loaded.length ? loaded : defaultRepertoire());
  }, [open, fullPage]);

  // Persist on change
  useEffect(() => {
    if (branches.length > 0) {
      saveRepertoire(branches);
    }
  }, [branches]);

  if (!open && !fullPage) return null;

  const drillBranch = branches.find((b) => b.id === drillId);

  const startDrill = (id: string) => {
    setDrillId(id);
    setDrillStep(0);
    setDrillInput("");
    setDrillStatus("idle");
    setDrillErrors(0);
    setTab("drill");
  };

  const submitDrillMove = () => {
    if (!drillBranch) return;
    const expected = drillBranch.moves[drillStep];
    const userMove = drillInput.trim();
    if (!userMove) return;

    const ok =
      userMove.toLowerCase().replace(/[+#!?]/g, "") ===
      expected.toLowerCase().replace(/[+#!?]/g, "");

    if (ok) {
      const nextStep = drillStep + 1;
      setDrillInput("");
      if (nextStep >= drillBranch.moves.length) {
        // drill complete
        setDrillStatus("done");
        setBranches((prev) =>
          prev.map((b) =>
            b.id === drillBranch.id
              ? {
                  ...b,
                  attempts: b.attempts + 1,
                  successes: b.successes + (drillErrors === 0 ? 1 : 0),
                  lastReview: Date.now(),
                }
              : b
          )
        );
      } else {
        setDrillStatus("good");
        setDrillStep(nextStep);
      }
    } else {
      setDrillStatus("bad");
      setDrillErrors((e) => e + 1);
    }
  };

  const moveBranch = (id: string, dir: -1 | 1) => {
    setBranches((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const deleteBranch = (id: string) => {
    if (!confirm("Удалить эту ветку?")) return;
    setBranches((prev) => prev.filter((b) => b.id !== id));
    if (editingId === id) setEditingId(null);
    if (drillId === id) {
      setDrillId(null);
      setTab("branches");
    }
  };

  const updateBranch = (id: string, patch: Partial<RepertoireBranch>) => {
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const addPresetBranch = (preset: EcoPreset, customName?: string) => {
    const b = newBranchFromPreset(preset, customName);
    setBranches((prev) => [...prev, b]);
    setAddOpen(false);
  };

  const addDetectedBranch = (
    eco: string,
    name: string,
    moves: string[],
    color: RepertoireColor
  ) => {
    const b = newBranchFromEco(eco, name, moves, color, "Добавлено из текущей партии");
    setBranches((prev) => [...prev, b]);
  };

  // ===== Layout =====
  const containerStyle: React.CSSProperties = fullPage
    ? {
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: "32px 20px",
      }
    : {
        position: "fixed",
        inset: 0,
        background: "rgba(4, 1, 12, 0.78)",
        backdropFilter: "blur(8px)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: '"Inter", system-ui, sans-serif',
      };

  const panelStyle: React.CSSProperties = fullPage
    ? {
        maxWidth: 1100,
        margin: "0 auto",
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: 28,
        color: COLORS.text,
      }
    : {
        width: "min(1100px, 100%)",
        maxHeight: "92vh",
        overflow: "auto",
        background: COLORS.panel,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 16,
        padding: 28,
        color: COLORS.text,
        boxShadow: "0 20px 80px rgba(168, 85, 247, 0.25)",
      };

  return (
    <div style={containerStyle} onClick={fullPage ? undefined : onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <Header onClose={onClose} fullPage={fullPage} />

        {(currentFen || (currentUciMoves && currentUciMoves.length > 0)) && (
          <AutoDetectBar
            currentFen={currentFen}
            currentUciMoves={currentUciMoves}
            currentSanMoves={currentSanMoves}
            onAdd={addDetectedBranch}
          />
        )}

        <Tabs tab={tab} setTab={setTab} />

        {tab === "branches" && (
          <BranchesTab
            branches={branches}
            editingId={editingId}
            setEditingId={setEditingId}
            addOpen={addOpen}
            setAddOpen={setAddOpen}
            addPresetBranch={addPresetBranch}
            moveBranch={moveBranch}
            deleteBranch={deleteBranch}
            updateBranch={updateBranch}
            startDrill={startDrill}
          />
        )}

        {tab === "drill" && (
          <DrillTab
            branches={branches}
            drillBranch={drillBranch}
            drillId={drillId}
            drillStep={drillStep}
            drillInput={drillInput}
            setDrillInput={setDrillInput}
            drillStatus={drillStatus}
            drillErrors={drillErrors}
            submitDrillMove={submitDrillMove}
            startDrill={startDrill}
            resetDrill={() => {
              setDrillId(null);
              setDrillStep(0);
              setDrillInput("");
              setDrillStatus("idle");
              setDrillErrors(0);
            }}
          />
        )}

        {tab === "stats" && <StatsTab branches={branches} />}
        {tab === "gmgames" && <GMGamesTab branches={branches} />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// ===== Header =====
function Header({ onClose, fullPage }: { onClose: () => void; fullPage: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.accentBright,
            letterSpacing: 0.4,
          }}
        >
          Дебютный репертуар
        </div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>
          Сохраняй свои ветки, тренируй по памяти, изучай реальную статистику Lichess.
        </div>
      </div>
      {!fullPage && (
        <button
          onClick={onClose}
          style={{
            padding: "8px 14px",
            background: "transparent",
            color: COLORS.textDim,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Закрыть ✕
        </button>
      )}
    </div>
  );
}

// ===== Auto-Detect Bar (from current game) =====
function AutoDetectBar({
  currentFen,
  currentUciMoves,
  currentSanMoves,
  onAdd,
}: {
  currentFen?: string;
  currentUciMoves?: string[];
  currentSanMoves?: string[];
  onAdd: (eco: string, name: string, moves: string[], color: RepertoireColor) => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [info, setInfo] = useState<EcoInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleDetect = async () => {
    setDetecting(true);
    setErr(null);
    setInfo(null);
    try {
      let res: EcoInfo | null = null;
      if (currentUciMoves && currentUciMoves.length > 0) {
        res = await detectECOFromMoves(currentUciMoves);
      } else if (currentFen) {
        res = await detectECO(currentFen);
      }
      if (!res || !res.eco) {
        setErr("Не удалось определить дебют (нет данных или офлайн).");
      } else {
        setInfo(res);
      }
    } catch {
      setErr("Ошибка сети.");
    } finally {
      setDetecting(false);
    }
  };

  const handleAdd = (color: RepertoireColor) => {
    if (!info) return;
    const moves = currentSanMoves && currentSanMoves.length > 0 ? currentSanMoves : [];
    onAdd(info.eco, info.name, moves, color);
    setInfo(null);
  };

  return (
    <div
      style={{
        background: "rgba(74, 222, 128, 0.07)",
        border: `1px solid ${COLORS.greenDim}`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13, color: COLORS.text, flex: "1 1 auto" }}>
        <strong style={{ color: COLORS.green }}>↗ Из текущей партии:</strong>{" "}
        {info ? (
          <span>
            <span
              style={{
                fontFamily: "monospace",
                background: "rgba(192,132,252,0.15)",
                color: COLORS.accentBright,
                padding: "2px 6px",
                borderRadius: 4,
                marginRight: 6,
              }}
            >
              {info.eco}
            </span>
            <span style={{ fontWeight: 600 }}>{info.name}</span>
          </span>
        ) : (
          <span style={{ color: COLORS.textDim }}>
            определить дебют и добавить как ветку
          </span>
        )}
      </div>
      {!info && (
        <button
          onClick={handleDetect}
          disabled={detecting}
          style={{
            padding: "7px 14px",
            background: detecting ? "transparent" : COLORS.green,
            color: detecting ? COLORS.textDim : COLORS.black,
            border: `1px solid ${COLORS.green}`,
            borderRadius: 8,
            cursor: detecting ? "wait" : "pointer",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {detecting ? "Определяем…" : "🔍 Определить ECO"}
        </button>
      )}
      {info && (
        <>
          <button
            onClick={() => handleAdd("white")}
            style={{
              padding: "6px 12px",
              background: COLORS.white,
              color: COLORS.black,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            + Как белые
          </button>
          <button
            onClick={() => handleAdd("black")}
            style={{
              padding: "6px 12px",
              background: COLORS.black,
              color: COLORS.white,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            + Как чёрные
          </button>
          <button
            onClick={() => setInfo(null)}
            style={{
              padding: "6px 10px",
              background: "transparent",
              color: COLORS.textDim,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </>
      )}
      {err && (
        <div style={{ fontSize: 12, color: COLORS.red, width: "100%" }}>{err}</div>
      )}
    </div>
  );
}

// ===== Tabs =====
function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "branches", label: "Мои ветки" },
    { key: "drill", label: "Тренировка" },
    { key: "stats", label: "Статистика" },
    { key: "gmgames", label: "GM партии" },
    { key: "settings", label: "Настройки" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 20,
        padding: 4,
        background: COLORS.panelLight,
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            flex: "1 1 100px",
            padding: "10px 14px",
            background: tab === t.key ? COLORS.accent : "transparent",
            color: tab === t.key ? COLORS.black : COLORS.text,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: tab === t.key ? 700 : 500,
            fontSize: 13,
            transition: "all 0.15s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ===== Branches Tab =====
function BranchesTab(props: {
  branches: RepertoireBranch[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  addPresetBranch: (preset: EcoPreset, customName?: string) => void;
  moveBranch: (id: string, dir: -1 | 1) => void;
  deleteBranch: (id: string) => void;
  updateBranch: (id: string, patch: Partial<RepertoireBranch>) => void;
  startDrill: (id: string) => void;
}) {
  const {
    branches,
    editingId,
    setEditingId,
    addOpen,
    setAddOpen,
    addPresetBranch,
    moveBranch,
    deleteBranch,
    updateBranch,
    startDrill,
  } = props;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: COLORS.textDim }}>
          Всего веток: <strong style={{ color: COLORS.accentBright }}>{branches.length}</strong>
        </div>
        <button
          onClick={() => setAddOpen(!addOpen)}
          style={{
            padding: "8px 16px",
            background: addOpen ? "transparent" : COLORS.accent,
            color: addOpen ? COLORS.accentBright : COLORS.black,
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {addOpen ? "✕ Отмена" : "+ Добавить ветку"}
        </button>
      </div>

      {addOpen && <AddBranchPanel onAdd={addPresetBranch} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {branches.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.textDim }}>
            Пока пусто. Добавь первую ветку.
          </div>
        )}
        {branches.map((b, idx) => (
          <BranchCard
            key={b.id}
            branch={b}
            isFirst={idx === 0}
            isLast={idx === branches.length - 1}
            isEditing={editingId === b.id}
            onEditToggle={() => setEditingId(editingId === b.id ? null : b.id)}
            onMove={(dir) => moveBranch(b.id, dir)}
            onDelete={() => deleteBranch(b.id)}
            onUpdate={(patch) => updateBranch(b.id, patch)}
            onDrill={() => startDrill(b.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AddBranchPanel({
  onAdd,
}: {
  onAdd: (preset: EcoPreset, customName?: string) => void;
}) {
  const [selectedEco, setSelectedEco] = useState<string>(ECO_PRESETS[0].eco);
  const [customName, setCustomName] = useState("");
  const [color, setColor] = useState<RepertoireColor>(ECO_PRESETS[0].color);

  const preset = ECO_PRESETS.find((p) => p.eco === selectedEco) || ECO_PRESETS[0];

  return (
    <div
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.accentBright }}>
        Выбери дебют из пресетов
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>ECO / Дебют</label>
          <select
            value={selectedEco}
            onChange={(e) => {
              setSelectedEco(e.target.value);
              const p = ECO_PRESETS.find((x) => x.eco === e.target.value);
              if (p) setColor(p.color);
            }}
            style={inputStyle}
          >
            {ECO_PRESETS.map((p) => (
              <option key={p.eco} value={p.eco} style={{ background: COLORS.bg }}>
                {p.eco} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Цвет</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setColor("white")}
              style={colorToggleStyle(color === "white", "white")}
            >
              ♔ Белые
            </button>
            <button
              onClick={() => setColor("black")}
              style={colorToggleStyle(color === "black", "black")}
            >
              ♚ Чёрные
            </button>
          </div>
        </div>
      </div>
      <label style={labelStyle}>Своё название (опционально)</label>
      <input
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        placeholder={preset.name}
        style={inputStyle}
      />
      <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 10 }}>
        Ходы: <code style={{ color: COLORS.accentBright }}>{preset.moves.join(" ")}</code>
      </div>
      <button
        onClick={() => onAdd({ ...preset, color }, customName || undefined)}
        style={{
          marginTop: 14,
          padding: "10px 20px",
          background: COLORS.green,
          color: COLORS.black,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        Добавить
      </button>
    </div>
  );
}

function BranchCard(props: {
  branch: RepertoireBranch;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  onEditToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<RepertoireBranch>) => void;
  onDrill: () => void;
}) {
  const {
    branch,
    isFirst,
    isLast,
    isEditing,
    onEditToggle,
    onMove,
    onDelete,
    onUpdate,
    onDrill,
  } = props;

  const rate = successRate(branch);
  const colorBadge = branch.color === "white" ? "♔" : "♚";
  const colorBg = branch.color === "white" ? COLORS.white : COLORS.black;
  const colorText = branch.color === "white" ? COLORS.black : COLORS.white;

  return (
    <div
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                background: colorBg,
                color: colorText,
                padding: "3px 8px",
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
                padding: "3px 7px",
                background: "rgba(192, 132, 252, 0.15)",
                color: COLORS.accentBright,
                borderRadius: 5,
                fontFamily: "monospace",
                fontWeight: 600,
              }}
            >
              {branch.eco}
            </span>
            {isEditing ? (
              <input
                value={branch.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                style={{ ...inputStyle, fontSize: 15, fontWeight: 600, padding: "4px 8px" }}
              />
            ) : (
              <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>
                {branch.name}
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: COLORS.textDim,
              fontFamily: "monospace",
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
          <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12 }}>
            <span style={{ color: COLORS.textDim }}>
              Попыток: <strong style={{ color: COLORS.text }}>{branch.attempts}</strong>
            </span>
            <span style={{ color: COLORS.textDim }}>
              Успех:{" "}
              <strong style={{ color: rate >= 70 ? COLORS.green : rate >= 40 ? COLORS.yellow : COLORS.red }}>
                {rate}%
              </strong>
            </span>
          </div>
          {isEditing && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Заметки</label>
              <textarea
                value={branch.notes || ""}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          )}
          {!isEditing && branch.notes && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: COLORS.textDim,
                fontStyle: "italic",
                borderLeft: `2px solid ${COLORS.accent}`,
                paddingLeft: 8,
              }}
            >
              {branch.notes}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 16 }}>
          <button onClick={onDrill} style={primaryBtn}>
            ▶ Drill
          </button>
          <button onClick={onEditToggle} style={ghostBtn}>
            {isEditing ? "✓ OK" : "✎ Edit"}
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => onMove(-1)}
              disabled={isFirst}
              style={{ ...iconBtn, opacity: isFirst ? 0.3 : 1 }}
            >
              ↑
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={isLast}
              style={{ ...iconBtn, opacity: isLast ? 0.3 : 1 }}
            >
              ↓
            </button>
          </div>
          {isEditing && (
            <button onClick={onDelete} style={dangerBtn}>
              🗑 Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Drill Tab =====
function DrillTab(props: {
  branches: RepertoireBranch[];
  drillBranch: RepertoireBranch | undefined;
  drillId: string | null;
  drillStep: number;
  drillInput: string;
  setDrillInput: (v: string) => void;
  drillStatus: "idle" | "good" | "bad" | "done";
  drillErrors: number;
  submitDrillMove: () => void;
  startDrill: (id: string) => void;
  resetDrill: () => void;
}) {
  const {
    branches,
    drillBranch,
    drillStep,
    drillInput,
    setDrillInput,
    drillStatus,
    drillErrors,
    submitDrillMove,
    startDrill,
    resetDrill,
  } = props;

  if (!drillBranch) {
    return (
      <div>
        <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 14 }}>
          Выбери ветку для тренировки:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => startDrill(b.id)}
              style={{
                padding: "12px 16px",
                background: COLORS.panelLight,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                color: COLORS.text,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3 }}>
                  {b.eco} — {b.moves.length} ходов
                </div>
              </div>
              <span style={{ color: COLORS.accent, fontSize: 18 }}>▶</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const progress = (drillStep / drillBranch.moves.length) * 100;
  const movesPlayed = drillBranch.moves.slice(0, drillStep);
  const nextMoveNumber = Math.floor(drillStep / 2) + 1;
  const isWhiteToMove = drillStep % 2 === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.accentBright }}>
            {drillBranch.name}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
            {drillBranch.eco} — {drillBranch.color === "white" ? "За белых" : "За чёрных"}
          </div>
        </div>
        <button onClick={resetDrill} style={ghostBtn}>
          ← Выбрать другую
        </button>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 8,
          background: COLORS.panelLight,
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.green})`,
            transition: "width 0.2s",
          }}
        />
      </div>

      {/* Move list */}
      <div
        style={{
          background: COLORS.panelLight,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          minHeight: 80,
          fontFamily: "monospace",
          fontSize: 14,
        }}
      >
        {movesPlayed.length === 0 && (
          <span style={{ color: COLORS.textDim, fontStyle: "italic" }}>
            Начни с первого хода...
          </span>
        )}
        {movesPlayed.map((m, i) => (
          <span key={i} style={{ marginRight: 8 }}>
            {i % 2 === 0 && (
              <span style={{ color: COLORS.accent }}>{Math.floor(i / 2) + 1}.</span>
            )}{" "}
            <span style={{ color: COLORS.green }}>{m}</span>
          </span>
        ))}
        {drillStatus !== "done" && (
          <span
            style={{
              color: COLORS.yellow,
              marginLeft: 6,
              padding: "2px 6px",
              background: "rgba(250, 204, 21, 0.1)",
              borderRadius: 4,
            }}
          >
            {isWhiteToMove && `${nextMoveNumber}.`} ?
          </span>
        )}
      </div>

      {drillStatus === "done" ? (
        <div
          style={{
            padding: 20,
            background: drillErrors === 0 ? COLORS.greenDim : "rgba(250, 204, 21, 0.12)",
            border: `1px solid ${drillErrors === 0 ? COLORS.green : COLORS.yellow}`,
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {drillErrors === 0 ? "Идеально!" : "Завершено"}
          </div>
          <div style={{ color: COLORS.textDim, fontSize: 13 }}>
            Ошибок в этом прогоне: <strong>{drillErrors}</strong>
          </div>
          <button onClick={resetDrill} style={{ ...primaryBtn, marginTop: 14 }}>
            Новый прогон
          </button>
        </div>
      ) : (
        <div>
          <label style={labelStyle}>
            {isWhiteToMove ? "Ход белых" : "Ход чёрных"} (введи в SAN: e4, Nf3, O-O…)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={drillInput}
              onChange={(e) => setDrillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitDrillMove();
              }}
              autoFocus
              placeholder="ход..."
              style={{ ...inputStyle, flex: 1, fontSize: 16, fontFamily: "monospace" }}
            />
            <button onClick={submitDrillMove} style={primaryBtn}>
              Проверить
            </button>
          </div>
          {drillStatus === "good" && (
            <div style={{ marginTop: 10, color: COLORS.green, fontSize: 13 }}>
              Верно! Дальше →
            </div>
          )}
          {drillStatus === "bad" && (
            <div style={{ marginTop: 10, color: COLORS.red, fontSize: 13 }}>
              Не тот ход. Попробуй ещё раз. Подсказка появится после 3 ошибок.
              {drillErrors >= 3 && (
                <div style={{ marginTop: 6, color: COLORS.yellow }}>
                  💡 Правильный ход: <strong>{drillBranch.moves[drillStep]}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Stats Tab (REAL LICHESS DATA) =====
function StatsTab({ branches }: { branches: RepertoireBranch[] }) {
  const totals = useMemo(() => {
    const attempts = branches.reduce((s, b) => s + b.attempts, 0);
    const successes = branches.reduce((s, b) => s + b.successes, 0);
    const rate = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
    return { attempts, successes, rate };
  }, [branches]);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="Всего веток" value={branches.length} />
        <StatCard label="Попыток" value={totals.attempts} />
        <StatCard label="Общий успех" value={`${totals.rate}%`} accent />
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: COLORS.accentBright }}>
        Книжная статистика
      </div>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 14 }}>
        Источник: Lichess Opening Explorer (community DB). Кэш по TTL из настроек.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {branches.map((b) => (
          <BranchStatsRow key={b.id} branch={b} />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: accent ? COLORS.green : COLORS.accentBright,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BranchStatsRow({ branch }: { branch: RepertoireBranch }) {
  const [replies, setReplies] = useState<BookReply[] | null>(null);
  const [totals, setTotals] = useState<PositionTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"lichess" | "mock">("mock");

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      // We don't have UCI here (branch only stores SAN), so fetchRealBookStats
      // returns mock fallback. Still call it so cache populates on future UCI use.
      const r = await fetchRealBookStats(branch.moves, { signal: ctrl.signal });
      // Try totals (will return null without UCI).
      const t = await fetchPositionTotals(branch.moves, { signal: ctrl.signal });
      if (cancelled) return;
      setReplies(r);
      setTotals(t);
      setSource(t ? "lichess" : "mock");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [branch.id, branch.moves]);

  const streak = recentStreak(branch);
  const stats = replies || mockBookStats(branch);
  const avgRating = stats.find((s) => s.averageRating)?.averageRating;

  return (
    <div
      style={{
        background: COLORS.panelLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{branch.name}</span>
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              padding: "2px 6px",
              background: "rgba(192,132,252,0.15)",
              color: COLORS.accent,
              borderRadius: 4,
              fontFamily: "monospace",
            }}
          >
            {branch.eco}
          </span>
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              padding: "2px 6px",
              background:
                source === "lichess" ? "rgba(74,222,128,0.15)" : "rgba(168,85,247,0.15)",
              color: source === "lichess" ? COLORS.green : COLORS.textDim,
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {source === "lichess" ? "LICHESS" : "MOCK (нет UCI)"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {streak.map((s, i) => (
            <div
              key={i}
              title={s ? "успех" : "пропуск"}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: s ? COLORS.green : COLORS.panel,
                border: `1px solid ${s ? COLORS.green : COLORS.border}`,
              }}
            />
          ))}
        </div>
      </div>

      {totals && totals.total > 0 && (
        <div
          style={{
            fontSize: 12,
            color: COLORS.text,
            marginBottom: 10,
            padding: "8px 10px",
            background: "rgba(74,222,128,0.06)",
            border: `1px solid ${COLORS.greenDim}`,
            borderRadius: 6,
          }}
        >
          Из <strong>{shortNum(totals.total)}</strong> партий:{" "}
          <strong style={{ color: COLORS.white }}>
            White {Math.round((totals.white / totals.total) * 100)}%
          </strong>{" "}
          /{" "}
          <strong>Draw {Math.round((totals.draws / totals.total) * 100)}%</strong> /{" "}
          <strong style={{ color: COLORS.textDim }}>
            Black {Math.round((totals.black / totals.total) * 100)}%
          </strong>
          {avgRating && (
            <span style={{ marginLeft: 8, color: COLORS.textDim }}>
              · средний рейтинг ~{avgRating}
            </span>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
        {loading ? "Загружаем статистику…" : "Топ ответов противника:"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {stats.slice(0, 3).map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 50,
                fontFamily: "monospace",
                fontWeight: 600,
                color: COLORS.accentBright,
              }}
            >
              {s.move}
            </span>
            <span style={{ width: 70, fontSize: 11, color: COLORS.textDim }}>
              {shortNum(s.games)} игр
            </span>
            <div
              style={{
                flex: 1,
                height: 18,
                display: "flex",
                borderRadius: 4,
                overflow: "hidden",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  width: `${s.white}%`,
                  background: COLORS.white,
                  color: COLORS.black,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.white}%
              </div>
              <div
                style={{
                  width: `${s.draw}%`,
                  background: COLORS.textDim,
                  color: COLORS.black,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.draw}%
              </div>
              <div
                style={{
                  width: `${s.black}%`,
                  background: COLORS.black,
                  color: COLORS.white,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.black}%
              </div>
            </div>
            {s.averageRating && (
              <span style={{ width: 56, fontSize: 10, color: COLORS.textDim }}>
                ~{s.averageRating}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// ===== GM Games Tab =====
function GMGamesTab({ branches }: { branches: RepertoireBranch[] }) {
  const [selectedId, setSelectedId] = useState<string>(branches[0]?.id || "");
  const [games, setGames] = useState<GMGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const branch = branches.find((b) => b.id === selectedId);

  useEffect(() => {
    if (!branch) return;
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setErr(null);
    (async () => {
      // No UCI available — fetchGMGames will return [] without UCI.
      // We still call detectECO-style lookup as best effort.
      const g = await fetchGMGames(branch.eco, { signal: ctrl.signal, limit: 10 });
      if (cancelled) return;
      setGames(g);
      if (g.length === 0)
        setErr(
          "GM-партии недоступны без UCI-ходов из реальной партии. Открой ветку из текущей позиции на доске для полного списка."
        );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [branch?.id, branch?.eco]);

  if (branches.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: COLORS.textDim }}>
        Нет веток. Сначала добавь хотя бы одну.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 14 }}>
        Партии мастеров (Lichess Masters DB — рейтинг ≥ 2200 OTB):
      </div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{ ...inputStyle, marginBottom: 16 }}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id} style={{ background: COLORS.bg }}>
            {b.eco} — {b.name}
          </option>
        ))}
      </select>

      {loading && (
        <div style={{ color: COLORS.textDim, padding: 14 }}>Загружаем партии…</div>
      )}
      {err && (
        <div
          style={{
            padding: 14,
            background: "rgba(250,204,21,0.08)",
            border: `1px solid ${COLORS.yellow}`,
            borderRadius: 10,
            color: COLORS.yellow,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {games.map((g, i) => (
          <a
            key={i}
            href={g.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "12px 14px",
              background: COLORS.panelLight,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              color: COLORS.text,
              textDecoration: "none",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = COLORS.borderStrong;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = COLORS.border;
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  <span style={{ color: COLORS.white }}>{g.white.name}</span>
                  {g.white.rating && (
                    <span style={{ color: COLORS.textDim, fontSize: 12, marginLeft: 4 }}>
                      ({g.white.rating})
                    </span>
                  )}
                  {" — "}
                  <span style={{ color: COLORS.textDim }}>{g.black.name}</span>
                  {g.black.rating && (
                    <span style={{ color: COLORS.textDim, fontSize: 12, marginLeft: 4 }}>
                      ({g.black.rating})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                  {g.year || "—"}
                  {g.event ? ` · ${g.event}` : ""}
                  {g.url ? " · откроется на Lichess ↗" : ""}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 14,
                  color:
                    g.result === "1-0"
                      ? COLORS.green
                      : g.result === "0-1"
                      ? COLORS.red
                      : COLORS.yellow,
                  marginLeft: 12,
                }}
              >
                {g.result}
              </div>
            </div>
          </a>
        ))}
        {!loading && games.length === 0 && !err && (
          <div style={{ color: COLORS.textDim, padding: 14, textAlign: "center" }}>
            Партии не найдены.
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Settings Tab =====
function SettingsTab() {
  const [ttl, setTtl] = useState<TtlKey>("day");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setTtl(getCacheTtl());
  }, []);

  const apply = (key: TtlKey) => {
    setTtl(key);
    setCacheTtl(key);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const ttlLabel: Record<TtlKey, string> = {
    hour: "1 час",
    day: "1 день",
    week: "1 неделя",
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: COLORS.accentBright }}>
        Кэш статистики Lichess
      </div>
      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 16 }}>
        Lichess Explorer limit ~60 запросов/мин. Кэшируй агрессивно, обновляй вручную при
        необходимости.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["hour", "day", "week"] as TtlKey[]).map((k) => (
          <button
            key={k}
            onClick={() => apply(k)}
            style={{
              flex: 1,
              padding: "12px 14px",
              background: ttl === k ? COLORS.accent : "transparent",
              color: ttl === k ? COLORS.black : COLORS.text,
              border: `1px solid ${ttl === k ? COLORS.accentBright : COLORS.border}`,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: ttl === k ? 700 : 500,
              fontSize: 13,
            }}
          >
            {ttlLabel[k]}
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>
              {Math.round(TTL_PRESETS[k] / 60000)} мин
            </div>
          </button>
        ))}
      </div>

      {savedFlash && (
        <div style={{ fontSize: 12, color: COLORS.green, marginBottom: 12 }}>
          ✓ Сохранено
        </div>
      )}

      <button
        onClick={() => {
          clearRepertoireCaches();
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1200);
        }}
        style={{
          padding: "8px 14px",
          background: "transparent",
          color: COLORS.yellow,
          border: `1px solid ${COLORS.yellow}`,
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Очистить кэш сейчас
      </button>
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

const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: COLORS.green,
  color: COLORS.black,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
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

const dangerBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: COLORS.red,
  border: `1px solid ${COLORS.red}`,
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 12,
};

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 28,
  background: "transparent",
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
};

function colorToggleStyle(active: boolean, c: RepertoireColor): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 12px",
    background: active ? (c === "white" ? COLORS.white : COLORS.black) : "transparent",
    color: active ? (c === "white" ? COLORS.black : COLORS.white) : COLORS.text,
    border: `1px solid ${active ? COLORS.accentBright : COLORS.border}`,
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
  };
}
