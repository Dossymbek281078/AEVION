"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type RecentRow = {
  id: string;
  submissionTitle?: string;
  artifactType?: string;
  versionNo?: number;
};

export function PlanetPulse() {
  const [y, setY] = useState<number | null>(null);
  const [voters, setVoters] = useState<number | null>(null);
  const [certified, setCertified] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(apiUrl("/api/planet/stats")),
          fetch(`${apiUrl("/api/planet/artifacts/recent")}?limit=4`),
        ]);
        const j1 = await r1.json().catch(() => null);
        const j2 = await r2.json().catch(() => null);
        if (cancelled) return;
        if (!r1.ok) {
          setErr(true);
          return;
        }
        setY(j1.eligibleParticipants ?? 0);
        setVoters(j1.distinctVotersAllTime ?? 0);
        setCertified(j1.certifiedArtifactVersions ?? 0);
        if (r2.ok && Array.isArray(j2?.items)) setRecent(j2.items);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <div
        style={{
          marginBottom: 22,
          padding: "12px 14px",
          borderRadius: 14,
          border: "1px solid rgba(180,120,0,0.25)",
          background: "rgba(180,120,0,0.06)",
          fontSize: 13,
          color: "#64748b",
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 800, color: "#92400e" }}>Planet · метрики</span>
        {" — "}
        нет ответа от API (запустите backend / проверьте прокси).{" "}
        <Link href="/planet" style={{ fontWeight: 700, color: "#0f172a" }}>
          Planet →
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 22,
        padding: "16px 18px",
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,0.1)",
        background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(13,148,136,0.07))",
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>
        Planet · доверие и голоса
      </div>
      {y === null ? (
        <div style={{ fontSize: 13, color: "#64748b" }}>Загрузка метрик…</div>
      ) : (
        <div style={{ fontSize: 14, color: "#334155", marginBottom: recent.length ? 12 : 0 }}>
          Участников с символом (<b>Y</b>): <b>{y}</b>
          {" · "}
          Голосовавших: <b>{voters}</b>
          {" · "}
          Сертифицированных версий: <b>{certified}</b>
        </div>
      )}
      {recent.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>
            Недавно в ленте (сертификат есть)
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569" }}>
            {recent.map((row) => (
              <li key={row.id} style={{ marginBottom: 4 }}>
                <Link href={`/planet/artifact/${row.id}`} style={{ fontWeight: 700, color: "#0d9488" }}>
                  {row.submissionTitle || row.id.slice(0, 8)}
                </Link>
                {row.artifactType ? (
                  <span style={{ color: "#94a3b8" }}>
                    {" "}
                    · {row.artifactType}
                    {row.versionNo != null ? ` v${row.versionNo}` : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/planet"
          style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}
        >
          Planet lab →
        </Link>
        <Link href="/awards/music" style={{ fontSize: 13, fontWeight: 700, color: "#6d28d9" }}>
          Премия музыка →
        </Link>
        <Link href="/awards/film" style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
          Премия кино →
        </Link>
      </div>
    </div>
  );
}
