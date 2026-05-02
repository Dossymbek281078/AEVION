"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { listAccounts, listOperations } from "../_lib/api";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  loadRoundUpConfig,
  pendingStash,
  yearToDateStash,
  type RoundUpConfig,
} from "../_lib/roundUp";
import {
  GOALS_EVENT,
  ICON_COLOR,
  ICON_SYMBOL,
  loadGoals,
  type SavingsGoal,
} from "../_lib/savings";
import type { Account, Operation } from "../_lib/types";
import { lifetimeStats, loadVault, VAULT_EVENT, type VaultPosition } from "../_lib/vault";

export default function SavingsPage() {
  const { t, lang } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [vault, setVault] = useState<VaultPosition[]>([]);
  const [config, setConfig] = useState<RoundUpConfig | null>(null);
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setCode(loadCurrency());
    setGoals(loadGoals());
    setVault(loadVault());
    setConfig(loadRoundUpConfig());
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("storage", bump);
    window.addEventListener(GOALS_EVENT, bump);
    window.addEventListener(VAULT_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(GOALS_EVENT, bump);
      window.removeEventListener(VAULT_EVENT, bump);
    };
  }, []);

  const myAccount = accounts[0] ?? null;
  const vaultStats = useMemo(() => lifetimeStats(vault), [vault]);

  const goalsTotalSaved = useMemo(
    () => goals.reduce((s, g) => s + (g.currentAec || 0), 0),
    [goals],
  );
  const goalsTotalTarget = useMemo(
    () => goals.reduce((s, g) => s + (g.targetAec || 0), 0),
    [goals],
  );

  const roundUpAggregate = useMemo(() => {
    if (!myAccount || !config) return { pendingAmount: 0, pendingOps: 0, ytd: 0, lifetimeRealized: 0 };
    const cursorMs = config.realizedCursor ? Date.parse(config.realizedCursor) : 0;
    const pending = pendingStash(operations, myAccount.id, config.increment, Number.isFinite(cursorMs) ? cursorMs : 0);
    const ytd = yearToDateStash(operations, myAccount.id, config.increment, config.lifetimeRealized);
    return {
      pendingAmount: pending.amount,
      pendingOps: pending.opCount,
      ytd: ytd.ytd,
      lifetimeRealized: config.lifetimeRealized,
    };
  }, [operations, myAccount, config]);

  const grandTotal = useMemo(
    () =>
      goalsTotalSaved +
      vaultStats.lockedPrincipal +
      vaultStats.pendingYield +
      roundUpAggregate.pendingAmount,
    [goalsTotalSaved, vaultStats, roundUpAggregate],
  );

  const fmt = (n: number) => formatCurrency(n, code);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(217,119,6,0.16), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#fbbf24",
              textTransform: "uppercase",
            }}
          >
            {t("savingsPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("savingsPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("savingsPage.lede")}
          </div>
        </header>

        {/* Grand total hero */}
        <section
          style={{
            padding: 24,
            borderRadius: 18,
            background:
              "linear-gradient(135deg, rgba(217,119,6,0.20), rgba(99,102,241,0.10))",
            border: "1px solid rgba(251,191,36,0.30)",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", color: "#fbbf24" }}>
              {t("savingsPage.total.kicker")}
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.05, marginTop: 6 }}>
              {fmt(grandTotal)}
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 6 }}>
              {t("savingsPage.total.body")}
            </div>
          </div>
        </section>

        {/* Three-product mini stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
            marginBottom: 28,
          }}
        >
          <Stat
            label={t("savingsPage.mini.goals")}
            value={fmt(goalsTotalSaved)}
            sub={t("savingsPage.mini.goalsSub", { count: goals.length })}
            accent="#7c3aed"
          />
          <Stat
            label={t("savingsPage.mini.vault")}
            value={fmt(vaultStats.lockedPrincipal + vaultStats.pendingYield)}
            sub={t("savingsPage.mini.vaultSub", { count: vaultStats.activeCount })}
            accent="#0ea5e9"
          />
          <Stat
            label={t("savingsPage.mini.roundup")}
            value={fmt(roundUpAggregate.pendingAmount)}
            sub={t("savingsPage.mini.roundupSub", { count: roundUpAggregate.pendingOps })}
            accent="#0d9488"
          />
        </div>

        {/* Goals section */}
        <SectionHeader
          kicker={t("savingsPage.goals.kicker")}
          title={t("savingsPage.goals.title")}
          accent="#7c3aed"
          editHref="/bank#goals"
          editLabel={t("savingsPage.editIn")}
        />
        {goals.length === 0 ? (
          <EmptyCard
            accent="#7c3aed"
            title={t("savingsPage.goals.emptyTitle")}
            body={t("savingsPage.goals.emptyBody")}
          />
        ) : (
          <ul style={listStyle}>
            {goals.map((g) => {
              const pct = g.targetAec > 0 ? Math.min(100, (g.currentAec / g.targetAec) * 100) : 0;
              const color = ICON_COLOR[g.icon] ?? "#7c3aed";
              return (
                <li key={g.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: `${color}26`,
                          color,
                          fontSize: 18,
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {ICON_SYMBOL[g.icon]}
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{g.label}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                          {fmt(g.currentAec)} / {fmt(g.targetAec)}
                          {g.deadlineISO && (
                            <span> · {formatDate(g.deadlineISO, lang)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color }}>
                      {Math.round(pct)}%
                    </div>
                  </div>
                  <div
                    style={{
                      position: "relative" as const,
                      height: 8,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      marginTop: 10,
                    }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct)}
                    aria-label={g.label}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}99)`,
                        borderRadius: 999,
                        transition: "width 600ms ease-out",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Vault section */}
        <SectionHeader
          kicker={t("savingsPage.vault.kicker")}
          title={t("savingsPage.vault.title")}
          accent="#0ea5e9"
          editHref="/bank#vault"
          editLabel={t("savingsPage.editIn")}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <MiniStat label={t("savingsPage.vault.locked")} value={fmt(vaultStats.lockedPrincipal)} accent="#0ea5e9" />
          <MiniStat label={t("savingsPage.vault.pendingYield")} value={fmt(vaultStats.pendingYield)} accent="#5eead4" />
          <MiniStat label={t("savingsPage.vault.claimed")} value={fmt(vaultStats.claimedTotal)} accent="#a78bfa" />
          <MiniStat
            label={t("savingsPage.vault.mature")}
            value={`${vaultStats.matureCount} / ${vaultStats.activeCount}`}
            accent="#fbbf24"
          />
        </div>
        {vault.length === 0 && (
          <EmptyCard
            accent="#0ea5e9"
            title={t("savingsPage.vault.emptyTitle")}
            body={t("savingsPage.vault.emptyBody")}
          />
        )}

        {/* Round-Up section */}
        <SectionHeader
          kicker={t("savingsPage.roundup.kicker")}
          title={t("savingsPage.roundup.title")}
          accent="#0d9488"
          editHref="/bank#roundup"
          editLabel={t("savingsPage.editIn")}
        />
        <div
          style={{
            padding: 18,
            borderRadius: 14,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(13,148,136,0.20)",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "#5eead4", textTransform: "uppercase" }}>
                {t("savingsPage.roundup.statusKicker")}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginTop: 4 }}>
                {config?.enabled
                  ? t("savingsPage.roundup.enabled", { increment: config.increment })
                  : t("savingsPage.roundup.disabled")}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                {t("savingsPage.roundup.detail", {
                  pendingOps: roundUpAggregate.pendingOps,
                  pending: fmt(roundUpAggregate.pendingAmount),
                  ytd: fmt(roundUpAggregate.ytd),
                  realized: fmt(roundUpAggregate.lifetimeRealized),
                })}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#5eead4" }}>
                {fmt(roundUpAggregate.pendingAmount)}
              </div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>
                {t("savingsPage.roundup.pendingLabel")}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
            marginTop: 4,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#5eead4", textTransform: "uppercase" }}>
            {t("savingsPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("savingsPage.cta.title")}
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, lineHeight: 1.55 }}>
            {t("savingsPage.cta.body")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank" style={ctaPrimary}>
              {t("about.cta.openBank")}
            </Link>
            <Link href="/bank/about" style={ctaSecondary}>
              {t("trust.page.cta.aboutLink")}
            </Link>
          </div>
        </section>

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

function SectionHeader({
  kicker,
  title,
  accent,
  editHref,
  editLabel,
}: {
  kicker: string;
  title: string;
  accent: string;
  editHref: string;
  editLabel: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8, marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", color: accent }}>
          {kicker}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: "4px 0 0 0", lineHeight: 1.2, letterSpacing: -0.4 }}>
          {title}
        </h2>
      </div>
      <Link
        href={editHref}
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: accent,
          textDecoration: "none",
          padding: "6px 12px",
          borderRadius: 999,
          border: `1px solid ${accent}40`,
          background: `${accent}10`,
        }}
      >
        {editLabel} →
      </Link>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: "uppercase", color: accent }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "rgba(15,23,42,0.55)",
        border: `1px solid ${accent}26`,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 2, fontWeight: 800, textTransform: "uppercase", color: accent }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function EmptyCard({ accent, title, body }: { accent: string; title: string; body: string }) {
  return (
    <div
      style={{
        padding: 22,
        borderRadius: 14,
        background: "rgba(15,23,42,0.55)",
        border: `1px dashed ${accent}40`,
        textAlign: "center",
        color: "#cbd5e1",
        marginBottom: 28,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(
      (lang as string) === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US",
      { dateStyle: "medium" },
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 28px 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const cardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "rgba(15,23,42,0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
  color: "#fff",
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
