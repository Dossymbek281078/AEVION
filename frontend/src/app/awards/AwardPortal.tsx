"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";

type RecentArtifact = {
  id: string;
  submissionTitle?: string;
  versionNo?: number;
  artifactType?: string;
  createdAt?: string;
  voteCount?: number;
  voteAverage?: number | null;
};

const btn: CSSProperties = {
  display: "inline-block",
  padding: "14px 22px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 15,
  textDecoration: "none",
  textAlign: "center" as const,
};

type PlanetStats = {
  eligibleParticipants: number;
  distinctVotersAllTime: number;
  certifiedArtifactVersions: number;
  generatedAt?: string;
  awardSubmissions: number;
  awardCertified: number;
};

type LeaderboardSort = "rating" | "votes" | "created";

/* ── Medal + top-3 visuals ───────────────────────────── */
const MEDALS = ["🥇", "🥈", "🥉"] as const;
const TOP_ROW_BG: Record<number, string> = {
  0: "rgba(253,224,71,0.08)",
  1: "rgba(203,213,225,0.07)",
  2: "rgba(180,83,9,0.07)",
};

/* ── Skeleton pulse block ─────────────────────────────── */
function SkeletonBlock({ width, height = 16, style }: { width: string | number; height?: number; style?: CSSProperties }) {
  return (
    <span
      className="aevion-skeleton-pulse"
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: 6,
        background: "rgba(148,163,184,0.18)",
        ...style,
      }}
    />
  );
}

function SkeletonRows({ rows = 5, accent }: { rows?: number; accent: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.25)",
        background: "rgba(15,23,42,0.46)",
        padding: "12px 14px",
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "10px 0",
            borderTop: i > 0 ? "1px solid rgba(148,163,184,0.12)" : undefined,
          }}
        >
          <SkeletonBlock width={24} height={24} style={{ borderRadius: 999, flexShrink: 0 }} />
          <SkeletonBlock width="55%" height={14} />
          <SkeletonBlock width={40} height={14} style={{ marginLeft: "auto" }} />
          <SkeletonBlock width={32} height={14} />
          <SkeletonBlock width={48} height={8} style={{ borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonStatsCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SkeletonBlock width="60%" height={14} />
      <SkeletonBlock width="40%" height={22} />
      <SkeletonBlock width="50%" height={12} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <SkeletonBlock width={140} height={48} style={{ borderRadius: 10 }} />
        <SkeletonBlock width={140} height={48} style={{ borderRadius: 10 }} />
      </div>
    </div>
  );
}

