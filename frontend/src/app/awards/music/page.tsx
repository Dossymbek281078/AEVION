"use client";

import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { useI18n } from "@/lib/i18n";
import { AwardPortal } from "../AwardPortal";
import { AwardsTrackPanel } from "../_components/AwardsTrackPanel";

export default function MusicAwardsPage() {
  const { t } = useI18n();

  const heroStats = [
    { label: t("awards.music.stat.wave.label"),    value: t("awards.music.stat.wave.value"),    hint: t("awards.music.stat.wave.hint") },
    { label: t("awards.music.stat.kind.label"),    value: t("awards.music.stat.kind.value"),    hint: t("awards.music.stat.kind.hint") },
    { label: t("awards.music.stat.payout.label"),  value: t("awards.music.stat.payout.value"),  hint: t("awards.music.stat.payout.hint") },
  ];
  const whyBullets = [
    t("awards.music.why.1"),
    t("awards.music.why.2"),
    t("awards.music.why.3"),
    t("awards.music.why.4"),
  ];

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
              color: "rgba(196,181,253,0.95)",
              marginBottom: 16,
            }}
          >
            {t("awards.music.kicker")}
          </p>
          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 48px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 16px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #c4b5fd 50%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("awards.music.h1")}
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
            {t("awards.music.subtitle")}
          </p>

          <div
            style={{
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {heroStats.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(167,139,250,0.3)",
                  background: "rgba(15,23,42,0.65)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#c4b5fd", textTransform: "uppercase" }}>
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
              border: "1px solid rgba(167,139,250,0.3)",
              background: "linear-gradient(165deg, rgba(76,29,149,0.18), rgba(15,23,42,0.7))",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#c4b5fd", marginBottom: 10, textTransform: "uppercase" }}>
              {t("awards.music.why.kicker")}
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#e2e8f0", lineHeight: 1.7, fontSize: 14 }}>
              {whyBullets.map((b) => (
                <li key={b.slice(0, 40)} style={{ marginBottom: 8 }}>
                  {b}
                </li>
              ))}
            </ul>
          </section>

          <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 14 }}>
            <Link href="/awards" style={{ color: "#c4b5fd", fontWeight: 700, textDecoration: "none" }}>
              {t("awards.music.link.hub")}
            </Link>
            <span style={{ color: "rgba(148,163,184,0.5)" }}>·</span>
            <Link href="/awards/film" style={{ color: "#fde68a", fontWeight: 700, textDecoration: "none" }}>
              {t("awards.music.link.film")}
            </Link>
            <span style={{ color: "rgba(148,163,184,0.5)" }}>·</span>
            <Link href="/pitch" style={{ color: "#5eead4", fontWeight: 700, textDecoration: "none" }}>
              {t("awards.music.link.pitch")}
            </Link>
          </div>
        </div>
      </section>

      <AwardsTrackPanel track="music" />

      <AwardPortal variant="music" />
    </div>
  );
}
