"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ldFees, todayRealizedPnl } from "@/app/qtrade/fees";
import { ldClosed } from "@/app/qtrade/marketSim";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { tNav, useNavLang, type NavKey } from "./navI18n";
type Props = {
  hidePlanet?: boolean;
  variant?: "light" | "dark";
};

// Lightweight AEV balance pill — reads localStorage every 4s, no react-context needed
// (each page that uses Wave1Nav gets its own subscription, but the read is cheap).
function AevPill({ variant }: { variant: "light" | "dark" }) {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const s = localStorage.getItem("aevion_aev_wallet_v1");
        if (!s) { setBalance(0); return; }
        const r = JSON.parse(s);
        const b = typeof r?.balance === "number" ? r.balance : 0;
        setBalance(b);
      } catch { setBalance(0); }
    };
    read();
    const id = setInterval(read, 4000);
    const onStorage = (e: StorageEvent) => { if (e.key === "aevion_aev_wallet_v1") read(); };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(id); window.removeEventListener("storage", onStorage); };
  }, []);
  if (balance === null) return null;
  const dark = variant === "dark";
  return (
    <Link href="/aev" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999,
      background: dark ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.12)",
      border: dark ? "1px solid rgba(34,211,238,0.45)" : "1px solid #67e8f9",
      color: dark ? "#67e8f9" : "#0e7490",
      fontWeight: 800, fontSize: 12, textDecoration: "none",
      fontFamily: "ui-monospace, SFMono-Regular, monospace",
    }} title={tNav(useNavLang(), "aevWallet")}>
      <span style={{ fontSize: 11 }}>◆</span>
      <span>{balance.toFixed(2)} AEV</span>
    </Link>
  );
}

// Risk pill — sticky daily-loss usage indicator. Видна только когда юзер
// явно включил fees + cap. Кликабельная → /qtrade. Хёрбит то же самое
// колор-tier что в FeesPanel: green <75% / amber 75-99% / red ≥100%.
function RiskPill({ variant }: { variant: "light" | "dark" }) {
  const [data, setData] = useState<{ enabled: boolean; cap: number; today: number } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const fees = ldFees();
        const cap = fees.dailyLossLimitUsd ?? 0;
        if (!fees.enabled || cap <= 0) {
          setData({ enabled: false, cap: 0, today: 0 });
          return;
        }
        const closed = ldClosed();
        setData({ enabled: true, cap, today: todayRealizedPnl(closed) });
      } catch { setData(null); }
    };
    read();
    const id = setInterval(read, 4000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "aevion_qtrade_fees_v1" || e.key === "aevion_qtrade_closed_v1") read();
    };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(id); window.removeEventListener("storage", onStorage); };
  }, []);
  if (!data || !data.enabled) return null;
  const usagePct = data.today < 0 ? Math.min(100, (-data.today / data.cap) * 100) : 0;
  const dark = variant === "dark";
  const tier = usagePct >= 100 ? "red" : usagePct >= 75 ? "amber" : "green";
  // Both light + dark — high-contrast colors for a11y.
  const colors: Record<typeof tier, { fg: string; bg: string; border: string }> = dark
    ? {
        green: { fg: "#86efac", bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.45)" },
        amber: { fg: "#fde68a", bg: "rgba(251,191,36,0.18)", border: "rgba(251,191,36,0.45)" },
        red: { fg: "#fca5a5", bg: "rgba(220,38,38,0.18)", border: "rgba(220,38,38,0.50)" },
      }
    : {
        green: { fg: "#15803d", bg: "rgba(34,197,94,0.10)", border: "#86efac" },
        amber: { fg: "#a16207", bg: "rgba(251,191,36,0.12)", border: "#fde68a" },
        red: { fg: "#b91c1c", bg: "rgba(220,38,38,0.10)", border: "#fca5a5" },
      };
  const c = colors[tier];
  const sign = data.today >= 0 ? "+" : "";
  return (
    <Link
      href="/qtrade"
      title={`Daily P&L ${sign}$${data.today.toFixed(2)} · cap $${data.cap.toFixed(0)} · usage ${usagePct.toFixed(0)}%`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 9px", borderRadius: 999,
        background: c.bg, border: `1px solid ${c.border}`, color: c.fg,
        fontWeight: 800, fontSize: 12, textDecoration: "none",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      <span aria-hidden>🛡</span>
      <span>{sign}${data.today.toFixed(2)} · {usagePct.toFixed(0)}%</span>
    </Link>
  );
}

