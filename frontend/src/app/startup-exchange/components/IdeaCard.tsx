"use client";

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

interface Props {
  idea: Idea;
  onInterest: (idea: Idea) => void;
}

export function IdeaCard({ idea, onInterest }: Props) {
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

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
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
