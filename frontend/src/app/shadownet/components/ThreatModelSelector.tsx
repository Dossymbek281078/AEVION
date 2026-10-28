"use client";

import { useEffect, useState } from "react";
import { useShadowT, type Key } from "../i18n";

interface ThreatModel {
  id: string;
  label: string;
  threatLevel: "low" | "medium" | "high" | "extreme";
  description: string;
  protectsFrom: string[];
  recommendations: string[];
}

const LEVEL_COLORS: Record<string, string> = {
  low: "#22d3ee",
  medium: "#a855f7",
  high: "#f59e0b",
  extreme: "#ef4444",
};

export default function ThreatModelSelector() {
  const [models, setModels] = useState<ThreatModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t, threat } = useShadowT();

  useEffect(() => {
    fetch("/api-backend/api/shadownet/threat-models")
      .then((r) => r.json())
      .then((j) => {
        if (j && j.success && Array.isArray(j.data)) {
          setModels(j.data);
          if (j.data.length > 0) setSelectedId(j.data[0].id);
        } else {
          setError("load");
        }
      })
      .catch(() => setError("offline"))
      .finally(() => setLoading(false));
  }, []);

  const selected = models.find((m) => m.id === selectedId);
  // Тексты модели — из словаря по id; сервер отдаёт смесь языков (неизвестный id — как пришёл).
  const текст = selected ? threat(selected.id) ?? selected : undefined;

  if (loading) {
    return (
      <div style={{ color: "#a855f7", fontFamily: "monospace", padding: "12px" }}>
        {t("threat.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "#ef4444", fontFamily: "monospace", padding: "12px" }}>
        {t("threat.loadFail")}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {models.map((m) => {
          const isActive = m.id === selectedId;
          const color = LEVEL_COLORS[m.threatLevel] ?? "#a855f7";
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              style={{
                background: isActive ? "rgba(168,85,247,0.15)" : "rgba(0,0,0,0.4)",
                border: `1px solid ${isActive ? color : "rgba(168,85,247,0.3)"}`,
                borderRadius: "8px",
                padding: "12px",
                cursor: "pointer",
                textAlign: "left",
                color: "#e9d5ff",
                fontFamily: "monospace",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "11px", color, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {t(`threat.level.${m.threatLevel}` as Key)}
              </div>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>{threat(m.id)?.label ?? m.label}</div>
            </button>
          );
        })}
      </div>

      {selected && текст && (
        <div
          style={{
            background: "rgba(0,0,0,0.6)",
            border: `1px solid ${LEVEL_COLORS[selected.threatLevel] ?? "#a855f7"}`,
            borderRadius: "10px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: LEVEL_COLORS[selected.threatLevel],
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            {t("threat.levelLabel", { level: t(`threat.level.${selected.threatLevel}` as Key) })}
          </div>
          <h3 style={{ color: "#e9d5ff", margin: "0 0 10px 0", fontSize: "20px" }}>
            {текст.label}
          </h3>
          <p style={{ color: "#c4b5fd", fontSize: "14px", lineHeight: 1.6, margin: "0 0 16px 0" }}>
            {текст.description}
          </p>

          <div data-stack-mobile="" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#22d3ee",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}
              >
                {t("threat.protectsFrom")}
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", color: "#a5f3fc", fontSize: "13px", lineHeight: 1.7 }}>
                {текст.protectsFrom.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#a855f7",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}
              >
                {t("threat.recommendations")}
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", color: "#e9d5ff", fontSize: "13px", lineHeight: 1.7 }}>
                {текст.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
