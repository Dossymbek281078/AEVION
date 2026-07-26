"use client";

import { useEffect, useState } from "react";
import { AssessmentPanel } from "./AssessmentPanel";
import { TIER_ACCENT, dealHeadline, startupxApi, usd, type Assessment, type ListingDraft } from "../lib";

/**
 * What a listing looks like, shown when the feed is empty.
 *
 * An empty marketplace is a dead end: "пока пусто" tells a visitor nothing
 * about what they would get here. This renders one worked example instead.
 *
 * The numbers are not written by hand — the draft below is sent to the same
 * free-analysis endpoint every real listing goes through, so what a visitor
 * reads is genuinely what the engine produces. Nothing is stored, and the card
 * says plainly that this is an example rather than someone's actual company.
 */

const EXAMPLE: ListingDraft = {
  title: "Обратный груз для мелких перевозчиков",
  tier: "idea",
  sector: "logistics",
  geography: "KZ",
  description:
    "Проблема: перевозчики с парком 1–5 машин ищут обратный груз вручную, через чаты в WhatsApp, " +
    "и теряют до трети рейсов на пустом пробеге. Для кого: небольшие транспортные компании и " +
    "водители-собственники. Мы делаем платформу, которая автоматически подбирает груз по маршруту " +
    "освободившейся машины и показывает его до того, как машина выехала пустой. Зарабатываем на " +
    "комиссии 5% с каждого закрытого рейса. В отличие от досок объявлений, подбор идёт по факту " +
    "освободившейся машины, а не по заявке, которую водитель должен не забыть оставить.",
  deal: { intent: "raise", askUsd: 30_000, equityOfferedPct: 15, buildBy: "founder" },
};

export function ExampleListing() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startupxApi
      .assess(EXAMPLE)
      .then((r) => {
        if (!cancelled) setAssessment(r.assessment);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the analysis cannot be produced, showing the card without it would
  // advertise a number we did not compute. Better to show nothing.
  if (failed) return null;

  const accent = TIER_ACCENT[EXAMPLE.tier];

  return (
    <section style={{ marginTop: 8 }}>
      <div
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 20,
          background: "#f1f5f9",
          color: "#475569",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Пример · не настоящая заявка
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.6, maxWidth: 640 }}>
        Так выглядит заявка на бирже. Разбор ниже посчитан прямо сейчас тем же движком, что работает
        с настоящими заявками, — это не картинка и не заранее написанные цифры.
      </p>

      <article style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, marginBottom: 12 }}>
        <span style={{ padding: "2px 9px", borderRadius: 20, background: `${accent}14`, color: accent, fontSize: 11, fontWeight: 800 }}>
          Только идея
        </span>
        <h3 style={{ margin: "8px 0 4px", fontSize: 17, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
          {EXAMPLE.title}
        </h3>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: accent, marginBottom: 8 }}>
          {dealHeadline(EXAMPLE.deal)}
          {assessment?.deal.implied.postMoneyUsd && (
            <span style={{ fontWeight: 500, color: "#64748b", fontSize: 12 }}>
              {" "}· оценка {usd(assessment.deal.implied.postMoneyUsd)}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{EXAMPLE.description}</p>
      </article>

      {assessment ? (
        <AssessmentPanel a={assessment} />
      ) : (
        <p style={{ color: "#64748b", fontSize: 13 }}>Считаю разбор примера…</p>
      )}
    </section>
  );
}
