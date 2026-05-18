"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const T = {
  bg: "#0a0e1a",
  surface: "#141826",
  surfaceAlt: "#1a1f33",
  border: "#2a3047",
  accent: "#10b981",
  accentDim: "#059669",
  accentSoft: "rgba(16,185,129,0.12)",
  text: "#e5e7eb",
  textDim: "#9ca3af",
  textMute: "#6b7280",
  danger: "#ef4444",
  warn: "#f59e0b",
};

type LiveGame = {
  gameId: string;
  hostName?: string;
  aiLevel?: number | string;
  rating?: number;
  lastSan?: string;
  histCount?: number;
  viewers?: number;
  startedAt?: number;
  updatedAt?: number;
  result?: string | null;
};

function fmtAge(ts?: number): string {
  if (!ts) return "—";
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "только что";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  return `${hr} ч назад`;
}

export default function SpectatorHubPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/cyberchess-spectator/list", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: LiveGame[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.games)
          ? data.games
          : Array.isArray(data?.items)
            ? data.items
            : [];
      setGames(list);
      setError(null);
      setLastRefresh(Date.now());
    } catch (e: any) {
      setError(e?.message ?? "Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
    const id = setInterval(fetchList, 10_000);
    return () => clearInterval(id);
  }, [fetchList]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/cyberchess"
            style={{
              color: T.textDim,
              textDecoration: "none",
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: "inline-block",
            }}
          >
            ← к шахматам
          </Link>
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: -0.5,
              }}
            >
              📡 Spectator Hub
            </h1>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: T.textDim,
              }}
            >
              Прямые трансляции партий CyberChess · обновление каждые 10 сек
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              color: T.textDim,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.accent,
                boxShadow: `0 0 8px ${T.accent}`,
                display: "inline-block",
              }}
            />
            <span>{games.length} live · обновлено {fmtAge(lastRefresh)}</span>
            <button
              onClick={fetchList}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                color: T.text,
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ↻ обновить
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: "rgba(239,68,68,0.08)",
              border: `1px solid ${T.danger}`,
              color: T.danger,
              marginBottom: 18,
              fontSize: 13,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: T.textDim,
              fontSize: 14,
            }}
          >
            загружаем live-партии…
          </div>
        )}

        {/* Empty */}
        {!loading && !error && games.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              color: T.textDim,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌙</div>
            <div style={{ fontSize: 15, color: T.text, marginBottom: 6 }}>
              Никто не стримит сейчас
            </div>
            <div style={{ fontSize: 13 }}>
              попроси друга включить 📡 в{" "}
              <Link
                href="/cyberchess"
                style={{ color: T.accent, textDecoration: "none" }}
              >
                /cyberchess
              </Link>
            </div>
          </div>
        )}

        {/* Game grid */}
        {!loading && games.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
            {games.map((g) => {
              const id = g.gameId;
              const ai =
                g.aiLevel !== undefined && g.aiLevel !== null
                  ? `AI ${g.aiLevel}`
                  : "AI ?";
              const rating = g.rating ? `${g.rating}` : "—";
              const viewers = g.viewers ?? 0;
              const moves = g.histCount ?? 0;
              const ageRef = g.updatedAt ?? g.startedAt;
              const finished = !!g.result;
              return (
                <Link
                  key={id}
                  href={`/cyberchess/spectator/${id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: 12,
                      padding: 16,
                      transition: "all 0.15s",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.accent;
                      e.currentTarget.style.background = T.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.background = T.surface;
                    }}
                  >
                    {/* live badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        color: finished ? T.textMute : T.danger,
                      }}
                    >
                      {!finished && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: T.danger,
                            boxShadow: `0 0 6px ${T.danger}`,
                            animation: "spectator-pulse 1.4s ease-in-out infinite",
                          }}
                        />
                      )}
                      {finished ? "FINISHED" : "LIVE"}
                    </div>

                    {/* host */}
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 4,
                        paddingRight: 70,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {g.hostName || "Аноним"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: T.textDim,
                        marginBottom: 14,
                      }}
                    >
                      {ai} · рейтинг {rating}
                    </div>

                    {/* meta grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        fontSize: 12,
                        marginBottom: 14,
                      }}
                    >
                      <div
                        style={{
                          padding: 8,
                          background: T.bg,
                          borderRadius: 6,
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        <div style={{ color: T.textMute, fontSize: 10 }}>
                          Последний ход
                        </div>
                        <div
                          style={{
                            color: T.accent,
                            fontWeight: 600,
                            fontFamily: "monospace",
                            marginTop: 2,
                          }}
                        >
                          {g.lastSan || "—"}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: 8,
                          background: T.bg,
                          borderRadius: 6,
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        <div style={{ color: T.textMute, fontSize: 10 }}>
                          Ходов
                        </div>
                        <div
                          style={{
                            color: T.text,
                            fontWeight: 600,
                            marginTop: 2,
                          }}
                        >
                          {moves}
                        </div>
                      </div>
                    </div>

                    {/* footer */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ color: T.textDim }}>
                        👁 {viewers} · {fmtAge(ageRef)}
                      </div>
                      <div
                        style={{
                          padding: "6px 12px",
                          background: T.accentSoft,
                          border: `1px solid ${T.accent}`,
                          borderRadius: 6,
                          color: T.accent,
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        👀 Смотреть
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spectator-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
