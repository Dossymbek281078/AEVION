"use client";

// Personal preferences home for /bank — until now every preference was
// adjusted from a different surface (locale from the navbar dropdown,
// currency from the wallet panel, signature retention nowhere). This
// page consolidates them and adds a danger-zone for clearing local
// state when something gets stuck.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n, type Lang, LANGS, LANG_FULL } from "@/lib/i18n";
import { CURRENCIES, loadCurrency, saveCurrency, type CurrencyCode } from "../_lib/currency";
import { loadSignatures } from "../_lib/signatures";

const STORAGE_KEYS = {
  token: "aevion_auth_token_v1",
  signatures: "aevion_bank_signatures_v1",
  quickdemo: "aevion_bank_quickdemo_v1",
  testmodeDismissed: "aevion_bank_testmode_dismissed_v1",
} as const;

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore quota / privacy modes
  }
}

export default function BankSettingsPage() {
  const { lang, setLang } = useI18n();
  const [currency, setCurrency] = useState<CurrencyCode>("AEC");
  const [sigCount, setSigCount] = useState<number>(0);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [hasQuickdemo, setHasQuickdemo] = useState<boolean>(false);
  const [hasTestmodeDismiss, setHasTestmodeDismiss] = useState<boolean>(false);
  const [sentryDsn, setSentryDsn] = useState<string>("");
  const [sentryLoaded, setSentryLoaded] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setCurrency(loadCurrency());
    setSigCount(loadSignatures().length);
    setHasToken(!!readKey(STORAGE_KEYS.token));
    setHasQuickdemo(!!readKey(STORAGE_KEYS.quickdemo));
    setHasTestmodeDismiss(!!readKey(STORAGE_KEYS.testmodeDismissed));
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
    setSentryDsn(dsn);
    setSentryLoaded(typeof window !== "undefined" && !!(window as unknown as { Sentry?: unknown }).Sentry);
  }, [refreshTick]);

  const refresh = () => setRefreshTick((t) => t + 1);

  const onClearSignatures = () => {
    if (!confirm("Clear local signature audit log? This wipes every QSign envelope stored on this device. Server-side ledger is untouched.")) {
      return;
    }
    writeKey(STORAGE_KEYS.signatures, null);
    window.dispatchEvent(new Event("aevion:signatures-changed"));
    refresh();
  };
  const onClearDemoFlags = () => {
    writeKey(STORAGE_KEYS.quickdemo, null);
    writeKey(STORAGE_KEYS.testmodeDismissed, null);
    refresh();
  };
  const onSignOut = () => {
    if (!confirm("Sign out? Local signatures and preferences stay; only the auth token is cleared.")) return;
    writeKey(STORAGE_KEYS.token, null);
    refresh();
    // Hard nav to /auth so all in-memory state is dropped.
    window.location.href = "/auth?next=/bank";
  };
  const onCurrencyChange = (c: CurrencyCode) => {
    setCurrency(c);
    saveCurrency(c);
    // CurrencyContext listens to storage events, so other tabs catch up.
    window.dispatchEvent(new StorageEvent("storage", { key: "aevion_bank_currency_v1", newValue: c }));
  };

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 16px 56px",
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <Link href="/bank" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}>
        ← Back to AEVION Bank
      </Link>
      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>Settings</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.55, margin: 0 }}>
          Personal preferences and local-state controls. Server-side data is never touched from this page.
        </p>
      </header>

      <Card title="Locale" subtitle="Affects every /bank/* surface; changes take effect immediately.">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          style={selectStyle}
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_FULL[l]}
            </option>
          ))}
        </select>
      </Card>

      <Card title="Display currency" subtitle="Wallet amounts shown in this currency. Backend always settles in AEC.">
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
          style={selectStyle}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Card>

      <Card title="Signature audit log" subtitle="QSign envelopes stored on this device for offline verification.">
        <Kv k="Signed envelopes" v={String(sigCount)} />
        <button type="button" onClick={onClearSignatures} style={dangerBtn} disabled={sigCount === 0}>
          Clear local signature log
        </button>
        <p style={hint}>
          Server-side ledger survives this clear. Past receipts can still verify against /api/qsign/verify.
        </p>
      </Card>

      <Card title="Demo flags" subtitle="Cached UI dismissals + auto-run hints set by the investor walk-through.">
        <Kv k="Quickdemo cookie" v={hasQuickdemo ? "set" : "—"} />
        <Kv k="Test-mode banner dismissed" v={hasTestmodeDismiss ? "yes" : "no"} />
        <button type="button" onClick={onClearDemoFlags} style={secondaryBtn}>
          Reset demo flags
        </button>
      </Card>

      <Card title="Observability" subtitle="Frontend Sentry. CDN-loaded; no SDK in the bundle.">
        <Kv k="DSN configured" v={sentryDsn ? "yes" : "no"} color={sentryDsn ? "#16a34a" : "#94a3b8"} />
        <Kv k="SDK loaded" v={sentryLoaded ? "yes" : "no"} color={sentryLoaded ? "#16a34a" : "#94a3b8"} />
        <p style={hint}>
          Set <code style={code}>NEXT_PUBLIC_SENTRY_DSN</code> at build time to enable. The hook also captures
          window.onerror + unhandledrejection.
        </p>
      </Card>

      <Card title="Session" subtitle="Auth token storage.">
        <Kv k="Token present" v={hasToken ? "yes" : "no"} color={hasToken ? "#16a34a" : "#94a3b8"} />
        <button type="button" onClick={onSignOut} style={dangerBtn} disabled={!hasToken}>
          Sign out
        </button>
      </Card>

      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 24, lineHeight: 1.6 }}>
        Hidden from search: robots noindex,nofollow. Use this page to re-set local state if anything looks
        stuck — nothing here mutates server data.
      </p>
    </main>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, marginBottom: 10 }}>{subtitle}</div> : <div style={{ marginBottom: 8 }} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

function Kv({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, fontSize: 13 }}>
      <div style={{ color: "#64748b", fontWeight: 600 }}>{k}</div>
      <div style={{ color: color || "#0f172a", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{v}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.18)",
  fontSize: 13,
  fontWeight: 700,
  background: "#fff",
  color: "#0f172a",
  width: 200,
};

const dangerBtn: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(220,38,38,0.30)",
  background: "rgba(220,38,38,0.05)",
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const hint: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  margin: "4px 0 0",
  lineHeight: 1.5,
};

const code: React.CSSProperties = {
  background: "rgba(15,23,42,0.05)",
  padding: "1px 6px",
  borderRadius: 4,
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
};
