import type { Metadata } from "next";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { AwardPortal } from "../AwardPortal";

export const metadata: Metadata = {
  title: "AEVION Film Awards — premium for AI and digital cinema",
  description:
    "AEVION Film Awards: submit through Planet (artifact type movie), get a compliance certificate and AEC payout into AEVION Bank.",
  openGraph: {
    title: "AEVION Film Awards",
    description: "Premium for AI and digital film on the Planet validator layer.",
  },
};

const HERO_STATS = [
  { label: "Wave", value: "AI film · 2nd", hint: "Following the AI-music wave" },
  { label: "Submission type", value: "movie", hint: "Short films · video · animation" },
  { label: "Payout rail", value: "AEC → Bank", hint: "Winners settle straight to wallet" },
];

const WHY_BULLETS = [
  "AI-generated film has no Cannes, no Oscar, no festival circuit. AEVION ships the first credible certification track.",
  "Authorship locked at submission time: QRight registry id binds creator, hash and geolocation to the file.",
  "Validator quorum on Planet is transparent — votes and coverage of quorum Y are published per artifact.",
  "Winnings settle in AEC into AEVION Bank, where the rest of the creator economy already lives.",
];

export default function FilmAwardsPage() {
  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          padding: "44px 24px 36px",
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
              color: "rgba(253,230,138,0.95)",
              marginBottom: 16,
            }}
          >
            AEVION Film Awards · next wave
          </p>
          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 48px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 16px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #fde68a 50%, #fbbf24 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            The Oscars — for AI and digital cinema
          </h1>
          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              lineHeight: 1.55,
              maxWidth: 720,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            One submission flow, one validator quorum, one AEC payout. Authorship registered in QRight, voted by the Planet network, paid into AEVION Bank.
          </p>

          <div
            style={{
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {HERO_STATS.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(251,191,36,0.3)",
                  background: "rgba(15,23,42,0.65)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#fde68a", textTransform: "uppercase" }}>
                  {s.label}
                </div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: "#f8fafc" }}>{s.value}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{s.hint}</div>
              </div>
            ))}
          </div>

          <section
            style={{
              marginTop: 26,
              padding: 22,
              borderRadius: 16,
              border: "1px solid rgba(251,191,36,0.3)",
              background: "linear-gradient(165deg, rgba(180,83,9,0.18), rgba(15,23,42,0.7))",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#fde68a", marginBottom: 10, textTransform: "uppercase" }}>
              Why this track matters
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#e2e8f0", lineHeight: 1.7, fontSize: 14 }}>
              {WHY_BULLETS.map((b) => (
                <li key={b.slice(0, 40)} style={{ marginBottom: 8 }}>
                  {b}
                </li>
              ))}
            </ul>
          </section>

          <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 14 }}>
            <Link href="/awards" style={{ color: "#fde68a", fontWeight: 700, textDecoration: "none" }}>
              ← Awards hub
            </Link>
            <span style={{ color: "rgba(148,163,184,0.5)" }}>·</span>
            <Link href="/awards/music" style={{ color: "#c4b5fd", fontWeight: 700, textDecoration: "none" }}>
              Music Awards →
            </Link>
            <span style={{ color: "rgba(148,163,184,0.5)" }}>·</span>
            <Link href="/pitch" style={{ color: "#5eead4", fontWeight: 700, textDecoration: "none" }}>
              Investor pitch
            </Link>
          </div>
        </div>
      </section>

      <AwardPortal variant="film" />
    </div>
  );
}
