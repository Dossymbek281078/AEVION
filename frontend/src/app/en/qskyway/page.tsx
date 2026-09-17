import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { channelFrom, keepChannel } from "@/lib/products";
import ModulePricingChip from "@/components/ModulePricingChip";

// /en/qskyway — английская посадочная QSkyway (6-й случай приёма языковой
// маршрутизации; образцы /longevity, /go, /shop, /smeta-trainer, /qrenew).
//
// Замер EN-свипа 06.09.2026: /qskyway под cookie en — 57 % кириллицы; своей
// en-версии не было, словаря страница не касается (текст в _client). Предмет
// универсален и международен по существу (FAA/MLIT/КЗ-регуляторы, NYC и
// Tokyo в живых твинах) — питч ниже взят из фактического описания страницы,
// новых обещаний нет.

export const metadata: Metadata = {
  title: "QSkyway — navigation layer for the urban sky",
  description:
    "Provider-independent 3D air corridors and rules for air taxis, live on real buildings in Astana, NYC, Tokyo, Singapore, Amsterdam, Berlin and Vienna. Routed against what regulators actually publish; live METAR wind; every flight exportable as a signed justification document.",
  alternates: { canonical: "https://aevion.app/en/qskyway" },
  openGraph: {
    title: "QSkyway — navigation layer for the urban sky",
    description:
      "3D air corridors for air taxis over real city twins, routed against published regulation. Live wind, provenance, signed flight justifications.",
    url: "https://aevion.app/en/qskyway",
    type: "website",
  },
};

export default async function EnQskywayPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const channel = channelFrom((await searchParams).c);
  return (
    <main style={styles.page}>
      <PageTracking page="en-qskyway" />
      <div style={styles.wrap}>
        <div style={styles.brand}>AEVION</div>
        <h1 style={styles.h1}>QSkyway — navigation layer for the urban sky</h1>
        <p style={styles.lede}>
          Provider-independent 3D air corridors for air taxis — live on real
          buildings in Astana, New York, Tokyo, Singapore, Amsterdam, Berlin
          and Vienna, routed against what the regulators actually publish (FAA
          airspace ceilings over Manhattan, Japan&apos;s MLIT permission regime,
          CAAS permits over Singapore, the Schiphol CTR from the Dutch eAIP
          over Amsterdam&apos;s Zuidas, ED-R 146 from the German AIP over
          Berlin&apos;s Potsdamer Platz, the LOWW control zone from Austro
          Control&apos;s own airspace feed over Vienna&apos;s Innere Stadt,
          Kazakhstan&apos;s published prohibited area over the Astana twin).
        </p>
        <p style={styles.note}>
          Live METAR wind, height-data provenance, an airspace-slot rights
          market, and every flight exportable as a signed justification
          document. The interface follows your browser language — English out
          of the box, with a switcher in the header for Russian and Kazakh.
        </p>
        <div style={styles.row}>
          <a href={keepChannel("/qskyway?app=1", channel)} style={styles.cta}>
            Open QSkyway
          </a>
          <a href={keepChannel("/pricing", channel)} style={styles.ctaGhost}>
            Plans &amp; pricing
          </a>
        </div>
        {/*
          14.09.2026: посадочная продавала только ссылкой «Plans & pricing» —
          цены и кнопки покупки QSkyway на ней не было, хотя в приложении они
          есть с того же дня. Тот же чип, язык берёт у посетителя.
        */}
        <div style={{ marginTop: 18 }}>
          <ModulePricingChip moduleId="qskyway" theme="light" />
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
  h1: { fontFamily: "Georgia, serif", fontSize: 34, margin: "10px 0 12px", lineHeight: 1.2 },
  lede: { fontSize: 17, lineHeight: 1.55, color: MUTED },
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
