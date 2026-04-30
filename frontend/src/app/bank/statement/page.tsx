"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { apiUrl } from "@/lib/apiBase";
import { fetchMe, listAccounts, listOperations } from "../_lib/api";

async function downloadStatementPdf(period: string) {
  if (typeof window === "undefined") return;
  let token = "";
  try {
    token = localStorage.getItem("aevion_auth_token_v1") || "";
  } catch {
    // ignore
  }
  const r = await fetch(apiUrl(`/api/qtrade/statement.pdf?period=${encodeURIComponent(period)}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!r.ok) {
    alert(`Statement PDF download failed (${r.status})`);
    return;
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aevion-statement-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import { loadGoals } from "../_lib/savings";
import { loadRecurring } from "../_lib/recurring";
import { loadSignatures } from "../_lib/signatures";
import type { Account, Me, Operation } from "../_lib/types";
import { SubrouteFooter } from "../_components/SubrouteFooter";

type Period = "30d" | "90d" | "ytd" | "all";

const PERIOD_DAYS: Record<Exclude<Period, "ytd" | "all">, number> = {
  "30d": 30,
  "90d": 90,
};

export default function BankStatementPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [period, setPeriod] = useState<Period>("30d");
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    setCode(loadCurrency());
    let cancelled = false;
    (async () => {
      try {
        const [m, a, o] = await Promise.all([
          fetchMe(),
          listAccounts(),
          listOperations(),
        ]);
        if (cancelled) return;
        setMe(m);
        setAccounts(a);
        setOperations(o);
      } catch {
        // pingBackend handles offline; statement just shows whatever loaded.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const account = accounts[0] ?? null;

  const range = useMemo(() => {
    const end = Date.now();
    let start: number;
    if (period === "all") {
      start = 0;
    } else if (period === "ytd") {
      const d = new Date();
      start = new Date(d.getFullYear(), 0, 1).getTime();
    } else {
      start = end - PERIOD_DAYS[period] * 86_400_000;
    }
    return { start, end };
  }, [period]);

  const filtered = useMemo(() => {
    return operations.filter((op) => {
      const ts = Date.parse(op.createdAt);
      return Number.isFinite(ts) && ts >= range.start && ts <= range.end;
    });
  }, [operations, range]);

  const stats = useMemo(() => {
    if (!account) {
      return { inflow: 0, outflow: 0, net: 0, ops: 0, topDay: null as null | { date: string; amount: number } };
    }
    let inflow = 0;
    let outflow = 0;
    const byDay: Record<string, number> = {};
    for (const op of filtered) {
      const day = op.createdAt.slice(0, 10);
      const isOut = op.kind === "transfer" && op.from === account.id;
      const amt = op.amount;
      if (isOut) {
        outflow += amt;
        byDay[day] = (byDay[day] ?? 0) - amt;
      } else {
        inflow += amt;
        byDay[day] = (byDay[day] ?? 0) + amt;
      }
    }
    let topDay: { date: string; amount: number } | null = null;
    for (const [date, amount] of Object.entries(byDay)) {
      if (!topDay || Math.abs(amount) > Math.abs(topDay.amount)) {
        topDay = { date, amount };
      }
    }
    return { inflow, outflow, net: inflow - outflow, ops: filtered.length, topDay };
  }, [filtered, account]);

  const localState = useMemo(() => {
    if (typeof window === "undefined") {
      return { goals: 0, goalsTotal: 0, recurring: 0, signed: 0 };
    }
    const goals = loadGoals();
    const recurring = loadRecurring().filter((r) => r.active);
    const signed = loadSignatures().length;
    const goalsTotal = goals.reduce((s, g) => s + g.currentAec, 0);
    return { goals: goals.length, goalsTotal, recurring: recurring.length, signed };
  }, [loaded]);

  // Auto-open print dialog after a short delay so the user sees the layout first.
  useEffect(() => {
    if (!loaded) return;
    const handle = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore — user can still hit Ctrl+P
      }
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [loaded]);

  const periodLabel = t(`statement.period.${period}`);

  return (
    <main className="aevion-statement">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          body { background: #fff !important; }
          .aevion-statement-controls { display: none !important; }
          .aevion-statement { box-shadow: none !important; padding: 0 !important; }
        }
        .aevion-statement {
          max-width: 820px;
          margin: 0 auto;
          padding: 32px 28px;
          background: #fff;
          color: #0f172a;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .aevion-statement h1 { font-size: 24px; margin: 0 0 4px 0; font-weight: 900; letter-spacing: -0.5px; }
        .aevion-statement h2 { font-size: 14px; margin: 24px 0 10px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .aevion-statement table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .aevion-statement th, .aevion-statement td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .aevion-statement th { background: #f8fafc; font-weight: 800; }
        .aevion-statement .num { font-variant-numeric: tabular-nums; text-align: right; }
        .aevion-statement .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 8px; }
        .aevion-statement .stat { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .aevion-statement .stat-label { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; }
        .aevion-statement .stat-value { font-size: 18px; font-weight: 900; margin-top: 2px; }
        .aevion-statement-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
        .aevion-statement-controls button { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 12px; font-weight: 700; }
        .aevion-statement-controls button[aria-pressed="true"] { background: #0f172a; color: #fff; border-color: #0f172a; }
      `}</style>

      <div className="aevion-statement-controls">
        <Link
          href="/bank"
          style={{
            color: "#475569",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ← {t("statement.backToBank")}
        </Link>
        <span style={{ flex: 1 }} />
        {(["30d", "90d", "ytd", "all"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {t(`statement.period.${p}`)}
          </button>
        ))}
        <button type="button" onClick={() => window.print()}>
          {t("statement.print")}
        </button>
        <button
          type="button"
          onClick={() => void downloadStatementPdf(period)}
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(14,165,233,0.10))",
            color: "#4c1d95",
            borderColor: "rgba(124,58,237,0.30)",
          }}
        >
          ⬇ PDF
        </button>
      </div>

      <header style={{ marginBottom: 18 }}>
        <h1>{t("statement.title")}</h1>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {t("statement.generatedFor", {
            email: me?.email ?? t("statement.unknownUser"),
            period: periodLabel,
          })}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {t("statement.generatedAt", {
            date: new Date().toLocaleString(),
          })}
          {account ? ` · ${account.id}` : ""}
        </div>
      </header>

      <section>
        <h2>{t("statement.section.summary")}</h2>
        <div className="grid">
          <Stat label={t("statement.stat.balance")} value={account ? formatCurrency(account.balance, code) : "—"} />
          <Stat label={t("statement.stat.inflow")} value={formatCurrency(stats.inflow, code)} />
          <Stat label={t("statement.stat.outflow")} value={formatCurrency(stats.outflow, code)} />
          <Stat
            label={t("statement.stat.net")}
            value={`${stats.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(stats.net), code)}`}
          />
          <Stat label={t("statement.stat.ops")} value={String(stats.ops)} />
          {stats.topDay ? (
            <Stat
              label={t("statement.stat.topDay")}
              value={`${stats.topDay.date} · ${stats.topDay.amount >= 0 ? "+" : "−"}${formatCurrency(Math.abs(stats.topDay.amount), code)}`}
            />
          ) : null}
        </div>
      </section>

      <section>
        <h2>{t("statement.section.commitments")}</h2>
        <div className="grid">
          <Stat
            label={t("statement.stat.goals")}
            value={
              localState.goals === 0
                ? "—"
                : `${localState.goals} · ${formatCurrency(localState.goalsTotal, code)}`
            }
          />
          <Stat label={t("statement.stat.recurring")} value={String(localState.recurring)} />
          <Stat label={t("statement.stat.signed")} value={String(localState.signed)} />
        </div>
      </section>

      <section>
        <h2>{t("statement.section.transactions")}</h2>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748b", padding: "12px 0" }}>
            {t("statement.empty")}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 130 }}>{t("statement.col.date")}</th>
                <th>{t("statement.col.type")}</th>
                <th>{t("statement.col.counterparty")}</th>
                <th className="num">{t("statement.col.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 80).map((op) => {
                const isOut = op.kind === "transfer" && account != null && op.from === account.id;
                const sign = isOut ? "−" : "+";
                const counterparty =
                  op.kind === "topup"
                    ? t("statement.cp.topup")
                    : isOut
                      ? op.to
                      : op.from ?? "—";
                return (
                  <tr key={op.id}>
                    <td>{new Date(op.createdAt).toLocaleString()}</td>
                    <td>{op.kind}</td>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>
                      {counterparty.length > 26 ? `${counterparty.slice(0, 12)}…${counterparty.slice(-8)}` : counterparty}
                    </td>
                    <td className="num" style={{ color: isOut ? "#dc2626" : "#059669", fontWeight: 700 }}>
                      {sign}{formatCurrency(op.amount, code)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 80 ? (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
            {t("statement.truncated", { shown: 80, total: filtered.length })}
          </div>
        ) : null}
      </section>

      <footer style={{ marginTop: 28, borderTop: "1px solid #e2e8f0", paddingTop: 12, fontSize: 10, color: "#94a3b8" }}>
        {t("statement.footer")}
      </footer>

      <SubrouteFooter active="/bank/statement" />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
