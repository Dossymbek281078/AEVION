import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { pickLang } from "@/lib/qrightServerI18n";

export const dynamic = "force-dynamic";
export const revalidate = 120;

type Season = {
  id: string;
  code: string;
  type: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
};

type Medal = {
  place: number;
  entryId: string;
  artifactVersionId: string;
  submissionTitle: string;
  artifactType: string;
  voteCount: number;
  voteAverage: number | null;
  score: number | null;
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const COPY = {
  en: {
    title: "AEVION Awards results",
    subtitle:
      "Frozen medal lists from finalized seasons. Winners get a permanent embeddable badge for their site or README.",
    selectSeason: "Select a season:",
    medals: "Medals",
    place1: "🥇 1st place",
    place2: "🥈 2nd place",
    place3: "🥉 3rd place",
    votes: "votes",
    avgScore: "avg",
    score: "score",
    embed: "Embed badge →",
    detail: "Artifact detail →",
    nothing: "No finalized seasons yet.",
    noMedals: "No medals awarded for this season.",
    failedTitle: "Failed to load",
    failedDetail: "The Awards backend is temporarily unreachable.",
  },
  ru: {
    title: "Результаты AEVION Awards",
    subtitle:
      "Зафиксированные медали финализированных сезонов. Победители получают постоянный embeddable бейдж для своего сайта или README.",
    selectSeason: "Выберите сезон:",
    medals: "Медали",
    place1: "🥇 1-е место",
    place2: "🥈 2-е место",
    place3: "🥉 3-е место",
    votes: "голосов",
    avgScore: "средняя",
    score: "счёт",
    embed: "Embed бейдж →",
    detail: "Деталь артефакта →",
    nothing: "Финализированных сезонов пока нет.",
    noMedals: "Медали этого сезона не присуждены.",
    failedTitle: "Не удалось загрузить",
    failedDetail: "Backend Awards временно недоступен.",
  },
} as const;

async function loadSeasons(): Promise<Season[] | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/awards/seasons?status=finalized`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.items || [];
  } catch {
    return null;
  }
}

async function loadResults(
  seasonId: string
): Promise<{ season: Season; medals: Medal[] } | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/awards/seasons/${seasonId}/results`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "AEVION Awards results",
  description: "Frozen medal lists from AEVION Awards finalized seasons.",
  openGraph: {
    type: "article",
    title: "AEVION Awards results",
    description: "Gold/silver/bronze winners across music, film, and more.",
    images: [{ url: `${getApiBase()}/api/awards/og.svg`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Awards results",
    description: "Gold/silver/bronze winners across music, film, and more.",
    images: [`${getApiBase()}/api/awards/og.svg`],
  },
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 22,
  background: "#fff",
  marginBottom: 14,
};

const PLACE_COLORS: Record<number, string> = {
  1: "#eab308",
  2: "#94a3b8",
  3: "#b45309",
};

const PLACE_BG: Record<number, string> = {
  1: "rgba(253,224,71,0.10)",
  2: "rgba(203,213,225,0.10)",
  3: "rgba(180,83,9,0.10)",
};

export default async function AwardsResultsPage({ searchParams }: Props) {
  const sp = (await searchParams) || {};
  const h = await headers();
  const lang = pickLang(sp, h);
  const t = COPY[lang as "en" | "ru"];

  const requestedSeason = typeof sp.season === "string" ? sp.season : "";
  const seasons = await loadSeasons();

  if (!seasons) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800 }}>{t.failedTitle}</div>
            <div style={{ fontSize: 13 }}>{t.failedDetail}</div>
          </div>
        </div>
      </main>
    );
  }

  const seasonId = requestedSeason || seasons[0]?.id || "";
  const results = seasonId ? await loadResults(seasonId) : null;

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/awards"
            style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
          >
            ← AEVION Awards
          </Link>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", margin: 0 }}>
          {t.title}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24, lineHeight: 1.6 }}>
          {t.subtitle}
        </p>

        {seasons.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>{t.nothing}</div>
        ) : (
          <>
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t.selectSeason}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {seasons.map((s) => {
                  const active = s.id === seasonId;
                  return (
                    <Link
                      key={s.id}
                      href={`/awards/results?season=${s.id}`}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(15,23,42,0.15)",
                        background: active ? "#0f172a" : "#fff",
                        color: active ? "#fff" : "#475569",
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      {s.title}{" "}
                      <span style={{ opacity: 0.7, fontFamily: "monospace", fontSize: 10, marginLeft: 4 }}>
                        {s.type.toUpperCase()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {results && (
              <div style={card}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: "0 0 16px" }}>
                  {results.season.title}
                </h2>
                {results.medals.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>{t.noMedals}</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {results.medals.map((m) => (
                      <div
                        key={m.entryId}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          border: `2px solid ${PLACE_COLORS[m.place] || "#94a3b8"}`,
                          background: PLACE_BG[m.place] || "#fff",
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          gap: 14,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 26,
                            fontWeight: 900,
                            color: PLACE_COLORS[m.place] || "#94a3b8",
                            minWidth: 80,
                            textAlign: "center",
                          }}
                        >
                          {m.place === 1 ? t.place1 : m.place === 2 ? t.place2 : t.place3}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                            {m.submissionTitle}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>
                            {m.artifactType?.toUpperCase()} · {m.voteCount} {t.votes}
                            {m.voteAverage !== null ? ` · ${t.avgScore} ${m.voteAverage.toFixed(2)}` : ""}
                            {m.score !== null ? ` · ${t.score} ${m.score.toFixed(2)}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Link
                            href={`/awards/badge/${m.entryId}`}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: `1px solid ${PLACE_COLORS[m.place]}`,
                              color: PLACE_COLORS[m.place],
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              textAlign: "center",
                            }}
                          >
                            {t.embed}
                          </Link>
                          <Link
                            href={`/planet/artifact/${m.artifactVersionId}`}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid rgba(15,23,42,0.15)",
                              color: "#0f172a",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              textAlign: "center",
                            }}
                          >
                            {t.detail}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
