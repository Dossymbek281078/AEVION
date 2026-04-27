"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { listAccounts, listOperations } from "../_lib/api";
import { computeEcosystemTrustScore, type TrustTier } from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";

type Theme = "light" | "dark";

const TIERS: TrustTier[] = ["new", "growing", "trusted", "elite"];

export default function BadgeConfiguratorPage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [name, setName] = useState<string>("");
  const [scoreOverride, setScoreOverride] = useState<number | null>(null);
  const [tierOverride, setTierOverride] = useState<TrustTier | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [copied, setCopied] = useState<string | null>(null);

  // EcosystemDataContext lives inside /bank/page.tsx — not available here.
  // Compute a baseline score from balance + operations alone; the user can
  // always override via the slider.

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok — page works with defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const account = accounts[0] ?? null;

  const liveScore = useMemo(() => {
    if (!account) return null;
    try {
      const s = computeEcosystemTrustScore(
        { account, operations, royalty: null, chess: null, ecosystem: null },
        (k) => k,
      );
      // computeEcosystemTrustScore returns score on a 0-100 scale.
      return { score: s.score / 100, tier: s.tier };
    } catch {
      return null;
    }
  }, [account, operations]);

  const score = scoreOverride ?? liveScore?.score ?? 0;
  const tier = tierOverride ?? liveScore?.tier ?? "new";
  const displayName = name || account?.id || "demo-acc";
  const accountId = account?.id || "demo";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const badgeUrl = useMemo(() => {
    const u = new URL(`${origin}/bank/badge/${encodeURIComponent(accountId)}`);
    u.searchParams.set("score", score.toFixed(3));
    u.searchParams.set("tier", tier);
    if (name) u.searchParams.set("name", name);
    u.searchParams.set("theme", theme);
    return u.toString();
  }, [origin, accountId, score, tier, name, theme]);

  const htmlSnippet = `<a href="${origin}/bank">\n  <img src="${badgeUrl}" alt="AEVION Trust Badge" width="360" height="96" />\n</a>`;
  const mdSnippet = `[![AEVION Trust Badge](${badgeUrl})](${origin}/bank)`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // ignore
    }
  };

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
      <Link href="/bank" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}>
        ← {t("badge.backToBank")}
      </Link>

      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          {t("badge.title")}
        </h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {t("badge.subtitle")}
        </div>
      </header>

      <section
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,0.08)",
          padding: 18,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>
          {t("badge.previewLabel")}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            background: theme === "dark" ? "#0f172a" : "rgba(15,23,42,0.04)",
            borderRadius: 10,
            padding: 22,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgeUrl}
            alt="AEVION Trust Badge preview"
            width={360}
            height={96}
            style={{ display: "block" }}
          />
        </div>
      </section>

      <section
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,0.08)",
          padding: 18,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>
          {t("badge.controls")}
        </div>

        <Field label={t("badge.field.name")} hint={t("badge.field.nameHint")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 28))}
            placeholder={account?.id ?? "your-handle"}
            style={inputStyle}
          />
        </Field>

        <Field label={t("badge.field.score")} hint={t("badge.field.scoreHint", { live: ((liveScore?.score ?? 0) * 100).toFixed(0) })}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={score}
            onChange={(e) => setScoreOverride(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginTop: 4 }}>
            {(score * 100).toFixed(0)}%
          </div>
        </Field>

        <Field label={t("badge.field.tier")}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIERS.map((tt) => (
              <button
                key={tt}
                type="button"
                onClick={() => setTierOverride(tt)}
                aria-pressed={tt === tier}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: tt === tier ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.15)",
                  background: tt === tier ? "#0f172a" : "#fff",
                  color: tt === tier ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tt}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("badge.field.theme")}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["light", "dark"] as Theme[]).map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setTheme(th)}
                aria-pressed={th === theme}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: th === theme ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.15)",
                  background: th === theme ? "#0f172a" : "#fff",
                  color: th === theme ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {th}
              </button>
            ))}
          </div>
        </Field>
      </section>

      <Snippet
        label={t("badge.snippet.html")}
        text={htmlSnippet}
        copied={copied === "html"}
        onCopy={() => copy(htmlSnippet, "html")}
        copyLabel={t("badge.snippet.copy")}
        copiedLabel={t("badge.snippet.copied")}
      />
      <Snippet
        label={t("badge.snippet.md")}
        text={mdSnippet}
        copied={copied === "md"}
        onCopy={() => copy(mdSnippet, "md")}
        copyLabel={t("badge.snippet.copy")}
        copiedLabel={t("badge.snippet.copied")}
      />
      <Snippet
        label={t("badge.snippet.url")}
        text={badgeUrl}
        copied={copied === "url"}
        onCopy={() => copy(badgeUrl, "url")}
        copyLabel={t("badge.snippet.copy")}
        copiedLabel={t("badge.snippet.copied")}
      />

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 14, lineHeight: 1.55 }}>
        {t("badge.disclaimer")}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  fontFamily: "ui-monospace, monospace",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

function Snippet({
  label,
  text,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
          {label}
        </div>
        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: "5px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.15)",
            background: copied ? "#059669" : "#0f172a",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 8,
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {text}
      </pre>
    </section>
  );
}

