"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import BiomarkerForm from "./components/BiomarkerForm";
import TrendCard from "./components/TrendCard";
import PlanCard from "./components/PlanCard";
import StatsStrip from "./components/StatsStrip";

interface BiomarkerRecord {
  id: number;
  type: string;
  value: number;
  unit: string;
  notes: string | null;
  measured_at: string;
}

export default function QLifePage() {
  const [biomarkers, setBiomarkers] = useState<BiomarkerRecord[]>([]);
  const [bLoading, setBLoading] = useState(true);
  const [statsKey, setStatsKey] = useState(0);

  const loadBiomarkers = useCallback(async () => {
    setBLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qlife/biomarkers?limit=30"), { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setBiomarkers(d.biomarkers ?? []);
    } catch {
      // ignore
    } finally {
      setBLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBiomarkers();
  }, [loadBiomarkers]);

  function handleLogged() {
    loadBiomarkers();
    setStatsKey((k) => k + 1);
  }

  return (
    <main style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link href="/" style={styles.breadcrumb}>
            <span style={styles.breadcrumbDim}>AEVION · </span>
            <span style={styles.breadcrumbActive}>QLife</span>
            <span style={styles.mvpBadge}>MVP</span>
          </Link>
          <nav style={styles.nav}>
            <Link href="/modules" style={styles.navLink}>Modules</Link>
            <Link href="/qpersona" style={styles.navLink}>QPersona</Link>
            <Link href="/healthai" style={styles.navLink}>HealthAI</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={styles.hero}>
        <p style={styles.heroEyebrow}>Longevity & Anti-Aging</p>
        <h1 style={styles.heroTitle}>
          {"Живи дольше, "}
          <span style={styles.heroGradient}>стареей медленнее</span>
        </h1>
        <p style={styles.heroSub}>
          Логируй биомаркеры, отслеживай тренды и получай персональный AI-план
          долголетия на основе доказательной медицины.
        </p>

        <div style={styles.chipRow}>
          {["Blood Pressure", "Sleep", "HRV", "VO2 Max", "Glucose", "Stress"].map((c) => (
            <span key={c} style={styles.chip}>{c}</span>
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section style={styles.section}>
        <StatsStrip refreshKey={statsKey} />
      </section>

      {/* Main grid: form + trends */}
      <section style={styles.section}>
        <div style={styles.twoCol}>
          <BiomarkerForm onLogged={handleLogged} />
          <TrendCard biomarkers={biomarkers} loading={bLoading} />
        </div>
      </section>

      {/* AI Plan */}
      <section style={styles.section}>
        <PlanCard />
      </section>

      {/* Footer links */}
      <section style={styles.section}>
        <div style={styles.footerCard}>
          <span style={styles.footerTitle}>Explore AEVION</span>
          <div style={styles.footerLinks}>
            {[
              { href: "/modules",  label: "All Modules" },
              { href: "/healthai", label: "HealthAI" },
              { href: "/qpersona", label: "QPersona" },
              { href: "/globus",   label: "Globus Map" },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={styles.footerLink}>{l.label}</Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 32px" }}>
        <MvpConceptBoard
          moduleId="qlife"
          noun="concept/messages"
          accent="rose"
          sectionTitle="Longevity concept board"
          sectionHint="Какие биомаркеры важнее для anti-aging? Какие протоколы стоит трекать?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея / биомаркер / протокол", placeholder: "напр.: glucose continuous monitoring", required: true },
            { key: "rationale", label: "Зачем это важно", type: "textarea", placeholder: "Какой механизм старения это адресует, источник" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
          ]}
        />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#020817",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    borderBottom: "1px solid #1e293b",
    background: "rgba(2,8,23,0.85)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerInner: {
    maxWidth: 1152,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    textDecoration: "none",
    fontSize: 14,
  },
  breadcrumbDim: { color: "#64748b" },
  breadcrumbActive: { color: "#6ee7b7", fontWeight: 700 },
  mvpBadge: {
    background: "rgba(16,185,129,0.15)",
    border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: 20,
    color: "#34d399",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "2px 8px",
    textTransform: "uppercase",
  },
  nav: {
    display: "flex",
    gap: 20,
  },
  navLink: {
    color: "#64748b",
    fontSize: 13,
    textDecoration: "none",
  },

  hero: {
    maxWidth: 1152,
    margin: "0 auto",
    padding: "56px 20px 40px",
  },
  heroEyebrow: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    margin: "0 0 12px 0",
  },
  heroTitle: {
    color: "#f1f5f9",
    fontSize: "clamp(28px, 5vw, 48px)",
    fontWeight: 800,
    lineHeight: 1.15,
    margin: "0 0 16px 0",
  },
  heroGradient: {
    background: "linear-gradient(135deg, #34d399, #0d9488)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 600,
    margin: "0 0 24px 0",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 20,
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 12px",
  },

  section: {
    maxWidth: 1152,
    margin: "0 auto",
    padding: "0 20px 32px",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    alignItems: "start",
  },

  footerCard: {
    background: "rgba(15,23,42,0.6)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  footerTitle: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
  },
  footerLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  footerLink: {
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: 20,
    color: "#cbd5e1",
    fontSize: 13,
    padding: "5px 14px",
    textDecoration: "none",
  },
};
