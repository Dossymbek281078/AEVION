"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  achievementStats,
  evaluateAchievements,
  type Achievement,
} from "../_lib/achievements";
import { listAccounts, listOperations } from "../_lib/api";
import { loadAdvance } from "../_lib/advance";
import { CIRCLES_EVENT, loadCircles } from "../_lib/circles";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import { GIFTS_EVENT, loadGifts } from "../_lib/gifts";
import { GOALS_EVENT, loadGoals } from "../_lib/savings";
import { SIGNATURE_EVENT, loadSignatures, type SignedOperation } from "../_lib/signatures";
import { detectAnomalies, ANOMALY_LABEL_KEY, type Anomaly } from "../_lib/anomaly";
import type { Account, Operation } from "../_lib/types";

type EventKind = "achievement" | "signature" | "anomaly" | "gift" | "goal";

type Item = {
  id: string;
  kind: EventKind;
  ts: number;
  iconBg: string;
  icon: string;
  title: string;
  body: string;
  amountText?: string;
  href?: string;
};

const KIND_BG: Record<EventKind, string> = {
  achievement: "linear-gradient(135deg, #d97706, #fbbf24)",
  signature: "linear-gradient(135deg, #0d9488, #5eead4)",
  anomaly: "linear-gradient(135deg, #dc2626, #f97316)",
  gift: "linear-gradient(135deg, #db2777, #f472b6)",
  goal: "linear-gradient(135deg, #7c3aed, #c026d3)",
};

const KIND_ICON: Record<EventKind, string> = {
  achievement: "★",
  signature: "✓",
  anomaly: "!",
  gift: "♥",
  goal: "✦",
};

