"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearDemoSeed, hasDemoSeed, seedDemo } from "../_lib/demoSeed";
import { useCurrency } from "../_lib/CurrencyContext";
import { CURRENCIES, type CurrencyCode } from "../_lib/currency";
import { resetTour } from "../_lib/onboarding";
import { useI18n } from "@/lib/i18n";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type PaletteAction = {
  id: string;
  section: string;
  label: string;
  hint?: string;
  icon: string;
  keywords?: string[];
  run: () => void | Promise<void>;
};

function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) {
    // Anchor not on current page (e.g. user is on /bank/insights). Bounce to /bank
    // with a hash so the browser scrolls to the section after navigation.
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("/bank")) {
      window.location.href = `/bank#${id}`;
    }
    return;
  }
  const prm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  el.scrollIntoView({ behavior: prm ? "auto" : "smooth", block: "start" });
  if (prm) return;
  // Brief highlight flash so the user sees where they landed.
  const target = el as HTMLElement;
  const prevShadow = target.style.boxShadow;
  const prevTransition = target.style.transition;
  const prevRadius = target.style.borderRadius;
  target.style.transition = "box-shadow 320ms ease";
  target.style.borderRadius = prevRadius || "12px";
  target.style.boxShadow = "0 0 0 4px rgba(14,165,233,0.35), 0 0 0 1px rgba(14,165,233,0.8)";
  window.setTimeout(() => {
    target.style.boxShadow = prevShadow;
    window.setTimeout(() => {
      target.style.transition = prevTransition;
      target.style.borderRadius = prevRadius;
    }, 380);
  }, 700);
}

