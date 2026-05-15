"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";

const PROGRESS_KEY = "aevion_bank_onboarding_v1";

type StepId = "auth" | "topup" | "send" | "save" | "trust";

type Step = {
  id: StepId;
  href: string;
  accent: string;
  glyph: string;
};

const STEPS: Step[] = [
  { id: "auth", href: "/auth", accent: "#5eead4", glyph: "1" },
  { id: "topup", href: "/bank", accent: "#0ea5e9", glyph: "2" },
  { id: "send", href: "/bank/contacts", accent: "#a78bfa", glyph: "3" },
  { id: "save", href: "/bank/savings", accent: "#fbbf24", glyph: "4" },
  { id: "trust", href: "/bank/trust", accent: "#d97706", glyph: "5" },
];

function loadProgress(): Set<StepId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is StepId => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveProgress(s: Set<StepId>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(s)));
  } catch {
    // ignore quota
  }
}

export default function OnboardingPage() {
  const { t } = useI18n();
  const [done, setDone] = useState<Set<StepId>>(new Set());

  useEffect(() => {
    setDone(loadProgress());
  }, []);

  const toggle = (id: StepId) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveProgress(next);
      return next;
    });
  };

  const reset = () => {
    setDone(new Set());
    saveProgress(new Set());
  };

  const completedCount = done.size;
  const total = STEPS.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const allDone = completedCount === total;

  // HowTo schema.org JSON-LD — surfaces the onboarding as a step-by-step
  // recipe to Google. Each step name/text uses the same i18n keys as the UI
  // so structured data follows the active language.
  const howToJsonLd = useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: t("onboarding.headline"),
      description: t("onboarding.lede"),
      totalTime: "PT1M",
      step: STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: t(`onboarding.${s.id}.title`),
        text: t(`onboarding.${s.id}.body`),
        url: s.href,
      })),
    };
  }, [t]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.20), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("onboarding.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("onboarding.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 600 }}>
            {t("onboarding.lede")}
          </div>
        </header>

        {/* Progress bar */}
        <section
          style={{
            padding: 20,
            borderRadius: 16,
            background:
              allDone
                ? "linear-gradient(135deg, rgba(217,119,6,0.20), rgba(251,191,36,0.10))"
                : "rgba(15,23,42,0.55)",
            border: `1px solid ${allDone ? "rgba(251,191,36,0.40)" : "rgba(94,234,212,0.18)"}`,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: allDone ? "#fbbf24" : "#5eead4" }}>
                {allDone ? t("onboarding.complete.kicker") : t("onboarding.progress.kicker")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
                {allDone
                  ? t("onboarding.complete.title")
                  : t("onboarding.progress.title", { done: completedCount, total })}
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: allDone ? "#fbbf24" : "#5eead4" }}>
              {pct}%
            </div>
          </div>
          <div
            style={{
              position: "relative" as const,
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={t("onboarding.progress.aria")}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${pct}%`,
                background: allDone
                  ? "linear-gradient(90deg, #fbbf24, #d97706)"
                  : "linear-gradient(90deg, #5eead4, #0d9488)",
                borderRadius: 999,
                transition: "width 600ms ease-out",
              }}
            />
          </div>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 12,
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {t("onboarding.reset")}
            </button>
          )}
        </section>

        {/* Steps */}
        <ol style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((s) => {
            const isDone = done.has(s.id);
            return (
              <li
                key={s.id}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: isDone
                    ? "rgba(13,148,136,0.10)"
                    : "rgba(15,23,42,0.55)",
                  border: `1px solid ${isDone ? "rgba(13,148,136,0.32)" : `${s.accent}1a`}`,
                  opacity: isDone ? 0.85 : 1,
                  transition: "background 250ms ease, border-color 250ms ease, opacity 250ms ease",
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div
                    aria-hidden
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: isDone
                        ? "linear-gradient(135deg, #0d9488, #5eead4)"
                        : `${s.accent}26`,
                      color: isDone ? "#fff" : s.accent,
                      fontSize: 18,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${isDone ? "rgba(13,148,136,0.50)" : `${s.accent}40`}`,
                    }}
                  >
                    {isDone ? "✓" : s.glyph}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        color: isDone ? "#5eead4" : s.accent,
                      }}
                    >
                      {t("onboarding.step", { n: STEPS.indexOf(s) + 1 })}
                      {isDone && (
                        <span style={{ marginLeft: 8, color: "#5eead4" }}>
                          · {t("onboarding.doneTag")}
                        </span>
                      )}
                    </div>
                    <h2
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        margin: "4px 0 6px 0",
                        lineHeight: 1.2,
                        color: "#fff",
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {t(`onboarding.${s.id}.title`)}
                    </h2>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {t(`onboarding.${s.id}.body`)}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <Link
                        href={s.href}
                        style={{
                          padding: "9px 16px",
                          borderRadius: 10,
                          background: isDone
                            ? "rgba(255,255,255,0.06)"
                            : `linear-gradient(135deg, ${s.accent}, ${s.accent}cc)`,
                          color: isDone ? "#cbd5e1" : "#0f172a",
                          fontSize: 12,
                          fontWeight: 800,
                          textDecoration: "none",
                          letterSpacing: 0.5,
                        }}
                      >
                        {t(`onboarding.${s.id}.cta`)} →
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggle(s.id)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 10,
                          border: `1px solid ${isDone ? "rgba(13,148,136,0.40)" : "rgba(255,255,255,0.18)"}`,
                          background: isDone ? "rgba(13,148,136,0.12)" : "transparent",
                          color: isDone ? "#5eead4" : "#cbd5e1",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {isDone ? t("onboarding.markUndone") : t("onboarding.markDone")}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {allDone && (
          <section
            style={{
              padding: 22,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(217,119,6,0.20), rgba(251,191,36,0.10))",
              border: "1px solid rgba(251,191,36,0.40)",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#fbbf24", textTransform: "uppercase" }}>
              ★ {t("onboarding.allDone.kicker")}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
              {t("onboarding.allDone.title")}
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, lineHeight: 1.55 }}>
              {t("onboarding.allDone.body")}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <Link href="/bank/explore" style={ctaPrimary}>
                {t("about.cta.exploreSurfaces")}
              </Link>
              <Link href="/bank/glossary" style={ctaSecondary}>
                {t("explore.card.glossary.title")} →
              </Link>
            </div>
          </section>
        )}

        <div style={{ marginTop: 16 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #d97706, #fbbf24)",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};

const ctaSecondary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
