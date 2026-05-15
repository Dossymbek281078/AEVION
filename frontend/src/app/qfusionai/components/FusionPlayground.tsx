"use client";

import { useState } from "react";

type Strategy = "speed" | "quality" | "cost" | "auto";

export type RouteResult = {
  result: string;
  provider: string;
  providerName: string;
  model: string;
  strategy: Strategy;
  latencyMs: number;
  tokensEstimate: number;
  decision_reason: string;
};

const STRATEGIES: { id: Strategy; label: string; description: string; color: string }[] = [
  { id: "auto", label: "Auto", description: "AI выбирает", color: "#00ff88" },
  { id: "speed", label: "Speed", description: "Быстрый", color: "#00ccff" },
  { id: "quality", label: "Quality", description: "Лучшее качество", color: "#cc88ff" },
  { id: "cost", label: "Cost", description: "Дешевле", color: "#ffcc00" },
];

const STRATEGY_BORDER: Record<Strategy, string> = {
  auto: "#00ff88",
  speed: "#00ccff",
  quality: "#cc88ff",
  cost: "#ffcc00",
};

interface Props {
  onResult?: (r: RouteResult) => void;
}

export default function FusionPlayground({ onResult }: Props) {
  const [prompt, setPrompt] = useState("Объясни в одном абзаце, что такое идемпотентность API.");
  const [strategy, setStrategy] = useState<Strategy>("auto");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { prompt: prompt.trim(), strategy };
      if (context.trim()) body.context = context.trim();
      const r = await fetch("/api-backend/api/qfusionai/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.message || data?.error || `HTTP ${r.status}`);
        return;
      }
      setResult(data as RouteResult);
      onResult?.(data as RouteResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const activeBorderColor = STRATEGY_BORDER[strategy];

  return (
    <div style={{
      background: "#050d05",
      border: `1px solid ${activeBorderColor}44`,
      borderRadius: 12,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      boxShadow: `0 0 24px ${activeBorderColor}22`,
      transition: "box-shadow 0.3s",
    }}>
      {/* Strategy selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#556655", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
          Strategy:
        </span>
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStrategy(s.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: `1px solid ${strategy === s.id ? s.color : "#1a2a1a"}`,
              background: strategy === s.id ? `${s.color}22` : "#0a120a",
              color: strategy === s.id ? s.color : "#445544",
              fontFamily: "monospace",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: strategy === s.id ? 700 : 400,
              transition: "all 0.15s",
            }}
            title={s.description}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Prompt textarea */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Введите запрос..."
        style={{
          width: "100%",
          background: "#020802",
          border: "1px solid #1a2a1a",
          borderRadius: 8,
          padding: "10px 12px",
          color: "#88cc88",
          fontFamily: "monospace",
          fontSize: 13,
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = activeBorderColor + "66"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#1a2a1a"; }}
      />

      {/* Optional context */}
      <div>
        <button
          type="button"
          onClick={() => setShowContext(!showContext)}
          style={{ background: "none", border: "none", color: "#446644", fontSize: 12, cursor: "pointer", fontFamily: "monospace", padding: 0 }}
        >
          {showContext ? "▼" : "▶"} Системный контекст (опционально)
        </button>
        {showContext && (
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder="Дополнительный контекст для системного промпта..."
            style={{
              marginTop: 6,
              width: "100%",
              background: "#020802",
              border: "1px solid #1a2a1a",
              borderRadius: 6,
              padding: "8px 10px",
              color: "#668866",
              fontFamily: "monospace",
              fontSize: 12,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>

      {/* Footer: char count + run button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#334433", fontSize: 11, fontFamily: "monospace" }}>
          {prompt.length} / 32000 chars
        </span>
        <button
          type="button"
          onClick={run}
          disabled={busy || !prompt.trim()}
          style={{
            padding: "8px 22px",
            background: busy ? "#0a1a0a" : activeBorderColor,
            color: busy ? "#334433" : "#000",
            border: "none",
            borderRadius: 7,
            fontWeight: 700,
            fontSize: 13,
            cursor: busy || !prompt.trim() ? "not-allowed" : "pointer",
            fontFamily: "monospace",
            letterSpacing: 0.5,
            transition: "background 0.2s",
          }}
        >
          {busy ? "Routing..." : "Запустить →"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "#1a0505",
          border: "1px solid #330000",
          borderRadius: 7,
          padding: "10px 14px",
          color: "#ff6666",
          fontSize: 13,
          fontFamily: "monospace",
        }}>
          Ошибка: {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Metadata badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span style={{
              background: "#00330011",
              border: "1px solid #00ff8844",
              color: "#00ff88",
              padding: "3px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 700,
            }}>
              {result.providerName}
            </span>
            <span style={{
              background: "#00110022",
              border: "1px solid #00ccff44",
              color: "#00ccff",
              padding: "3px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontFamily: "monospace",
            }}>
              {result.model}
            </span>
            <span style={{
              background: "#11002222",
              border: "1px solid #cc88ff44",
              color: "#cc88ff",
              padding: "3px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontFamily: "monospace",
            }}>
              strategy: {result.strategy}
            </span>
            <span style={{
              background: "#111100",
              border: "1px solid #556600",
              color: "#aaaa44",
              padding: "3px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontFamily: "monospace",
            }}>
              {result.latencyMs}ms
            </span>
            <span style={{
              background: "#0a0a0a",
              border: "1px solid #222222",
              color: "#557755",
              padding: "3px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontFamily: "monospace",
            }}>
              ~{result.tokensEstimate} tokens
            </span>
          </div>

          {/* Decision reason */}
          <div style={{
            background: "#020d02",
            border: "1px solid #1a2a1a",
            borderRadius: 6,
            padding: "7px 12px",
            color: "#446644",
            fontSize: 11,
            fontFamily: "monospace",
            fontStyle: "italic",
          }}>
            Decision: {result.decision_reason}
          </div>

          {/* Response text */}
          <div style={{
            background: "#020802",
            border: "1px solid #1a2a1a",
            borderRadius: 8,
            padding: "14px 16px",
            color: "#aaccaa",
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
          }}>
            {result.result}
          </div>
        </div>
      )}
    </div>
  );
}
