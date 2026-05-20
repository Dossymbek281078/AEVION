"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import { PaddleUpgradeButton } from "@/components/PaddleUpgradeButton";
import Onboarding from "./components/Onboarding";
import StreakCounter from "./components/StreakCounter";
import TriggerLog from "./components/TriggerLog";
import SupportChat from "./components/SupportChat";
import Affirmation from "./components/Affirmation";

type Addiction = "alcohol" | "smoking" | "other";

interface UserState {
  alias: string;
  addiction: Addiction;
  started_at: string;
  streak_start_at: string;
  total_relapses: number;
}

export default function PsyAppDepsPage() {
  const [alias, setAlias] = useState<string | null>(null);
  const [user, setUser] = useState<UserState | null>(null);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Hydrate alias from localStorage on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("psyapp-deps-alias");
      if (saved) setAlias(saved);
    } catch {
      // ignore — onboarding will run
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async (a: string) => {
    try {
      const r = await fetch(apiUrl(`/api/psyapp-deps/users/${encodeURIComponent(a)}`), {
        cache: "no-store",
      });
      const d = await r.json();
      if (r.ok && d.ok && d.user) {
        setUser(d.user as UserState);
        setStreakDays(Number(d.streak_days ?? 0));
      } else if (r.status === 404) {
        // alias saved locally but server lost user — re-onboard
        setUser(null);
        try {
          localStorage.removeItem("psyapp-deps-alias");
        } catch {
          // ignore
        }
        setAlias(null);
      }
    } catch {
      // silent — server probably cold
    }
  }, []);

  useEffect(() => {
    if (alias) fetchUser(alias);
  }, [alias, fetchUser]);

  function handleStarted(newAlias: string) {
    setAlias(newAlias);
  }

  function handleRelapse() {
    if (alias) fetchUser(alias);
  }

  function handleSignOut() {
    try {
      localStorage.removeItem("psyapp-deps-alias");
    } catch {
      // ignore
    }
    setAlias(null);
    setUser(null);
    setStreakDays(0);
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link href="/" style={styles.breadcrumb}>
            <span style={styles.breadcrumbDim}>AEVION · </span>
            <span style={styles.breadcrumbActive}>PsyApp · Recovery</span>
            <span style={styles.mvpBadge}>MVP</span>
          </Link>
          <nav style={styles.nav}>
            <Link href="/qgood" style={styles.navLink}>QGood</Link>
            <Link href="/healthai" style={styles.navLink}>HealthAI</Link>
            <Link href="/qlife" style={styles.navLink}>QLife</Link>
            {user ? (
              <button type="button" onClick={handleSignOut} style={styles.signOutBtn}>
                Сменить псевдоним
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={styles.hero}>
        <p style={styles.heroEyebrow}>Помощь выхода из зависимостей</p>
        <h1 style={styles.heroTitle}>
          Ты сильнее.
          <br />
          <span style={styles.heroGradient}>Один день — это победа.</span>
        </h1>
        <p style={styles.heroSub}>
          Алкоголь, курение или другие зависимости — путь один: маленькие шаги, поддержка и
          честность с собой. Без диагнозов, без осуждения, без следов.
        </p>
      </section>

      {/* Main flow */}
      <section style={styles.section}>
        {loading ? (
          <div style={styles.placeholder}>Загружаю…</div>
        ) : !user ? (
          <Onboarding onStarted={handleStarted} />
        ) : (
          <div style={styles.dashboard}>
            <StreakCounter
              alias={user.alias}
              addiction={user.addiction}
              streakDays={streakDays}
              totalRelapses={user.total_relapses}
              startedAt={user.started_at}
              onRelapse={handleRelapse}
            />

            <div style={styles.affirmationWrap}>
              <Affirmation />
            </div>

            <div style={styles.twoCol}>
              <TriggerLog alias={user.alias} />
              <SupportChat alias={user.alias} />
            </div>
          </div>
        )}
      </section>

      {/* Care reminder */}
      <section style={styles.section}>
        <div style={styles.careCard}>
          <strong style={styles.careTitle}>Это поддержка, не лечение.</strong>
          <p style={styles.careText}>
            При тяжёлых симптомах (галлюцинации, тремор, мысли о самоповреждении) — обратись
            к врачу или на горячую линию помощи. PsyApp идёт рядом, не вместо специалиста.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 16px" }}>
        <PaddleUpgradeButton variant="banner" appId="psyapp-deps" label="Разблокировать PsyApp Pro — 14 дней бесплатно" />
      </section>

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 32px" }}>
        <MvpConceptBoard
          moduleId="psyapp-deps"
          noun="concept/messages"
          accent="sky"
          sectionTitle="Recovery concept board"
          sectionHint="Что реально помогало в выходе из зависимости? Какие триггеры опаснее всего?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея / практика / триггер", placeholder: "напр.: HALT-чек перед срывом", required: true },
            { key: "rationale", label: "Что это даёт", type: "textarea", placeholder: "Как это работает, личный опыт" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
          ]}
        />
      </section>

      <footer style={styles.footer}>
        AEVION · PsyApp · Recovery MVP · 18+
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0d0a06",
    color: "#f5ebd7",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    borderBottom: "1px solid #2a241c",
    background: "rgba(13,10,6,0.9)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    fontSize: 14,
  },
  breadcrumbDim: { color: "#7d6f54" },
  breadcrumbActive: { color: "#9bd4a8", fontWeight: 700 },
  mvpBadge: {
    background: "rgba(63,111,79,0.2)",
    border: "1px solid #3f6f4f",
    borderRadius: 20,
    color: "#9bd4a8",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "2px 8px",
    textTransform: "uppercase",
  },
  nav: { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" },
  navLink: { color: "#9b8b6e", fontSize: 13, textDecoration: "none" },
  signOutBtn: {
    background: "transparent",
    color: "#9b8b6e",
    border: "1px solid #3a342c",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 12,
    cursor: "pointer",
  },

  hero: { maxWidth: 1100, margin: "0 auto", padding: "48px 20px 32px" },
  heroEyebrow: {
    color: "#9bd4a8",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    margin: "0 0 14px 0",
  },
  heroTitle: {
    color: "#f5ebd7",
    fontSize: "clamp(32px, 6vw, 56px)",
    fontWeight: 800,
    lineHeight: 1.1,
    margin: "0 0 16px 0",
    letterSpacing: "-0.02em",
  },
  heroGradient: {
    background: "linear-gradient(135deg, #9bd4a8, #5b9d70)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    color: "#b8a98c",
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 640,
    margin: 0,
  },

  section: { maxWidth: 1100, margin: "0 auto", padding: "0 20px 32px" },
  placeholder: {
    background: "#1a1510",
    border: "1px solid #2a241c",
    borderRadius: 16,
    padding: 40,
    textAlign: "center",
    color: "#7d6f54",
    fontStyle: "italic",
  },
  dashboard: { display: "flex", flexDirection: "column", gap: 20 },
  affirmationWrap: { maxWidth: 720, margin: "0 auto", width: "100%" },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
    alignItems: "start",
  },

  careCard: {
    background: "rgba(180,140,80,0.08)",
    border: "1px solid #5a4a2f",
    borderRadius: 12,
    padding: "16px 20px",
  },
  careTitle: { color: "#e8d29a", fontSize: 14, display: "block", marginBottom: 6 },
  careText: { color: "#c4b48e", fontSize: 13, lineHeight: 1.6, margin: 0 },

  footer: {
    borderTop: "1px solid #2a241c",
    padding: "24px 20px",
    textAlign: "center",
    color: "#7d6f54",
    fontSize: 11,
  },
};
