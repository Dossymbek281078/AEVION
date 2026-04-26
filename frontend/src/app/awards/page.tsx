import type { Metadata } from "next";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { getApiBase } from "@/lib/apiBase";
import { launchedModules } from "@/data/pitchModel";

export const metadata: Metadata = {
  title: "AEVION Awards — music and film on the Planet validator layer",
  description:
    "AEVION Awards hub: creative recognition wired to QRight authorship, Planet validator quorum and Bank AEC payouts.",
  openGraph: {
    title: "AEVION Awards",
    description: "AEVION music and film awards on Planet infrastructure with auto AEC payout.",
  },
};

type StatsPayload = {
  eligibleParticipants?: number;
  distinctVotersAllTime?: number;
  certifiedArtifactVersions?: number;
  scopedToProductKeyPrefix?: {
    submissions?: number;
    certifiedArtifactVersions?: number;
  };
};

async function readStats(productKeyPrefix?: string): Promise<StatsPayload | null> {
  try {
    const base = getApiBase();
    const qs = productKeyPrefix ? `?productKeyPrefix=${encodeURIComponent(productKeyPrefix)}` : "";
    const res = await fetch(`${base}/api/planet/stats${qs}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as StatsPayload;
  } catch {
    return null;
  }
}

const PIPELINE: Array<{ step: string; title: string; body: string; color: string }> = [
  {
    step: "01",
    title: "QRight registers authorship",
    body: "SHA-256 hash + HMAC seal + Quantum Shield sharding before the work ever leaves your hands.",
    color: "#7dd3fc",
  },
  {
    step: "02",
    title: "Awards submission",
    body: "Pick the track (Music or Film), attach the registry id, drop the file. One form, one click.",
    color: "#c4b5fd",
  },
  {
    step: "03",
    title: "Planet validators vote",
    body: "Quorum of eligible participants reviews the artifact. Compliance certificate is issued on quorum pass.",
    color: "#5eead4",
  },
  {
    step: "04",
    title: "Bank AEC payout",
    body: "Winners receive AEC straight into their AEVION Bank wallet — no off-platform settlement required.",
    color: "#fde68a",
  },
];

export default async function AwardsHomePage() {
  const [globalStats, musicStats, filmStats] = await Promise.all([
    readStats(),
    readStats("aevion_award_music"),
    readStats("aevion_award_film"),
  ]);
  const y = globalStats?.eligibleParticipants ?? 0;
  const voters = globalStats?.distinctVotersAllTime ?? 0;
  const certifiedAll = globalStats?.certifiedArtifactVersions ?? 0;
  const musicSubmissions = musicStats?.scopedToProductKeyPrefix?.submissions ?? 0;
  const filmSubmissions = filmStats?.scopedToProductKeyPrefix?.submissions ?? 0;
  const musicCertified = musicStats?.scopedToProductKeyPrefix?.certifiedArtifactVersions ?? 0;
  const filmCertified = filmStats?.scopedToProductKeyPrefix?.certifiedArtifactVersions ?? 0;
  const totalSubmissions = musicSubmissions + filmSubmissions;
  const totalCertified = musicCertified + filmCertified;

  const m = launchedModules.find((x) => x.id === "awards");

  const musicSubmitHref =
    "/planet?type=music&preset=music&productKey=aevion_award_music_v1&title=AEVION%20Music%20Awards%20Submission";
  const filmSubmitHref =
    "/planet?type=movie&preset=film&productKey=aevion_award_film_v1&title=AEVION%20Film%20Awards%20Submission";

  const heroStats: Array<{ label: string; value: string | number; hint: string }> = [
    { label: "Submissions", value: totalSubmissions || "—", hint: "Music + Film tracks" },
    { label: "Certified", value: totalCertified || certifiedAll || "—", hint: "Quorum-passed works" },
    { label: "Validators", value: voters || y || "—", hint: "Planet participant network" },
    { label: "Tracks live", value: 2, hint: "AI music · AI film" },
  ];

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          minHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 56px",
          overflow: "hidden",
        }}
      >
        <div className="demo-aurora" aria-hidden />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
          <Wave1Nav variant="dark" />
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.95)",
              marginBottom: 16,
            }}
          >
            AEVION Awards · hub
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 20px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Creative awards
            <br />
            <span style={{ fontSize: "0.55em", fontWeight: 800, letterSpacing: "-0.02em" }}>
              on a real validator network — with AEC payout
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.4vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 760,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            Two tracks live today — Music (the AI-music wave) and Film (the AI-film wave).
            Authorship is registered in QRight, validated by the Planet quorum, and winners receive AEC straight into AEVION Bank.
            One trust pipeline, no opaque jury.
          </p>

          <div
            style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
            }}
          >
            {heroStats.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(94,234,212,0.25)",
                  background: "rgba(15,23,42,0.65)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#5eead4", textTransform: "uppercase" }}>
                  {s.label}
                </div>
                <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                  {s.value}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{s.hint}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/awards/music"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
              }}
            >
              Music Awards →
            </Link>
            <Link
              href="/awards/film"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #b45309, #7f1d1d)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(180,83,9,0.35)",
              }}
            >
              Film Awards →
            </Link>
            <Link
              href="/planet"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              Planet validators
            </Link>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 24px 80px" }}>
        <PitchValueCallout moduleId="awards" variant="dark" />

        <section
          style={{
            marginTop: 24,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.15))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#5eead4", marginBottom: 10, textTransform: "uppercase" }}>
            Why a creative award on a trust layer
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px", color: "#fff", letterSpacing: "-0.02em" }}>
            Authorship, quorum, payout — all on the same pipeline
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#cbd5e1", margin: "0 0 16px" }}>
            {m?.problem ??
              "AI-generated music and film have no home in the traditional awards landscape. Independent creators need recognition pathways tied directly to revenue."}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#cbd5e1", margin: 0 }}>
            Every Awards record is a Trust Graph trifecta: a QRight registration, a Planet validator vote, and a Bank inflow. Winners do not just get a trophy — they get a defensible certificate, a public profile and a balance.
          </p>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: "#94a3b8",
              margin: "0 0 16px",
              textTransform: "uppercase",
            }}
          >
            How it works · 4-step pipeline
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {PIPELINE.map((p) => (
              <article
                key={p.step}
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: `1px solid ${p.color}40`,
                  background: "rgba(15,23,42,0.65)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, color: p.color, letterSpacing: "0.18em" }}>{p.step}</div>
                <h3 style={{ margin: "8px 0 8px", fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: "#94a3b8",
              margin: "0 0 16px",
              textTransform: "uppercase",
            }}
          >
            Two tracks live now
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <section
              style={{
                borderRadius: 18,
                padding: 22,
                border: "1px solid rgba(167,139,250,0.35)",
                background: "linear-gradient(145deg, rgba(76,29,149,0.32), rgba(30,27,75,0.32))",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontWeight: 900, color: "#f8fafc", fontSize: 22 }}>AEVION Music Awards</h3>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Wave 1 · live
                </span>
              </div>
              <p style={{ margin: "8px 0 0", lineHeight: 1.6, fontSize: 14, color: "#ddd6fe" }}>
                The AI-music wave: tracks, samples, generative compositions and digital sound. Like the Grammys — for AI and digital music.
              </p>
              <div style={{ marginTop: 14, fontSize: 13, color: "#ddd6fe" }}>
                Submissions: <strong>{musicSubmissions}</strong> · Certified: <strong>{musicCertified}</strong>
              </div>
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Link
                  href="/awards/music"
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "#fff",
                    color: "#1e1b4b",
                    fontWeight: 800,
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Open music showcase →
                </Link>
                <Link
                  href={musicSubmitHref}
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(196,181,253,0.4)",
                    color: "#ddd6fe",
                    fontWeight: 700,
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Submit to Planet →
                </Link>
              </div>
            </section>

            <section
              style={{
                borderRadius: 18,
                padding: 22,
                border: "1px solid rgba(251,191,36,0.35)",
                background: "linear-gradient(145deg, rgba(180,83,9,0.28), rgba(127,29,29,0.28))",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontWeight: 900, color: "#f8fafc", fontSize: 22 }}>AEVION Film Awards</h3>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fde68a", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Next wave · live
                </span>
              </div>
              <p style={{ margin: "8px 0 0", lineHeight: 1.6, fontSize: 14, color: "#fde68a" }}>
                The AI-film wave: short films, video, animation, generative cinema. Like the Oscars — for AI and digital film.
              </p>
              <div style={{ marginTop: 14, fontSize: 13, color: "#fde68a" }}>
                Submissions: <strong>{filmSubmissions}</strong> · Certified: <strong>{filmCertified}</strong>
              </div>
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Link
                  href="/awards/film"
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "#fff",
                    color: "#7f1d1d",
                    fontWeight: 800,
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Open film showcase →
                </Link>
                <Link
                  href={filmSubmitHref}
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(253,230,138,0.4)",
                    color: "#fde68a",
                    fontWeight: 700,
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Submit to Planet →
                </Link>
              </div>
            </section>
          </div>

          <div
            style={{
              marginTop: 18,
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid rgba(94,234,212,0.25)",
              background: "rgba(15,23,42,0.46)",
              fontSize: 13,
              color: "#cbd5e1",
            }}
          >
            Planet participants with active symbol (quorum <strong>Y</strong>): <strong>{y}</strong>
            {voters ? <> · Distinct voters all-time: <strong>{voters}</strong></> : null}
          </div>
        </section>

        <footer
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            Awards are the marketing engine for the trust pipeline: every winner is a case study + a recurring user across QRight, Bank and Planet.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/pitch"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Investor pitch →
            </Link>
            <Link
              href="/demo"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Live demo →
            </Link>
            <Link
              href="/qright"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 15,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              Register authorship in QRight →
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
