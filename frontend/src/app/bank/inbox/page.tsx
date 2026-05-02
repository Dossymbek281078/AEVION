"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { listAccounts, listOperations } from "../_lib/api";
import { loadAdvance } from "../_lib/advance";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import { loadGoals } from "../_lib/savings";
import { GIFTS_EVENT, loadGifts } from "../_lib/gifts";
import { loadRecurring } from "../_lib/recurring";
import { loadSplits, SPLITS_EVENT } from "../_lib/splits";
import type { Account, Operation } from "../_lib/types";

type Priority = "urgent" | "normal";

type InboxItem = {
  id: string;
  priority: Priority;
  iconBg: string;
  icon: string;
  title: string;
  hint: string;
  amountText?: string;
  ctaLabel: string;
  ctaHref: string;
};

const URGENT_BG = "linear-gradient(135deg, #dc2626, #f97316)";
const NORMAL_BG = "linear-gradient(135deg, #0ea5e9, #6366f1)";
const SUCCESS_BG = "linear-gradient(135deg, #10b981, #059669)";
const PURPLE_BG = "linear-gradient(135deg, #7c3aed, #c026d3)";

export default function BankInboxPage() {
  const { t } = useI18n();
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    setCode(loadCurrency());
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

  // Re-render when local state changes (gifts unlock, splits paid, etc.).
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("storage", bump);
    window.addEventListener(SPLITS_EVENT, bump);
    window.addEventListener(GIFTS_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(SPLITS_EVENT, bump);
      window.removeEventListener(GIFTS_EVENT, bump);
    };
  }, []);

  const account = accounts[0] ?? null;

  const items = useMemo(() => {
    if (!account) return [] as InboxItem[];
    void tick; // re-evaluate when storage changes
    const out: InboxItem[] = [];

    // 1. Splits where I'm the creator and someone hasn't paid yet.
    const splits = loadSplits();
    for (const bill of splits) {
      const unpaid = bill.shares.filter((s) => !s.paid && s.accountId !== account.id);
      if (unpaid.length === 0) continue;
      const owedTotal = unpaid.reduce((s, share) => s + share.amount, 0);
      out.push({
        id: `split-${bill.id}`,
        priority: "normal",
        iconBg: NORMAL_BG,
        icon: "⇆",
        title: t("inbox.split.title", { label: bill.label }),
        hint: t("inbox.split.hint", { n: unpaid.length, total: bill.shares.length }),
        amountText: formatCurrency(owedTotal, code),
        ctaLabel: t("inbox.split.cta"),
        ctaHref: "/bank#bank-anchor-splits",
      });
    }

    // 2. Outstanding salary advance.
    const adv = loadAdvance();
    if (adv && adv.outstanding > 0.001) {
      out.push({
        id: `advance-${adv.id}`,
        priority: adv.outstanding > adv.principal * 0.5 ? "urgent" : "normal",
        iconBg: URGENT_BG,
        icon: "₳",
        title: t("inbox.advance.title"),
        hint: t("inbox.advance.hint", {
          principal: formatCurrency(adv.principal, code),
        }),
        amountText: formatCurrency(adv.outstanding, code),
        ctaLabel: t("inbox.advance.cta"),
        ctaHref: "/bank#bank-anchor-advance",
      });
    }

    // 3. Recurring payments where the next run is in the past or due within 24h
    //    AND the wallet wouldn't cover it.
    const recurring = loadRecurring().filter((r) => r.active);
    const now = Date.now();
    const inactiveOverdue = recurring.filter((r) => {
      const next = Date.parse(r.nextRunAt);
      if (!Number.isFinite(next)) return false;
      return next <= now + 24 * 3600 * 1000;
    });
    const due = inactiveOverdue.reduce((s, r) => s + r.amount, 0);
    if (inactiveOverdue.length > 0 && due > account.balance) {
      out.push({
        id: "recurring-shortfall",
        priority: "urgent",
        iconBg: URGENT_BG,
        icon: "↻",
        title: t("inbox.recurring.title", { n: inactiveOverdue.length }),
        hint: t("inbox.recurring.hint", {
          balance: formatCurrency(account.balance, code),
          due: formatCurrency(due, code),
        }),
        ctaLabel: t("inbox.recurring.cta"),
        ctaHref: "/bank#bank-anchor-recurring",
      });
    }

    // 4. Goals approaching deadline (within 30 days, < 80% complete).
    const goals = loadGoals();
    for (const g of goals) {
      if (!g.deadlineISO || g.completedAt) continue;
      const deadline = Date.parse(g.deadlineISO);
      if (!Number.isFinite(deadline)) continue;
      const daysLeft = Math.floor((deadline - now) / 86_400_000);
      if (daysLeft < 0 || daysLeft > 30) continue;
      const pct = g.targetAec > 0 ? g.currentAec / g.targetAec : 0;
      if (pct >= 0.8) continue;
      out.push({
        id: `goal-${g.id}`,
        priority: daysLeft <= 7 ? "urgent" : "normal",
        iconBg: daysLeft <= 7 ? URGENT_BG : NORMAL_BG,
        icon: "✦",
        title: t("inbox.goal.title", { label: g.label }),
        hint: t("inbox.goal.hint", {
          days: daysLeft,
          pct: Math.round(pct * 100),
        }),
        amountText: `${formatCurrency(g.currentAec, code)} / ${formatCurrency(g.targetAec, code)}`,
        ctaLabel: t("inbox.goal.cta"),
        ctaHref: "/bank#bank-anchor-savings",
      });
    }

    // 5. Pending gifts to claim — recipient view (only seeable on this device
    //    if they were also the sender; placeholder for future backend pickup).
    const myGifts = loadGifts();
    const incomingPending = myGifts.filter(
      (g) =>
        g.recipientAccountId === account.id &&
        g.status === "pending" &&
        g.unlockAt &&
        Date.parse(g.unlockAt) <= now,
    );
    for (const g of incomingPending) {
      out.push({
        id: `gift-${g.id}`,
        priority: "normal",
        iconBg: PURPLE_BG,
        icon: "♥",
        title: t("inbox.gift.title", { from: g.recipientNickname }),
        hint: g.message ? g.message.slice(0, 60) : t("inbox.gift.noMessage"),
        amountText: formatCurrency(g.amount, code),
        ctaLabel: t("inbox.gift.cta"),
        ctaHref: `/bank/gift/${encodeURIComponent(g.id)}`,
      });
    }

    // 6. Gentle nudges if the account is otherwise empty: large positive
    //    balance with no goals → suggest setting one.
    if (goals.length === 0 && account.balance >= 200) {
      out.push({
        id: "nudge-goal",
        priority: "normal",
        iconBg: SUCCESS_BG,
        icon: "★",
        title: t("inbox.nudgeGoal.title"),
        hint: t("inbox.nudgeGoal.hint", {
          balance: formatCurrency(account.balance, code),
        }),
        ctaLabel: t("inbox.nudgeGoal.cta"),
        ctaHref: "/bank#bank-anchor-savings",
      });
    }

    // Sort: urgent first, then normal.
    out.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
      return 0;
    });

    return out;
  }, [account, code, tick, operations.length, t]);

  const urgentCount = items.filter((i) => i.priority === "urgent").length;

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 16px 48px",
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <Link
        href="/bank"
        style={{
          fontSize: 12,
          color: "#475569",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        ← {t("inbox.backToBank")}
      </Link>

      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          {t("inbox.title")}
        </h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          {items.length === 0
            ? t("inbox.subtitleEmpty")
            : urgentCount > 0
              ? t("inbox.subtitleUrgent", { n: urgentCount, total: items.length })
              : t("inbox.subtitle", { n: items.length })}
        </div>
      </header>

      <InstallBanner />

      {items.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <ul
          role="list"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {items.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <SubrouteFooter active="/bank/inbox" />
    </main>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  return (
    <li
      style={{
        background: "#fff",
        borderRadius: 14,
        border: item.priority === "urgent" ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(15,23,42,0.08)",
        padding: 14,
        display: "grid",
        gridTemplateColumns: "44px 1fr auto",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: item.iconBg,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 900,
          boxShadow: "0 4px 10px rgba(15,23,42,0.10)",
        }}
      >
        {item.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            marginTop: 4,
            lineHeight: 1.45,
            wordBreak: "break-word",
          }}
        >
          {item.hint}
        </div>
        {item.amountText ? (
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              marginTop: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.amountText}
          </div>
        ) : null}
      </div>
      <Link
        href={item.ctaHref}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          background: item.priority === "urgent" ? "#dc2626" : "#0f172a",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {item.ctaLabel}
      </Link>
    </li>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,0.08)",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: SUCCESS_BG,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 900,
          marginBottom: 14,
        }}
      >
        ✓
      </div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{t("inbox.empty.title")}</div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.55 }}>
        {t("inbox.empty.body")}
      </div>
      <Link
        href="/bank"
        style={{
          display: "inline-block",
          marginTop: 18,
          padding: "10px 18px",
          borderRadius: 10,
          background: "#0f172a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {t("inbox.empty.cta")}
      </Link>
    </div>
  );
}
