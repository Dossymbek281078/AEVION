import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { channelFrom, keepChannel } from "@/lib/products";

// /en/qrenew — английская посадочная QRenew.
//
// Замер EN-свипа 06.09.2026: /qrenew под cookie en — 61 % кириллицы.
// В отличие от сметного тренажёра предмет здесь универсален (маркеры крови
// одинаковы на любом языке), поэтому посадочная продаёт суть, а про язык
// интерфейса говорит честно, без обещания дат перевода.

export const metadata: Metadata = {
  title: "QRenew — biological age from a blood panel",
  description:
    "Computes phenotypic age (PhenoAge) from nine standard blood markers and shows the gap versus your passport age. Interventions ranked by evidence. Wellness and education, not medical advice.",
  alternates: { canonical: "https://aevion.app/en/qrenew" },
  openGraph: {
    title: "QRenew — biological age from a blood panel",
    description:
      "PhenoAge from nine blood markers and an honest, evidence-graded view of what moves it.",
    url: "https://aevion.app/en/qrenew",
    type: "website",
  },
};

export default async function EnQrenewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const channel = channelFrom((await searchParams).c);
  return (
    <main style={styles.page}>
      <PageTracking page="en-qrenew" />
      <div style={styles.wrap}>
        <div style={styles.brand}>AEVION</div>
        <h1 style={styles.h1}>QRenew — biological age from a blood panel</h1>
        <p style={styles.lede}>
          Enter nine standard blood markers — QRenew computes your phenotypic
          age (PhenoAge) and shows the gap versus your passport age, with an
          intervention stack ranked by evidence, not hype.
        </p>
        <p style={styles.note}>
          The interface is currently in Russian; the markers themselves are
          the same in any language, and the site&apos;s language toggle offers
          machine translation for the rest. Educational,
          wellness-focused content — not intended to diagnose, treat or
          prevent any disease.
        </p>
        <div style={styles.row}>
          <a href={keepChannel("/qrenew", channel)} style={styles.cta}>
            Open QRenew
          </a>
          <a href={keepChannel("/pricing", channel)} style={styles.ctaGhost}>
            Plans &amp; pricing
          </a>
        </div>
      </div>
    </main>
  );
}

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const GOLD = "#a9781a";

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "64px 20px" },
  wrap: { maxWidth: 640, margin: "0 auto" },
  brand: { fontSize: 13, letterSpacing: 3, color: GOLD, fontWeight: 700 },
  h1: { fontFamily: "Georgia, serif", fontSize: 36, margin: "10px 0 12px", lineHeight: 1.2 },
  lede: { fontSize: 18, lineHeight: 1.55, color: MUTED },
  note: { fontSize: 15, lineHeight: 1.6, color: MUTED, marginTop: 16 },
  row: { display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" },
  cta: {
    background: INK,
    color: "#fff",
    borderRadius: 8,
    padding: "12px 20px",
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
  ctaGhost: {
    border: `1px solid ${INK}`,
    color: INK,
    borderRadius: 8,
    padding: "12px 20px",
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
};
