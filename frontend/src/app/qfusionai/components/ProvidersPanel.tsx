"use client";

import { useEffect, useState } from "react";

type ProviderInfo = {
  id: string;
  name: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
  status: "available" | "unconfigured";
};

type ProvidersResponse = {
  providers: ProviderInfo[];
  total: number;
  available: number;
};

function StatusDot({ status }: { status: "available" | "unconfigured" }) {
  const color = status === "available" ? "#00ff88" : "#334433";
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: color,
      boxShadow: status === "available" ? `0 0 6px ${color}` : "none",
      marginRight: 6,
      flexShrink: 0,
    }} />
  );
}

export default function ProvidersPanel() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api-backend/api/qfusionai/providers")
      .then((r) => r.json())
      .then((d) => {
        setData(d as ProvidersResponse);
        setError(null);
      })
      .catch((e) => setError(e?.message || "Failed to load providers"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      background: "#030a03",
      border: "1px solid #1a2a1a",
      borderRadius: 12,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#00ff88", fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          PROVIDERS
        </span>
        {data && (
          <span style={{ color: "#446644", fontFamily: "monospace", fontSize: 11 }}>
            {data.available}/{data.total} online
          </span>
        )}
      </div>

      {loading && (
        <div style={{ color: "#334433", fontFamily: "monospace", fontSize: 12, padding: "10px 0" }}>
          Loading providers...
        </div>
      )}

      {error && (
        <div style={{ color: "#ff4444", fontFamily: "monospace", fontSize: 12 }}>
          {error}
        </div>
      )}

      {data && data.providers.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 12px",
            background: p.configured ? "#050f05" : "#050505",
            border: `1px solid ${p.configured ? "#1a3a1a" : "#111111"}`,
            borderRadius: 8,
            opacity: p.configured ? 1 : 0.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <StatusDot status={p.status} />
            <span style={{
              color: p.configured ? "#aaccaa" : "#334433",
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: 600,
              flex: 1,
            }}>
              {p.name}
            </span>
            <span style={{
              color: p.configured ? "#00ff8866" : "#222222",
              fontFamily: "monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}>
              {p.configured ? "ACTIVE" : "OFF"}
            </span>
          </div>
          <div style={{ color: "#334433", fontFamily: "monospace", fontSize: 11, paddingLeft: 14 }}>
            {p.defaultModel}
          </div>
        </div>
      ))}
    </div>
  );
}