export function CommandPalette({
  accountId,
  hasWallet,
  notify,
}: {
  accountId: string | null;
  hasWallet: boolean;
  notify: Notify;
}) {
  const { t } = useI18n();
  const { code, setCode } = useCurrency();
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const [demoActive, setDemoActive] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isToggle) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    setDemoActive(hasDemoSeed());
    // focus after render
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const switchCurrency = useCallback(
    (c: CurrencyCode) => {
      setCode(c);
      notify(t("palette.toast.currency", { c }), "info");
    },
    [setCode, notify, t],
  );

  const relaunchTour = useCallback(() => {
    resetTour();
    const url = new URL(window.location.href);
    url.searchParams.set("tour", "1");
    window.location.replace(url.toString());
  }, []);

  const toggleDemo = useCallback(() => {
    if (!accountId) return;
    if (hasDemoSeed()) {
      clearDemoSeed();
      notify(t("palette.toast.demo.cleared"), "info");
    } else {
      seedDemo(accountId);
      notify(t("palette.toast.demo.loaded"), "success");
    }
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("aevion:signatures-changed"));
  }, [accountId, notify, t]);

  const actions = useMemo<PaletteAction[]>(() => {
    const a: PaletteAction[] = [];
    const navSection = t("palette.section.navigate");
    const currencySection = t("palette.section.currency");
    const actionsSection = t("palette.section.actions");

    if (hasWallet) {
      a.push(
        { id: "nav.wallet", section: navSection, icon: "◎", label: t("palette.nav.wallet.label"), hint: t("palette.nav.wallet.hint"), keywords: ["balance", "summary", "top"], run: () => scrollToId("bank-anchor-wallet") },
        { id: "nav.constellation", section: navSection, icon: "✧", label: t("palette.nav.constellation.label"), hint: t("palette.nav.constellation.hint"), keywords: ["map", "streams", "graph", "visual"], run: () => scrollToId("bank-anchor-constellation") },
        { id: "nav.ecosystem", section: navSection, icon: "✦", label: t("palette.nav.ecosystem.label"), hint: t("palette.nav.ecosystem.hint"), keywords: ["pulse", "peers", "activity"], run: () => scrollToId("bank-anchor-ecosystem") },
        { id: "nav.flow", section: navSection, icon: "🌊", label: t("palette.nav.flow.label"), hint: t("palette.nav.flow.hint"), keywords: ["money", "flow", "sankey", "visual"], run: () => scrollToId("bank-anchor-flow") },
        { id: "nav.networth", section: navSection, icon: "📈", label: t("palette.nav.networth.label"), hint: t("palette.nav.networth.hint"), keywords: ["net", "worth", "wealth", "stack"], run: () => scrollToId("bank-anchor-networth") },
        { id: "nav.brief", section: navSection, icon: "📰", label: t("palette.nav.brief.label"), hint: t("palette.nav.brief.hint"), keywords: ["weekly", "brief", "summary", "ai"], run: () => scrollToId("bank-anchor-brief") },
        { id: "nav.timetravel", section: navSection, icon: "⏪", label: t("palette.nav.timetravel.label"), hint: t("palette.nav.timetravel.hint"), keywords: ["history", "past", "month", "compare"], run: () => scrollToId("bank-anchor-timetravel") },
        { id: "nav.heatmap", section: navSection, icon: "🔥", label: t("palette.nav.heatmap.label"), hint: t("palette.nav.heatmap.hint"), keywords: ["activity", "heat", "calendar"], run: () => scrollToId("bank-anchor-heatmap") },
        { id: "nav.forecast", section: navSection, icon: "⇗", label: t("palette.nav.forecast.label"), hint: t("palette.nav.forecast.hint"), keywords: ["projection", "future", "scenarios"], run: () => scrollToId("bank-anchor-forecast") },
        { id: "nav.cooldown", section: navSection, icon: "⏳", label: t("palette.nav.cooldown.label"), hint: t("palette.nav.cooldown.hint"), keywords: ["impulse", "hold", "wait", "queue"], run: () => scrollToId("bank-anchor-cooldown") },
        { id: "nav.trip", section: navSection, icon: "✈", label: t("palette.nav.trip.label"), hint: t("palette.nav.trip.hint"), keywords: ["travel", "trip", "vacation", "abroad"], run: () => scrollToId("bank-anchor-trip") },
        { id: "nav.recurring", section: navSection, icon: "↻", label: t("palette.nav.recurring.label"), hint: t("palette.nav.recurring.hint"), keywords: ["recurring", "subscription", "auto"], run: () => scrollToId("bank-anchor-recurring") },
        { id: "nav.budget", section: navSection, icon: "▣", label: t("palette.nav.budget.label"), hint: t("palette.nav.budget.hint"), keywords: ["budget", "cap", "limit", "category", "monthly"], run: () => scrollToId("bank-anchor-budget") },
        { id: "nav.calendar", section: navSection, icon: "▦", label: t("palette.nav.calendar.label"), hint: t("palette.nav.calendar.hint"), keywords: ["calendar", "billing", "schedule", "month"], run: () => scrollToId("bank-anchor-calendar") },
        { id: "nav.subscriptions", section: navSection, icon: "⚠", label: t("palette.nav.subscriptions.label"), hint: t("palette.nav.subscriptions.hint"), keywords: ["subs", "subscription", "scanner", "leak", "stale", "duplicate", "expensive"], run: () => scrollToId("bank-anchor-subscriptions") },
        { id: "nav.trust", section: navSection, icon: "✓", label: t("palette.nav.trust.label"), hint: t("palette.nav.trust.hint"), keywords: ["tier", "score", "ranking"], run: () => scrollToId("bank-anchor-trust") },
        { id: "nav.tiers", section: navSection, icon: "◆", label: t("palette.nav.tiers.label"), hint: t("palette.nav.tiers.hint"), keywords: ["tier", "unlock", "perks", "benefits"], run: () => scrollToId("bank-anchor-tiers") },
        { id: "nav.statement", section: navSection, icon: "⚡", label: t("palette.nav.statement.label"), hint: t("palette.nav.statement.hint"), keywords: ["statement", "report", "autopilot", "proof"], run: () => scrollToId("bank-anchor-statement") },
        { id: "nav.achievements", section: navSection, icon: "★", label: t("palette.nav.achievements.label"), hint: t("palette.nav.achievements.hint"), keywords: ["badges", "unlock", "goals"], run: () => scrollToId("bank-anchor-achievements") },
        { id: "nav.challenges", section: navSection, icon: "🏁", label: t("palette.nav.challenges.label"), hint: t("palette.nav.challenges.hint"), keywords: ["challenges", "no-spend", "streak"], run: () => scrollToId("bank-anchor-challenges") },
        { id: "nav.vault", section: navSection, icon: "🏦", label: t("palette.nav.vault.label"), hint: t("palette.nav.vault.hint"), keywords: ["vault", "term", "lock", "savings"], run: () => scrollToId("bank-anchor-vault") },
        { id: "nav.loyalty", section: navSection, icon: "🎫", label: t("palette.nav.loyalty.label"), hint: t("palette.nav.loyalty.hint"), keywords: ["loyalty", "points", "miles", "rewards"], run: () => scrollToId("bank-anchor-loyalty") },
        { id: "nav.wishlist", section: navSection, icon: "🎁", label: t("palette.nav.wishlist.label"), hint: t("palette.nav.wishlist.hint"), keywords: ["wishlist", "wants", "save", "buy"], run: () => scrollToId("bank-anchor-wishlist") },
        { id: "nav.referrals", section: navSection, icon: "➤", label: t("palette.nav.referrals.label"), hint: t("palette.nav.referrals.hint"), keywords: ["referral", "invite", "earn"], run: () => scrollToId("referrals-heading") },
        { id: "nav.vcards", section: navSection, icon: "💳", label: t("palette.nav.vcards.label"), hint: t("palette.nav.vcards.hint"), keywords: ["cards", "virtual", "freeze", "limit"], run: () => scrollToId("bank-anchor-vcards") },
        { id: "nav.snapshot", section: navSection, icon: "↓", label: t("palette.nav.snapshot.label"), hint: t("palette.nav.snapshot.hint"), keywords: ["export", "download", "share"], run: () => scrollToId("snapshot-heading") },
        { id: "nav.audit", section: navSection, icon: "✎", label: t("palette.nav.audit.label"), hint: t("palette.nav.audit.hint"), keywords: ["qsign", "signatures", "verify"], run: () => scrollToId("audit-heading") },
        { id: "nav.audit-unified", section: navSection, icon: "☰", label: t("palette.nav.auditUnified.label"), hint: t("palette.nav.auditUnified.hint"), keywords: ["unified", "timeline", "audit", "export"], run: () => scrollToId("bank-anchor-audit-unified") },
      );
    }

    for (const c of CURRENCIES) {
      a.push({
        id: `currency.${c}`,
        section: currencySection,
        icon: c === code ? "●" : "○",
        label: c === code ? t("palette.currency.label.current", { c }) : t("palette.currency.label", { c }),
        hint: c === "AEC" ? t("palette.currency.hint.native") : t("palette.currency.hint.switch", { c }),
        keywords: ["switch", "convert", c.toLowerCase()],
        run: () => switchCurrency(c),
      });
    }

    if (hasWallet) {
      a.push(
        { id: "action.tour", section: actionsSection, icon: "↻", label: t("palette.action.tour.label"), hint: t("palette.action.tour.hint"), keywords: ["onboarding", "guide", "help"], run: relaunchTour },
        { id: "action.demo", section: actionsSection, icon: demoActive ? "✗" : "⟡", label: demoActive ? t("palette.action.demo.clear.label") : t("palette.action.demo.load.label"), hint: demoActive ? t("palette.action.demo.clear.hint") : t("palette.action.demo.load.hint"), keywords: ["seed", "mock", "sample"], run: toggleDemo },
      );
    }

    a.push({
      id: "nav.portal",
      section: navSection,
      icon: "↗",
      label: t("palette.nav.portal.label"),
      hint: t("palette.nav.portal.hint"),
      keywords: ["home", "root", "exit"],
      run: () => {
        window.location.href = "/";
      },
    });

    return a;
  }, [hasWallet, code, demoActive, switchCurrency, relaunchTour, toggleDemo, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => {
      const hay = [a.label, a.hint || "", a.section, ...(a.keywords || [])].join(" ").toLowerCase();
      return q.split(/\s+/).every((part) => hay.includes(part));
    });
  }, [actions, query]);

  const executeAt = useCallback(
    (i: number) => {
      const a = filtered[i];
      if (!a) return;
      setOpen(false);
      try {
        const res = a.run();
        if (res && typeof (res as Promise<void>).then === "function") {
          (res as Promise<void>).catch(() => void 0);
        }
      } catch {
        // surfaced via notify in callers
      }
    },
    [filtered],
  );

  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-palette-row="${index}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [index, open]);

  const onInputKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeAt(index);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [filtered.length, index, executeAt],
  );

  if (!open) return null;

  // Group rows by section, preserving filtered order.
  const grouped: Array<{ section: string; rows: Array<{ action: PaletteAction; absoluteIndex: number }> }> = [];
  filtered.forEach((action, i) => {
    const last = grouped[grouped.length - 1];
    if (last && last.section === action.section) {
      last.rows.push({ action, absoluteIndex: i });
    } else {
      grouped.push({ section: action.section, rows: [{ action, absoluteIndex: i }] });
    }
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("palette.aria.dialog")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 32px 64px rgba(15,23,42,0.28), 0 0 0 1px rgba(15,23,42,0.06)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "68vh",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(15,23,42,0.06)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "linear-gradient(135deg,#0d9488,#0ea5e9)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            ⌘K
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={t("palette.search.placeholder")}
            aria-label={t("palette.aria.search")}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              fontWeight: 600,
              color: "#0f172a",
              background: "transparent",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "#64748b",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {filtered.length === 1 ? t("palette.count.one", { n: filtered.length }) : t("palette.count.many", { n: filtered.length })}
          </span>
        </div>

        <ul
          ref={listRef}
          role="listbox"
          aria-label={t("palette.aria.list")}
          style={{
            listStyle: "none",
            padding: 6,
            margin: 0,
            overflowY: "auto",
            flex: 1,
          }}
        >
          {filtered.length === 0 ? (
            <li
              style={{
                padding: "24px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "#64748b",
              }}
            >
              {t("palette.empty", { q: query })}
            </li>
          ) : (
            grouped.map((group) => (
              <li key={group.section} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    padding: "6px 12px 2px",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  {group.section}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {group.rows.map(({ action, absoluteIndex }) => {
                    const active = absoluteIndex === index;
                    return (
                      <li
                        key={action.id}
                        data-palette-row={absoluteIndex}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setIndex(absoluteIndex)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          executeAt(absoluteIndex);
                        }}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "28px 1fr auto",
                          gap: 12,
                          alignItems: "center",
                          padding: "10px 12px",
                          borderRadius: 10,
                          cursor: "pointer",
                          background: active ? "rgba(14,165,233,0.08)" : "transparent",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: active ? "linear-gradient(135deg,#0d9488,#0ea5e9)" : "rgba(15,23,42,0.05)",
                            color: active ? "#fff" : "#334155",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            fontSize: 13,
                            transition: "background 160ms ease",
                          }}
                        >
                          {action.icon}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {action.label}
                          </div>
                          {action.hint ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                                marginTop: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {action.hint}
                            </div>
                          ) : null}
                        </div>
                        {active ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#0369a1",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}
                          >
                            ⏎ {t("palette.row.run")}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>

        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "flex-end",
            padding: "8px 14px",
            borderTop: "1px solid rgba(15,23,42,0.06)",
            background: "rgba(15,23,42,0.02)",
            fontSize: 10,
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          <span>
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>↑</kbd>
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>↓</kbd> {t("palette.kbd.navigate")}
          </span>
          <span>
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>⏎</kbd> {t("palette.kbd.run")}
          </span>
          <span>
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>esc</kbd> {t("palette.kbd.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
