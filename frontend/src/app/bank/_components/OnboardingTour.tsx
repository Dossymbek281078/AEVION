"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  hasSeenTour,
  markTourSeen,
  scrollToAnchor,
  TOUR_STEPS,
  type TourStep,
} from "../_lib/onboarding";

type Props = {
  forceOpen: boolean;
  autoFirstVisit: boolean;
};

export function OnboardingTour({ forceOpen, autoFirstVisit }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean>(false);
  const [stepIdx, setStepIdx] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceOpen) {
      setOpen(true);
      setStepIdx(0);
      return;
    }
    if (autoFirstVisit && !hasSeenTour()) {
      setOpen(true);
      setStepIdx(0);
    }
  }, [forceOpen, autoFirstVisit]);

  const close = (seen: boolean) => {
    setOpen(false);
    if (seen) markTourSeen();
  };

  if (!open) return null;

  const step: TourStep = TOUR_STEPS[stepIdx] ?? TOUR_STEPS[0];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === TOUR_STEPS.length - 1;
  const stepLabel = t(`tour.step.${step.id}.label`) || step.label;
  const stepHeadline = t(`tour.step.${step.id}.headline`) || step.headline;
  const stepBody = t(`tour.step.${step.id}.body`) || step.body;
  const stepTipKey = `tour.step.${step.id}.tip`;
  const stepTipTranslated = t(stepTipKey);
  const stepTip =
    stepTipTranslated && stepTipTranslated !== stepTipKey ? stepTipTranslated : step.tip;

  const showAndAdvance = () => {
    scrollToAnchor(step.anchorId);
    if (isLast) {
      window.setTimeout(() => close(true), 400);
    } else {
      window.setTimeout(() => setStepIdx((i) => i + 1), 400);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-headline"
      style={{
        position: "fixed" as const,
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 20,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(3px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(true);
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(15,23,42,0.25)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#0369a1",
            }}
          >
            {t("tour.label")} · {stepIdx + 1} / {TOUR_STEPS.length} · {stepLabel}
          </div>
          <button
            onClick={() => close(true)}
            aria-label={t("tour.btn.skip.aria")}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 16,
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <h2
          id="tour-headline"
          style={{
            fontSize: 20,
            fontWeight: 900,
            margin: 0,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          {stepHeadline}
        </h2>
        <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0 }}>{stepBody}</p>
        {stepTip ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(14,165,233,0.08)",
              border: "1px solid rgba(14,165,233,0.22)",
              fontSize: 12,
              color: "#0369a1",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ letterSpacing: "0.04em" }}>{t("tour.tip")} · </strong>
            {stepTip}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 4, marginTop: 4 }} aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background: i <= stepIdx ? "#0ea5e9" : "rgba(15,23,42,0.08)",
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            onClick={() => close(true)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "#fff",
              color: "#334155",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("tour.btn.skip")}
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: isFirst ? "#94a3b8" : "#334155",
                fontSize: 12,
                fontWeight: 700,
                cursor: isFirst ? "default" : "pointer",
              }}
            >
              {t("tour.btn.back")}
            </button>
            <button
              onClick={showAndAdvance}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(14,165,233,0.3)",
              }}
            >
              {isLast ? t("tour.btn.finish") : t("tour.btn.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
