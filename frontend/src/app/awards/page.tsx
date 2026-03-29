import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const metadata: Metadata = {
  title: "AEVION Awards — music and film",
  description:
    "AEVION Awards hub: music and film on the Planet layer, with transparent submission and certification metrics.",
  openGraph: {
    title: "AEVION Awards",
    description: "AEVION music and film awards on Planet infrastructure.",
  },
};

type StatsPayload = {
  eligibleParticipants?: number;
  scopedToProductKeyPrefix?: {
    submissions?: number;
    certifiedArtifactVersions?: number;
  };
};

async function readStats(productKeyPrefix?: string): Promise<StatsPayload | null> {
  try {
    const base = getApiBase();
    const qs = productKeyPrefix
      ? `?productKeyPrefix=${encodeURIComponent(productKeyPrefix)}`
      : "";
    const res = await fetch(`${base}/api/planet/stats${qs}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as StatsPayload;
  } catch {
    return null;
  }
}

export default async function AwardsHomePage() {
  const [globalStats, musicStats, filmStats] = await Promise.all([
    readStats(),
    readStats("aevion_award_music"),
    readStats("aevion_award_film"),
  ]);
  const y = globalStats?.eligibleParticipants ?? 0;
  const musicSubmissions = musicStats?.scopedToProductKeyPrefix?.submissions ?? 0;
  const filmSubmissions = filmStats?.scopedToProductKeyPrefix?.submissions ?? 0;
  const musicCertified = musicStats?.scopedToProductKeyPrefix?.certifiedArtifactVersions ?? 0;
  const filmCertified = filmStats?.scopedToProductKeyPrefix?.certifiedArtifactVersions ?? 0;
  const musicSubmitHref =
    "/planet?type=music&preset=music&productKey=aevion_award_music_v1&title=%D0%97%D0%B0%D1%8F%D0%B2%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D0%BC%D1%83%D0%B7%D1%8B%D0%BA%D0%B0%D0%BB%D1%8C%D0%BD%D1%83%D1%8E%20%D0%BF%D1%80%D0%B5%D0%BC%D0%B8%D1%8E%20AEVION";
  const filmSubmitHref =
    "/planet?type=movie&preset=film&productKey=aevion_award_film_v1&title=%D0%97%D0%B0%D1%8F%D0%B2%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D0%BA%D0%B8%D0%BD%D0%BE%D0%BF%D1%80%D0%B5%D0%BC%D0%B8%D1%8E%20AEVION";

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", padding: 24 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 20,
            padding: "26px 22px",
            background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 52%, #3f1d68 100%)",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "5px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "1px solid rgba(255,255,255,0.2)",
              marginBottom: 10,
            }}
          >
            AEVION Awards Hub
          </div>
          <h1 style={{ margin: "0 0 10px", fontWeight: 900, letterSpacing: "-0.02em" }}>
            AEVION Awards: music and film
          </h1>
          <p style={{ margin: 0, lineHeight: 1.65, opacity: 0.92 }}>
            Two product showcases on Planet layer: work submission, compliance certification
            and transparent connection with participant quorum Y.
          </p>

          <div
            style={{
              marginTop: 16,
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(15,23,42,0.38)",
              fontSize: 14,
            }}
          >
            Planet participants with active symbol (Y): <strong>{y}</strong>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <section
            style={{
              borderRadius: 16,
              padding: 18,
              border: "1px solid rgba(167,139,250,0.35)",
              background: "linear-gradient(145deg, rgba(76,29,149,0.28), rgba(30,27,75,0.28))",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontWeight: 900 }}>AEVION Music Awards</h2>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14, opacity: 0.9 }}>
              Track for music and digital sound.
            </p>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              Submissions: <strong>{musicSubmissions}</strong> · Certified: <strong>{musicCertified}</strong>
            </div>
            <Link href="/awards/music" style={{ marginTop: 14, display: "inline-block", color: "#ddd6fe", fontWeight: 800 }}>
              Open music showcase →
            </Link>
            <div>
              <Link
                href={musicSubmitHref}
                style={{ marginTop: 8, display: "inline-block", color: "#c4b5fd", fontWeight: 700, fontSize: 13 }}
              >
                Submit work to Planet →
              </Link>
            </div>
          </section>

          <section
            style={{
              borderRadius: 16,
              padding: 18,
              border: "1px solid rgba(251,191,36,0.35)",
              background: "linear-gradient(145deg, rgba(180,83,9,0.24), rgba(127,29,29,0.24))",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontWeight: 900 }}>AEVION Film Awards</h2>
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14, opacity: 0.9 }}>
              Track for AI films, video and digital cinema.
            </p>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              Submissions: <strong>{filmSubmissions}</strong> · Certified: <strong>{filmCertified}</strong>
            </div>
            <Link href="/awards/film" style={{ marginTop: 14, display: "inline-block", color: "#fde68a", fontWeight: 800 }}>
              Open film showcase →
            </Link>
            <div>
              <Link
                href={filmSubmitHref}
                style={{ marginTop: 8, display: "inline-block", color: "#fde68a", fontWeight: 700, fontSize: 13 }}
              >
                Submit work to Planet →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
