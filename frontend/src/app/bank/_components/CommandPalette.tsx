"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearDemoSeed, hasDemoSeed, seedDemo } from "../_lib/demoSeed";
import { useCurrency } from "../_lib/CurrencyContext";
import { CURRENCIES, type CurrencyCode } from "../_lib/currency";
import { resetTour } from "../_lib/onboarding";

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
  if (!el) return;
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
      notify(`Currency: ${c}`, "info");
    },
    [setCode, notify],
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
      notify("Demo data cleared", "info");
    } else {
      seedDemo(accountId);
      notify("Demo data loaded", "success");
    }
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("aevion:signatures-changed"));
  }, [accountId, notify]);

  const actions = useMemo<PaletteAction[]>(() => {
    const a: PaletteAction[] = [];

    if (hasWallet) {
      a.push(
        { id: "nav.wallet", section: "Navigate", icon: "◎", label: "Jump to Wallet", hint: "Balance & coin tower", keywords: ["balance", "summary", "top"], run: () => scrollToId("bank-anchor-wallet") },
        { id: "nav.constellation", section: "Navigate", icon: "✧", label: "Jump to Wealth Constellation", hint: "Live money-flow map", keywords: ["map", "streams", "graph", "visual"], run: () => scrollToId("bank-anchor-constellation") },
        { id: "nav.ecosystem", section: "Navigate", icon: "✦", label: "Jump to Ecosystem Pulse", hint: "Live peer activity", keywords: ["pulse", "peers", "activity"], run: () => scrollToId("bank-anchor-ecosystem") },
        { id: "nav.forecast", section: "Navigate", icon: "⇗", label: "Jump to Wealth Forecast", hint: "3 scenarios · 3 horizons", keywords: ["projection", "future", "scenarios"], run: () => scrollToId("bank-anchor-forecast") },
        { id: "nav.trust", section: "Navigate", icon: "✓", label: "Jump to Trust Score", hint: "Tier progress · next-tier steps", keywords: ["tier", "score", "ranking"], run: () => scrollToId("bank-anchor-trust") },
        { id: "nav.tiers", section: "Navigate", icon: "◆", label: "Jump to Tier Unlocks", hint: "What you get at Growing / Trusted / Elite", keywords: ["tier", "unlock", "perks", "benefits"], run: () => scrollToId("bank-anchor-tiers") },
        { id: "nav.achievements", section: "Navigate", icon: "★", label: "Jump to Achievements", hint: "18 badges across 4 tracks", keywords: ["badges", "unlock", "goals"], run: () => scrollToId("bank-anchor-achievements") },
        { id: "nav.referrals", section: "Navigate", icon: "➤", label: "Jump to Invite & Earn", hint: "Referral program", keywords: ["referral", "invite", "earn"], run: () => scrollToId("referrals-heading") },
        { id: "nav.snapshot", section: "Navigate", icon: "↓", label: "Jump to Snapshot", hint: "Export SVG / text summary", keywords: ["export", "download", "share"], run: () => scrollToId("snapshot-heading") },
        { id: "nav.audit", section: "Navigate", icon: "✎", label: "Jump to Audit Log", hint: "QSign signatures · export JSON", keywords: ["qsign", "signatures", "verify"], run: () => scrollToId("audit-heading") },
        { id: "nav.audit-unified", section: "Navigate", icon: "☰", label: "Jump to Unified Audit Timeline", hint: "All 4 sources in one feed + export", keywords: ["unified", "timeline", "audit", "export"], run: () => scrollToId("unified-audit-heading") },
      );
    }

    for (const c of CURRENCIES) {
      a.push({
        id: `currency.${c}`,
        section: "Currency",
        icon: c === code ? "●" : "○",
        label: `Currency: ${c}${c === code ? " (current)" : ""}`,
        hint: c === "AEC" ? "Native token" : `Switch display to ${c}`,
        keywords: ["switch", "convert", c.toLowerCase()],
        run: () => switchCurrency(c),
      });
    }

    if (hasWallet) {
      a.push(
        { id: "action.tour", section: "Actions", icon: "↻", label: "Take the tour", hint: "5-step walk-through", keywords: ["onboarding", "guide", "help"], run: relaunchTour },
        { id: "action.demo", section: "Actions", icon: demoActive ? "✗" : "⟡", label: demoActive ? "Clear demo data" : "Load demo data", hint: demoActive ? "Remove seed from storage" : "Goals · recurring · circle · split · gifts", keywords: ["seed", "mock", "sample"], run: toggleDemo },
      );
    }

    a.push({
      id: "nav.portal",
      section: "Navigate",
      icon: "↗",
      label: "Back to AEVION portal",
      hint: "Main site",
      keywords: ["home", "root", "exit"],
      run: () => {
        window.location.href = "/";
      },
    });

    return a;
  }, [hasWallet, code, demoActive, switchCurrency, relaunchTour, toggleDemo]);

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
      aria-label="Command palette"
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
            placeholder="Search — jump, switch currency, run tour…"
            aria-label="Search actions"
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
              color: "#94a3b8",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {filtered.length} action{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <ul
          ref={listRef}
          role="listbox"
          aria-label="Actions"
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
                color: "#94a3b8",
              }}
            >
              No matches for “{query}”
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
                            ⏎ run
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
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>↓</kbd> navigate
          </span>
          <span>
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>⏎</kbd> run
          </span>
          <span>
            <kbd style={{ fontFamily: "ui-monospace, monospace" }}>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
