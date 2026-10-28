"use client";

import { useEffect, useState } from "react";
import { useShadowT, type Key } from "../i18n";

interface ScoreResult {
  score: number;
  active: string[];
  inactive: string[];
  weakest: string | null;
  advice: string;
}

interface Features {
  tor: boolean;
  vpn: boolean;
  dns: boolean;
  browser: boolean;
  e2e: boolean;
}

// Подписи и советы — из словаря по ключу; сервер отдаёт weakest ключом («tor»), прежде он стоял на экране сырым.
const FEATURE_LIST: (keyof Features)[] = ["tor", "vpn", "dns", "browser", "e2e"];

function scoreColor(score: number): string {
  if (score >= 80) return "#22d3ee";
  if (score >= 50) return "#a855f7";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

export default function PrivacyScore() {
  const [features, setFeatures] = useState<Features>({
    tor: false,
    vpn: false,
    dns: false,
    browser: false,
    e2e: false,
  });
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { t } = useShadowT();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch("/api-backend/api/shadownet/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`score request failed (${r.status})`);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (j && j.success) {
          setResult(j.data);
        } else {
          throw new Error(j?.error || "score request failed");
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [features]);

  return (
    <div data-stack-mobile=""
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(168,85,247,0.4)",
          borderRadius: "10px",
          padding: "20px",
        }}
      >
        <h3
          style={{
            color: "#e9d5ff",
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            margin: "0 0 16px 0",
            fontFamily: "monospace",
          }}
        >
          {t("score.active")}
        </h3>
        {FEATURE_LIST.map((k) => ({ key: k, label: t(`feat.${k}` as Key), hint: t(`feat.${k}Hint` as Key) })).map((f) => (
          <label
            key={f.key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "10px 0",
              borderBottom: "1px solid rgba(168,85,247,0.15)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={features[f.key]}
              onChange={(e) =>
                setFeatures((prev) => ({ ...prev, [f.key]: e.target.checked }))
              }
              style={{
                accentColor: "#a855f7",
                width: "18px",
                height: "18px",
                marginTop: "2px",
                cursor: "pointer",
              }}
            />
            <div>
              <div style={{ color: "#e9d5ff", fontSize: "14px", fontWeight: 600 }}>
                {f.label}
              </div>
              <div style={{ color: "#a78bfa", fontSize: "11px", fontFamily: "monospace" }}>
                {f.hint}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div
        style={{
          background: "rgba(0,0,0,0.6)",
          border: `1px solid ${result ? scoreColor(result.score) : "rgba(168,85,247,0.4)"}`,
          borderRadius: "10px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#a855f7",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            marginBottom: "12px",
            fontFamily: "monospace",
          }}
        >
          {t("score.title")}
        </div>
        <div
          style={{
            fontSize: "92px",
            fontWeight: 700,
            color: result ? scoreColor(result.score) : "#6b21a8",
            lineHeight: 1,
            fontFamily: "monospace",
            textShadow: result ? `0 0 40px ${scoreColor(result.score)}66` : "none",
            transition: "all 0.3s",
          }}
        >
          {result ? result.score : "--"}
        </div>
        <div style={{ fontSize: "12px", color: "#a78bfa", marginTop: "4px", fontFamily: "monospace" }}>
          / 100
        </div>
        {result && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "rgba(168,85,247,0.08)",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#e9d5ff",
              maxWidth: "320px",
              lineHeight: 1.5,
            }}
          >
            {result.weakest && (
              <div
                style={{
                  fontSize: "10px",
                  color: "#f59e0b",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: "6px",
                  fontFamily: "monospace",
                }}
              >
                {t("score.weakest", { x: FEATURE_LIST.includes(result.weakest as keyof Features) ? t(`feat.${result.weakest}` as Key) : result.weakest })}
              </div>
            )}
            {result.weakest && !FEATURE_LIST.includes(result.weakest as keyof Features) ? result.advice : t(result.weakest ? (`advice.${result.weakest}` as Key) : "advice.all")}
          </div>
        )}
        {loading && !result && (
          <div style={{ marginTop: "12px", fontSize: "11px", color: "#a78bfa" }}>
            {t("score.computing")}
          </div>
        )}
        {error && !loading && (
          <div style={{ marginTop: "12px", fontSize: "11px", color: "#ef4444", fontFamily: "monospace" }}>
            {t("score.unavailable")}
          </div>
        )}
      </div>
    </div>
  );
}
