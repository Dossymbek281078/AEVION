import type { Metadata } from "next";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

export const metadata: Metadata = {
  title: "AEVION Press Kit — brand, boilerplate, contact",
  description:
    "Press kit for AEVION: brand assets, one-liner, boilerplate, key stats and direct contact. For journalists, analysts and partners covering trust infrastructure for AI and creator economy.",
  alternates: { canonical: "/press" },
  openGraph: {
    title: "AEVION Press Kit",
    description: "Brand, boilerplate, contact — everything a journalist needs in one page.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Press Kit",
    description: "Brand assets, boilerplate, key stats, contact.",
  },
};

const KEY_STATS = [
  { value: "27",     label: "product nodes",        hint: "12 live MVPs, 15 emerging" },
  { value: "$340B",  label: "addressable market",   hint: "IP, creator economy, payments" },
  { value: "3",      label: "languages",            hint: "EN · RU · KK from day 1" },
  { value: "Ed25519",label: "signature stack",      hint: "+ Shamir SSS · post-quantum-ready" },
];

const ONE_LINERS = [
  "AEVION is the trust operating system for digital creation: registry, signature, bureau, validators, bank — under one identity.",
  "AEVION turns authorship into payable rights — register IP in seconds, settle royalties in AEC, all on one Trust Graph.",
  "AEVION is what you get when you bundle USPTO, Stripe, DocuSign and a creator wallet into a single quantum-resistant pipeline.",
];

const BRAND_COLORS = [
  { hex: "#0d9488", name: "Teal · primary"       },
  { hex: "#7dd3fc", name: "Sky · QRight"         },
  { hex: "#a78bfa", name: "Violet · Awards/Demo" },
  { hex: "#fbbf24", name: "Amber · Bank/AEC"     },
  { hex: "#5eead4", name: "Mint · Quantum Shield" },
  { hex: "#f472b6", name: "Pink · Bureau/Film"   },
];

const COVERAGE_NOTE =
  "Coverage and analyst commentary will be linked here as it lands. For first-party briefings (architecture deep-dive, demo, founder interview) email yahiin1978@gmail.com with subject \"AEVION press\".";

const BOILERPLATE = `AEVION is a trust infrastructure platform for digital creation. It bundles IP registration (QRight), cryptographic signatures (QSign), a patent bureau, validator-quorum compliance certification (Planet), creator awards, and a digital bank (AEC) under a single identity and a single Trust Graph. Authorship is provable from the first second; payouts settle straight to a wallet that already understands royalties, autopilot rules and savings goals. The crypto floor is Ed25519 + Shamir's Secret Sharing, designed to remain credible after the post-quantum transition. AEVION ships in EN, RU and KK from day one.`;

export default function PressPage() {
  return (
    <main style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 200px)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
        <Wave1Nav />

        <div style={{ marginTop: 12 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: "#0d9488",
              margin: "0 0 8px",
              textTransform: "uppercase",
            }}
          >
            For press · analysts · partners
          </p>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              margin: "0 0 12px",
              color: "#0f172a",
            }}
          >
            AEVION Press Kit
          </h1>
          <p style={{ fontSize: 15, color: "#475569", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            One page for journalists. Brand assets, boilerplate, key stats, founder contact.
            Anything missing? Email{" "}
            <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20press" style={{ color: "#0d9488", fontWeight: 800 }}>
              yahiin1978@gmail.com
            </a>
            {" "}with subject &quot;AEVION press&quot; and I&apos;ll respond within 24 hours.
          </p>
        </div>

        <section
          style={{
            marginTop: 28,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Key stats</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {KEY_STATS.map((s) => (
              <div key={s.label} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(13,148,136,0.05)", border: "1px solid rgba(13,148,136,0.18)" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#0d9488", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{s.label}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{s.hint}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>One-liners</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>
            Pick whichever fits the angle of the piece. Quote freely.
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#0f172a", lineHeight: 1.65, fontSize: 14 }}>
            {ONE_LINERS.map((l, i) => (
              <li key={i} style={{ marginBottom: 10 }}>{l}</li>
            ))}
          </ol>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px" }}>Boilerplate paragraph</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>
            Standard 100-word description for end-of-article use. Quote without modification.
          </p>
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(15,23,42,0.04)",
              border: "1px solid rgba(15,23,42,0.08)",
              fontSize: 14,
              lineHeight: 1.65,
              color: "#0f172a",
              fontFamily: "ui-serif, Georgia, serif",
            }}
          >
            {BOILERPLATE}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Brand colors</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {BRAND_COLORS.map((c) => (
              <div key={c.hex} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: c.hex, border: "1px solid rgba(15,23,42,0.08)" }} />
                <div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{c.hex}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{c.name}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 14, lineHeight: 1.5 }}>
            Logo SVG: download from{" "}
            <a href="/icon" style={{ color: "#0d9488", fontWeight: 700 }}>/icon</a>
            {" "}(512×512 master). Apple-touch icon at{" "}
            <a href="/apple-icon" style={{ color: "#0d9488", fontWeight: 700 }}>/apple-icon</a>.
            For vector or larger renders, email the press contact below.
          </p>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>Coverage</h2>
          <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{COVERAGE_NOTE}</p>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>Press contact</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.95 }}>
            <div>
              <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20press" style={{ color: "#fff", fontWeight: 800 }}>
                yahiin1978@gmail.com
              </a>
              {" "}— subject &quot;AEVION press&quot;, response within 24h.
            </div>
            <div style={{ marginTop: 6 }}>
              For investor briefings:{" "}
              <Link href="/pitch" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
                /pitch
              </Link>
              . For a live walk-through:{" "}
              <Link href="/demo" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
                /demo
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
