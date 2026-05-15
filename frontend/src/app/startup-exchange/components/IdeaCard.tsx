"use client";

import { useState } from "react";

export interface AiScore {
  problem: number;
  market: number;
  uniqueness: number;
  stage: number;
  potential: number;
  summary: string;
}

export interface Idea {
  id: number;
  title: string;
  description: string;
  stage: "idea" | "prototype" | "mvp" | "scaling";
  contact_method: string | null;
  qright_object_id: string | null;
  content_hash: string | null;
  qright_protected: boolean;
  visibility: string;
  created_at: string;
  interest_count?: number;
  ai_score?: AiScore | null;
  ai_scored_at?: string | null;
}

const STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  idea:      { bg: "#f5f3ff", fg: "#7c3aed" },
  prototype: { bg: "#eff6ff", fg: "#2563eb" },
  mvp:       { bg: "#ecfdf5", fg: "#059669" },
  scaling:   { bg: "#fff7ed", fg: "#c2410c" },
};

function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {stage}
    </span>
  );
}

function QRightBadge({ hash }: { hash: string | null }) {
  if (!hash) return null;
  const short = hash.slice(0, 12);
  return (
    <span
      title={`QRight-IP-mark · contentHash sha256:${hash}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#f0fdf4",
        color: "#15803d",
        border: "1px solid #bbf7d0",
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      QRight · sha256:{short}…
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} дн назад`;
}

function scoreColor(value: number): string {
  if (value >= 7) return "#16a34a"; // green
  if (value >= 4) return "#ca8a04"; // yellow
  return "#dc2626"; // red
}

const SCORE_LABELS: Record<keyof Omit<AiScore, "summary">, string> = {
  problem: "Проблема",
  market: "Рынок",
  uniqueness: "Уникальность",
  stage: "Стадия",
  potential: "Потенциал",
};

function AiScorePanel({ score }: { score: AiScore }) {
  const criteria = (Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>);
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#7c3aed",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 10,
        }}
      >
        AI Pitch Score
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {criteria.map((key) => {
          const val = score[key];
          const pct = (val / 10) * 100;
          const color = scoreColor(val);
          return (
            <div key={key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#475569",
                  marginBottom: 3,
                }}
              >
                <span>{SCORE_LABELS[key]}</span>
                <span style={{ fontWeight: 700, color }}>{val}/10</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#e2e8f0",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 3,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {score.summary && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            color: "#64748b",
            fontStyle: "italic",
            lineHeight: 1.55,
          }}
        >
          {score.summary}
        </p>
      )}
    </div>
  );
}

interface Props {
  idea: Idea;
  onInterest: (idea: Idea) => void;
}

export function IdeaCard({ idea, onInterest }: Props) {
  const [aiScore, setAiScore] = useState<AiScore | null>(idea.ai_score ?? null);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  async function handleAiScore() {
    setScoring(true);
    setScoreError(null);
    try {
      const res = await fetch(`/api/startupx/ideas/${idea.id}/ai-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { id: number; aiScore: AiScore | null; error?: string; scoredAt?: string };
        error?: string;
      };
      if (!json.success) {
        setScoreError(json.error ?? "Ошибка запроса");
        return;
      }
      if (json.data?.aiScore) {
        setAiScore(json.data.aiScore);
      } else {
        setScoreError("AI временно недоступен");
      }
    } catch {
      setScoreError("Ошибка сети");
    } finally {
      setScoring(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <StageBadge stage={idea.stage} />
        {idea.qright_protected && idea.content_hash && <QRightBadge hash={idea.content_hash} />}
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{relativeTime(idea.created_at)}</span>
        {typeof idea.interest_count === "number" && (
          <span
            style={{
              fontSize: 11,
              color: "#475569",
              background: "#f1f5f9",
              borderRadius: 20,
              padding: "2px 8px",
              fontWeight: 600,
            }}
          >
            ★ {idea.interest_count} интересов
          </span>
        )}
      </div>

      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
        {idea.title}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "#475569",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {idea.description.length > 320
          ? `${idea.description.slice(0, 320)}…`
          : idea.description}
      </p>

      {aiScore ? (
        <AiScorePanel score={aiScore} />
      ) : (
        <div style={{ marginTop: 10 }}>
          {scoreError && (
            <span style={{ fontSize: 12, color: "#dc2626", marginRight: 8 }}>{scoreError}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onInterest(idea)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#7c3aed",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Заинтересован
        </button>

        {!aiScore && (
          <button
            type="button"
            onClick={handleAiScore}
            disabled={scoring}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #7c3aed",
              background: scoring ? "#ede9fe" : "#faf5ff",
              color: "#7c3aed",
              fontWeight: 600,
              fontSize: 13,
              cursor: scoring ? "not-allowed" : "pointer",
              opacity: scoring ? 0.7 : 1,
            }}
          >
            {scoring ? "Анализ…" : "AI Score"}
          </button>
        )}

        {idea.contact_method && (
          <span
            style={{
              fontSize: 12,
              color: "#64748b",
              alignSelf: "center",
            }}
          >
            Контакт: {idea.contact_method}
          </span>
        )}
      </div>
    </div>
  );
}