export default function NotificationsPage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [code] = useState<CurrencyCode>(() =>
    typeof window === "undefined" ? "AEC" : loadCurrency(),
  );
  const [tick, setTick] = useState<number>(0);
  const biometric = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(localStorage.getItem("aevion_bank_biometric_v1"));
    } catch {
      return false;
    }
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
    window.addEventListener(SIGNATURE_EVENT, bump);
    window.addEventListener(GOALS_EVENT, bump);
    window.addEventListener(GIFTS_EVENT, bump);
    window.addEventListener(CIRCLES_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(SIGNATURE_EVENT, bump);
      window.removeEventListener(GOALS_EVENT, bump);
      window.removeEventListener(GIFTS_EVENT, bump);
      window.removeEventListener(CIRCLES_EVENT, bump);
    };
  }, []);

  const items: Item[] = useMemo(() => {
    void tick;
    const account = accounts[0] ?? null;
    if (!account) return [];

    const goals = loadGoals();
    const circles = loadCircles();
    const signatures = loadSignatures();
    const advance = loadAdvance();
    const gifts = loadGifts();

    const out: Item[] = [];

    // 1. Recently earned achievements (delta vs locked).
    const achievements = evaluateAchievements({
      account,
      operations,
      royalty: null,
      chess: null,
      ecosystem: null,
      goals,
      circles,
      signatures,
      advance,
      biometricEnrolled: biometric,
    });
    const earned = achievements.filter((a: Achievement) => a.earned);
    // Use a synthetic timestamp so newer (higher progress %) achievements
    // sort first within the achievement category.
    earned.slice(0, 12).forEach((a: Achievement, i: number) => {
      out.push({
        id: `ach-${a.id}`,
        kind: "achievement",
        ts: Date.now() - i * 60_000,
        iconBg: KIND_BG.achievement,
        icon: KIND_ICON.achievement,
        title: t("notifications.achievement.title", { label: t(a.labelKey) }),
        body: t(a.descriptionKey),
        href: "/bank#bank-anchor-achievements",
      });
    });

    // 2. Recent signatures (audit feed).
    const recentSigs = signatures.slice(0, 10);
    recentSigs.forEach((s: SignedOperation) => {
      const ts = Date.parse(s.signedAt);
      const amount =
        typeof s.payload?.amount === "number"
          ? formatCurrency(s.payload.amount, code)
          : undefined;
      out.push({
        id: `sig-${s.id}`,
        kind: "signature",
        ts: Number.isFinite(ts) ? ts : Date.now(),
        iconBg: KIND_BG.signature,
        icon: KIND_ICON.signature,
        title: t("notifications.signature.title", { kind: s.kind }),
        body: t("notifications.signature.body", { algo: s.algo, sig: s.signature.slice(0, 12) }),
        amountText: amount,
        href: "/bank#bank-anchor-audit",
      });
    });

    // 3. Anomalies on recent operations.
    const recentOps = operations.slice(0, 30);
    for (const op of recentOps) {
      const flags: Anomaly[] = detectAnomalies(op, recentOps, account.id);
      for (const f of flags) {
        const ts = Date.parse(op.createdAt);
        out.push({
          id: `anom-${op.id}-${f.kind}`,
          kind: "anomaly",
          ts: Number.isFinite(ts) ? ts : Date.now(),
          iconBg: KIND_BG.anomaly,
          icon: KIND_ICON.anomaly,
          title: t("notifications.anomaly.title", { label: t(ANOMALY_LABEL_KEY[f.kind]) }),
          body: f.messageKey ? t(f.messageKey, f.messageVars) : f.message,
          amountText: formatCurrency(op.amount, code),
          href: "/bank#bank-anchor-activity",
        });
      }
    }

    // 4. Pending or recently delivered gifts where I'm involved.
    for (const g of gifts.slice(0, 8)) {
      const ts = Date.parse(g.sentAt);
      const status = g.status ?? "sent";
      const titleKey =
        status === "pending"
          ? "notifications.gift.scheduled"
          : status === "cancelled"
            ? "notifications.gift.cancelled"
            : "notifications.gift.delivered";
      out.push({
        id: `gift-${g.id}`,
        kind: "gift",
        ts: Number.isFinite(ts) ? ts : Date.now(),
        iconBg: KIND_BG.gift,
        icon: KIND_ICON.gift,
        title: t(titleKey, { name: g.recipientNickname }),
        body: g.message ? g.message.slice(0, 80) : t("notifications.gift.noMessage"),
        amountText: formatCurrency(g.amount, code),
        href: `/bank/gift/${encodeURIComponent(g.id)}`,
      });
    }

    // 5. Goal completions.
    for (const g of goals) {
      if (!g.completedAt) continue;
      const ts = Date.parse(g.completedAt);
      out.push({
        id: `goal-${g.id}`,
        kind: "goal",
        ts: Number.isFinite(ts) ? ts : Date.now(),
        iconBg: KIND_BG.goal,
        icon: KIND_ICON.goal,
        title: t("notifications.goal.completed", { label: g.label }),
        body: t("notifications.goal.body", { saved: formatCurrency(g.currentAec, code) }),
        amountText: formatCurrency(g.targetAec, code),
        href: "/bank#bank-anchor-savings",
      });
    }

    out.sort((a, b) => b.ts - a.ts);
    return out.slice(0, 80);
  }, [accounts, operations, code, biometric, tick, t]);

  const stats = useMemo(() => {
    const account = accounts[0] ?? null;
    if (!account) return null;
    const goals = loadGoals();
    const circles = loadCircles();
    const signatures = loadSignatures();
    const advance = loadAdvance();
    const all = evaluateAchievements({
      account,
      operations,
      royalty: null,
      chess: null,
      ecosystem: null,
      goals,
      circles,
      signatures,
      advance,
      biometricEnrolled: biometric,
    });
    return achievementStats(all);
  }, [accounts, operations, biometric, tick]);

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 16px 56px",
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <Link
        href="/bank"
        style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}
      >
        ← {t("notifications.backToBank")}
      </Link>

      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          {t("notifications.title")}
        </h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {stats
            ? t("notifications.subtitle", { count: items.length, earned: stats.earned, total: stats.total })
            : t("notifications.subtitleEmpty")}
        </div>
      </header>

      {items.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(15,23,42,0.08)",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }} aria-hidden="true">⌬</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{t("notifications.empty.title")}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.55 }}>
            {t("notifications.empty.body")}
          </div>
        </div>
      ) : (
        <ol
          role="list"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {items.map((it) => (
            <li key={it.id}>
              <RowLink item={it} tLabel={kindLabel(it.kind, t)} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function kindLabel(kind: EventKind, t: (k: string) => string): string {
  switch (kind) {
    case "achievement":
      return t("notifications.kind.achievement");
    case "signature":
      return t("notifications.kind.signature");
    case "anomaly":
      return t("notifications.kind.anomaly");
    case "gift":
      return t("notifications.kind.gift");
    case "goal":
      return t("notifications.kind.goal");
  }
}

function RowLink({ item, tLabel }: { item: Item; tLabel: string }) {
  const inner = (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid rgba(15,23,42,0.08)",
        padding: 12,
        display: "grid",
        gridTemplateColumns: "36px 1fr auto",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: item.iconBg,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 16,
          boxShadow: "0 3px 8px rgba(15,23,42,0.10)",
        }}
      >
        {item.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            {tLabel}
          </span>
          <span style={{ fontSize: 9, color: "#cbd5e1" }}>·</span>
          <span style={{ fontSize: 9, color: "#94a3b8" }}>
            {new Date(item.ts).toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 1, lineHeight: 1.3, wordBreak: "break-word" }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4, wordBreak: "break-word" }}>
          {item.body}
        </div>
      </div>
      {item.amountText ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {item.amountText}
        </div>
      ) : null}
    </div>
  );

  if (!item.href) return inner;
  return (
    <Link href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}