export function Wave1Nav({ hidePlanet = false, variant = "light" }: Props) {
  // 20.10.2026: ярлыки — из словаря navI18n.ts (ru/en/kk). Раньше были английскими
  // литералами, по-русски их переписывал машинный доводчик после монтирования, а на
  // kk внутри приложений (APP_PREFIXES) они оставались английскими.
  const lang = useNavLang();
  const n = (k: NavKey) => tNav(lang, k);
  const sep = variant === "dark" ? "rgba(148,163,184,0.5)" : "#cbd5e1";
  const link = variant === "dark" ? "#e2e8f0" : "#334155";
  // Teal-700 (#0f766e) on slate-50 (#f8fafc) ≈ 5.5:1 — passes WCAG 2 AA.
  // Was teal-600 (#0d9488) ≈ 3.57:1 (axe-core flagged).
  const globus = variant === "dark" ? "#5eead4" : "#0f766e";
  const demoLink = variant === "dark" ? "#5eead4" : "#0f766e";
  const shield = variant === "dark" ? "#7dd3fc" : "#0369a1";
  const qcore = variant === "dark" ? "#c4b5fd" : "#6d28d9";
  return (
    // 144 (18.10.2026): на телефоне (≤768) этот блок переносился в 7 строк и занимал 162 px первого экрана
    // (замер /startup-exchange 390×844 на проде eaca8fb62: nav 55..217), действие гостя уезжало за кадр.
    // Класс aevion-wave1nav (globals.css): одна строка с боковой прокруткой — все ссылки на месте, высота ~26 px.
    <nav className="aevion-wave1nav" translate="no" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, fontSize: 13, alignItems: "center" }} aria-label={n("ariaNav")}>
      <Link href="/" style={{ color: globus, fontWeight: 800 }}>{n("globus")}</Link>
      <span style={{ color: sep }} aria-hidden>|</span>
      <Link href="/demo" style={{ color: demoLink, fontWeight: 800 }}>{n("demo")}</Link>
      <Link href="/demo/deep" style={{ color: link, fontWeight: 650 }}>{n("deepDive")}</Link>
      <Link href="/pitch" style={{ color: variant === "dark" ? "#fbbf24" : "#b45309", fontWeight: 800 }}>{n("pitch")}</Link>
      <span style={{ color: sep }} aria-hidden>|</span>
      <Link href="/auth" style={{ color: link, fontWeight: 600 }}>{n("auth")}</Link>
      <Link href="/qright" style={{ color: link, fontWeight: 600 }}>QRight</Link>
      <Link href="/qsign" style={{ color: link, fontWeight: 600 }}>QSign</Link>
      <Link href="/quantum-shield" style={{ color: shield, fontWeight: 700 }}>{n("shield")}</Link>
      <Link href="/bureau" style={{ color: link, fontWeight: 600 }}>{n("bureau")}</Link>
      <Link href="/multichat-engine" style={{ color: qcore, fontWeight: 700 }}>QCoreAI</Link>
      <span style={{ color: sep }} aria-hidden>|</span>
      <Link href="/awards/music" style={{ color: link, fontWeight: 600 }}>{n("musicAwards")}</Link>
      <Link href="/awards/film" style={{ color: link, fontWeight: 600 }}>{n("filmAwards")}</Link>
      <Link href="/bank" style={{ color: link, fontWeight: 600 }}>{n("bank")}</Link>
      <Link href="/cyberchess" style={{ color: link, fontWeight: 600 }}>{n("chess")}</Link>
      <Link href="/qtradeoffline" style={{ color: link, fontWeight: 600 }}>QTradeOffline</Link>
      <Link href="/healthai" style={{ color: link, fontWeight: 600 }}>HealthAI</Link>
      <Link href="/qcontract" style={{ color: link, fontWeight: 600 }}>QContract</Link>
      <Link href="/qpaynet" style={{ color: link, fontWeight: 600 }}>QPayNet</Link>
      <Link href="/startup-exchange" style={{ color: link, fontWeight: 600 }}>{n("startupExchange")}</Link>
      <Link href="/studio" style={{ color: "#0d9488", fontWeight: 800 }}>{n("studio")}</Link>
      <Link href="/devhub" style={{ color: link, fontWeight: 600 }}>DevHub</Link>
      <Link href="/smeta-trainer" style={{ color: link, fontWeight: 600 }}>{n("smeta")}</Link>
      <Link href="/qtrade" style={{ color: link, fontWeight: 600 }}>QTrade</Link>
      <Link href="/revenue" style={{ color: link, fontWeight: 600 }}>{n("revenue")}</Link>
      <Link href="/sdks" style={{ color: link, fontWeight: 600 }}>{n("sdks")}</Link>
      <span style={{ color: sep }} aria-hidden>|</span>
      <AevPill variant={variant} />
      <RiskPill variant={variant} />
      {!hidePlanet ? (<><span style={{ color: sep }} aria-hidden>|</span><Link href="/planet" style={{ color: link, fontWeight: 600 }}>{n("planet")}</Link></>) : null}
    </nav>
  );
}