export function AwardPortal({ variant }: { variant: "music" | "film" }) {
  const { t } = useI18n();
  const isMusic = variant === "music";
  const [stats, setStats] = useState<PlanetStats | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentArtifact[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSort>("rating");
  const [recentErr, setRecentErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prefix = isMusic ? "aevion_award_music" : "aevion_award_film";
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(apiUrl("/api/planet/stats")),
          fetch(
            `${apiUrl("/api/planet/stats")}?productKeyPrefix=${encodeURIComponent(prefix)}`,
          ),
        ]);
        const j1 = await r1.json().catch(() => null);
        const j2 = await r2.json().catch(() => null);
        if (!r1.ok) throw new Error(j1?.error || "stats failed");
        if (!r2.ok) throw new Error(j2?.error || "scoped stats failed");
        const scoped = j2.scopedToProductKeyPrefix;
        if (!cancelled) {
          setStats({
            eligibleParticipants: j1.eligibleParticipants ?? 0,
            distinctVotersAllTime: j1.distinctVotersAllTime ?? 0,
            certifiedArtifactVersions: j1.certifiedArtifactVersions ?? 0,
            generatedAt: j1.generatedAt,
            awardSubmissions: scoped?.submissions ?? 0,
            awardCertified: scoped?.certifiedArtifactVersions ?? 0,
          });
          setStatsErr(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setStats(null);
          setStatsErr((e as Error)?.message || "stats");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMusic]);

  useEffect(() => {
    let cancelled = false;
    const prefix = isMusic ? "aevion_award_music" : "aevion_award_film";
    const at = isMusic ? "music" : "movie";
    (async () => {
      setRecentErr(null);
      try {
        const r = await fetch(
          `${apiUrl("/api/planet/artifacts/recent")}?limit=25&sort=${leaderboardSort}&productKeyPrefix=${encodeURIComponent(prefix)}&artifactType=${at}`,
        );
        const j = await r.json().catch(() => null);
        if (!cancelled) {
          if (r.ok && Array.isArray(j?.items)) setRecent(j.items);
          else {
            setRecent([]);
            setRecentErr(j?.error || "recent failed");
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setRecent([]);
          setRecentErr((e as Error)?.message || "recent failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMusic, leaderboardSort]);

  const gradient = isMusic
    ? "linear-gradient(145deg, #1e1b4b 0%, #4c1d95 45%, #7c3aed 100%)"
    : "linear-gradient(145deg, #1c1917 0%, #7f1d1d 48%, #b45309 100%)";
  const accent = isMusic ? "#c4b5fd" : "#fcd34d";
  const planetHref = (() => {
    const params = new URLSearchParams();
    params.set("type", isMusic ? "music" : "movie");
    params.set("preset", isMusic ? "music" : "film");
    params.set("productKey", isMusic ? "aevion_award_music_v1" : "aevion_award_film_v1");
    params.set(
      "title",
      isMusic ? "AEVION Music Awards submission" : "AEVION Film Awards submission"
    );
    return `/planet?${params.toString()}`;
  })();
  const artifactType = isMusic ? "music" : "movie";
  const prefix = isMusic ? "aevion_award_music" : "aevion_award_film";
  const oppositeAwardsHref = isMusic ? "/awards/film" : "/awards/music";

  const title = isMusic ? t("awardsPortal.title.music") : t("awardsPortal.title.film");
  const tag = isMusic ? t("awardsPortal.tag.music") : t("awardsPortal.tag.film");
  const body = isMusic ? t("awardsPortal.body.music") : t("awardsPortal.body.film");

  return (
    <main style={{ padding: 0, minHeight: "100vh", background: "#0f172a" }}>
      <section
        style={{
          background: gradient,
          color: "#fff",
          padding: "40px 24px 48px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Wave1Nav variant="dark" />
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.2)",
              marginBottom: 16,
            }}
          >
            {t("awardsPortal.kicker")}
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 900,
              lineHeight: 1.1,
              margin: "0 0 12px",
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 17, fontWeight: 700, color: accent, margin: "0 0 16px" }}>{tag}</p>
          <p style={{ fontSize: 16, lineHeight: 1.65, opacity: 0.94, margin: 0 }}>{body}</p>

          <div
            style={{
              marginTop: 22,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.22)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {statsErr ? (
              <span style={{ opacity: 0.85 }}>{t("awardsPortal.stats.unavailable", { err: statsErr })}</span>
            ) : stats ? (
              <>
                <div style={{ fontWeight: 800, marginBottom: 8, color: accent }}>{t("awardsPortal.stats.live")}</div>
                <div>
                  {t("awardsPortal.stats.participants.before")} <strong>Y</strong>
                  {t("awardsPortal.stats.participants.after")}{" "}
                  <strong style={{ fontSize: 18 }}>{stats.eligibleParticipants}</strong>
                </div>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  {t("awardsPortal.stats.voters")} <strong>{stats.distinctVotersAllTime}</strong>
                </div>
                <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>
                  {t("awardsPortal.stats.certified")} {stats.certifiedArtifactVersions}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.08)",
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{t("awardsPortal.stats.track.submissions")}</div>
                    <div style={{ marginTop: 2, fontWeight: 900, fontSize: 18 }}>{stats.awardSubmissions}</div>
                  </div>
                  <div
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.08)",
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{t("awardsPortal.stats.track.certified")}</div>
                    <div style={{ marginTop: 2, fontWeight: 900, fontSize: 18 }}>{stats.awardCertified}</div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.18)",
                    fontSize: 13,
                    opacity: 0.92,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6, color: accent }}>
                    {t("awardsPortal.stats.trackTitle")}
                  </div>
                  {t("awardsPortal.stats.submissionsLabel")} <strong>{stats.awardSubmissions}</strong>
                  {" · "}
                  {t("awardsPortal.stats.certifiedLabel")} <strong>{stats.awardCertified}</strong>
                  <div style={{ marginTop: 4, opacity: 0.8, fontSize: 12 }}>
                    {t("awardsPortal.stats.apiFilter")}{" "}
                    <code style={{ color: "#e2e8f0" }}>
                      ?productKeyPrefix={prefix}
                    </code>
                  </div>
                </div>
              </>
            ) : (
              <SkeletonStatsCard />
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link
              href={planetHref}
              style={{
                ...btn,
                background: "#fff",
                color: "#0f172a",
                boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
              }}
            >
              {t("awardsPortal.cta.submit")}
            </Link>
            <Link
              href="/auth"
              style={{
                ...btn,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.35)",
              }}
            >
              {t("awardsPortal.cta.signin")}
            </Link>
            <Link
              href={oppositeAwardsHref}
              style={{
                ...btn,
                background: "transparent",
                color: "#e2e8f0",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {isMusic ? t("awardsPortal.cta.toFilm") : t("awardsPortal.cta.toMusic")}
            </Link>
            <Link
              href="/awards"
              style={{
                ...btn,
                background: "transparent",
                color: "#e2e8f0",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {t("awardsPortal.cta.hub")}
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "28px 24px 14px",
          maxWidth: 720,
          margin: "0 auto",
          color: "#e2e8f0",
          background: "#0f172a",
        }}
      >
        <h2 style={{ color: "#f8fafc", fontSize: 17, fontWeight: 800, margin: "0 0 12px" }}>
          {t("awardsPortal.steps.title")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <article
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.46)",
              padding: "12px 12px 10px",
            }}
          >
            <div style={{ fontSize: 12, color: accent, fontWeight: 800 }}>{t("awardsPortal.steps.s1.kicker")}</div>
            <div style={{ marginTop: 4, fontWeight: 800 }}>{t("awardsPortal.steps.s1.title")}</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.86, lineHeight: 1.55 }}>
              {t("awardsPortal.steps.s1.body")}
            </p>
          </article>
          <article
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.46)",
              padding: "12px 12px 10px",
            }}
          >
            <div style={{ fontSize: 12, color: accent, fontWeight: 800 }}>{t("awardsPortal.steps.s2.kicker")}</div>
            <div style={{ marginTop: 4, fontWeight: 800 }}>{t("awardsPortal.steps.s2.title")}</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.86, lineHeight: 1.55 }}>
              {t("awardsPortal.steps.s2.body.before")} <code>{artifactType}</code>{t("awardsPortal.steps.s2.body.after")}
            </p>
          </article>
          <article
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.46)",
              padding: "12px 12px 10px",
            }}
          >
            <div style={{ fontSize: 12, color: accent, fontWeight: 800 }}>{t("awardsPortal.steps.s3.kicker")}</div>
            <div style={{ marginTop: 4, fontWeight: 800 }}>{t("awardsPortal.steps.s3.title")}</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.86, lineHeight: 1.55 }}>
              {t("awardsPortal.steps.s3.body")}
            </p>
          </article>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          {t("awardsPortal.steps.filter.before")} <code style={{ color: "#e2e8f0" }}>?type={artifactType}</code> {t("awardsPortal.steps.filter.and")}{" "}
          <code style={{ color: "#e2e8f0" }}>?productKeyPrefix={prefix}</code>
        </div>
      </section>

      <section
        style={{
          padding: "28px 24px 36px",
          maxWidth: 720,
          margin: "0 auto",
          color: "#e2e8f0",
          borderTop: "1px solid rgba(148,163,184,0.2)",
          background: "#0f172a",
        }}
      >
        <h2 style={{ color: "#f8fafc", fontSize: 17, fontWeight: 800, margin: "0 0 8px" }}>
          {t("awardsPortal.lb.title")}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.82, lineHeight: 1.55 }}>
          {t("awardsPortal.lb.intro.before")}{" "}
          <code style={{ color: "#cbd5e1" }}>?sort=rating|votes|created</code>{t("awardsPortal.lb.intro.after")}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {(
            [
              { key: "rating" as const, label: t("awardsPortal.lb.sort.rating") },
              { key: "votes" as const, label: t("awardsPortal.lb.sort.votes") },
              { key: "created" as const, label: t("awardsPortal.lb.sort.created") },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setLeaderboardSort(opt.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border:
                  leaderboardSort === opt.key
                    ? `1px solid ${accent}`
                    : "1px solid rgba(148,163,184,0.35)",
                background:
                  leaderboardSort === opt.key ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.5)",
                color: leaderboardSort === opt.key ? "#f8fafc" : "#cbd5e1",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {recentErr ? (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fca5a5" }}>
            {t("awardsPortal.lb.feedErr")} {recentErr}
          </p>
        ) : null}

        {/* Skeleton while loading */}
        {!stats && !statsErr && !recentErr && recent.length === 0 ? (
          <SkeletonRows rows={5} accent={accent} />
        ) : null}

        {stats && !statsErr && !recentErr && recent.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.6 }}>
            {t("awardsPortal.lb.empty")}
          </p>
        ) : null}

        {recent.length > 0 ? (
          <div
            style={{
              overflowX: "auto",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.46)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 11 }}>
                  <th style={{ padding: "10px 12px", fontWeight: 800 }}>#</th>
                  <th style={{ padding: "10px 12px", fontWeight: 800 }}>{t("awardsPortal.lb.col.work")}</th>
                  <th style={{ padding: "10px 12px", fontWeight: 800 }}>{t("awardsPortal.lb.col.avg")}</th>
                  <th style={{ padding: "10px 12px", fontWeight: 800 }}>{t("awardsPortal.lb.col.votes")}</th>
                  <th style={{ padding: "10px 12px", fontWeight: 800, minWidth: 100 }}>{t("awardsPortal.lb.col.coverage")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row, i) => {
                  const y = stats?.eligibleParticipants ?? 0;
                  const vc = Number(row.voteCount ?? 0);
                  const cov =
                    y > 0 ? Math.max(0, Math.min(100, Math.round((vc / y) * 100))) : null;
                  const isTop3 = i < 3;
                  const medal = MEDALS[i] ?? null;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderTop: "1px solid rgba(148,163,184,0.15)",
                        background: TOP_ROW_BG[i] ?? undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          fontWeight: 900,
                          fontSize: medal ? 18 : 14,
                          color: medal ? undefined : accent,
                          textAlign: "center",
                          width: 44,
                        }}
                      >
                        {medal ?? i + 1}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <Link
                          href={`/planet/artifact/${row.id}`}
                          style={{
                            fontWeight: isTop3 ? 900 : 700,
                            color: "#f8fafc",
                            textDecoration: "none",
                          }}
                        >
                          {row.submissionTitle || t("awardsPortal.lb.row.untitled")}
                        </Link>
                        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                          v{row.versionNo ?? "?"} ·{" "}
                          <Link href={`/planet/artifact/${row.id}`} style={{ color: "#94a3b8" }}>
                            {t("awardsPortal.lb.row.card")}
                          </Link>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontWeight: isTop3 ? 900 : 700,
                          color: isTop3 ? accent : undefined,
                        }}
                      >
                        {row.voteAverage != null ? Number(row.voteAverage).toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{vc}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {cov != null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 999,
                                background: "rgba(148,163,184,0.18)",
                                overflow: "hidden",
                                minWidth: 40,
                              }}
                            >
                              <div
                                style={{
                                  width: `${cov}%`,
                                  height: "100%",
                                  borderRadius: 999,
                                  background: isTop3
                                    ? `linear-gradient(90deg, ${accent}, ${isMusic ? "#a78bfa" : "#fbbf24"})`
                                    : "rgba(148,163,184,0.5)",
                                  transition: "width 0.4s ease",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, minWidth: 28 }}>
                              {cov}%
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section style={{ padding: "32px 24px 48px", maxWidth: 720, margin: "0 auto", color: "#cbd5e1" }}>
        <h2 style={{ color: "#f8fafc", fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{t("awardsPortal.ctx.title")}</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
          <li>{t("awardsPortal.ctx.b1")}</li>
          <li>{t("awardsPortal.ctx.b2")}</li>
          <li>{t("awardsPortal.ctx.b3")}</li>
        </ul>
        <p style={{ marginTop: 20, fontSize: 14, opacity: 0.85 }}>
          {t("awardsPortal.ctx.docs")} <code style={{ color: "#94a3b8" }}>AEVION_AWARDS_SPEC.md</code>,{" "}
          <code style={{ color: "#94a3b8" }}>AEVION_PLANET_CONCEPT.md</code>
        </p>
      </section>
    </main>
  );
}
