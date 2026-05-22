import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech — SDK Migration Guide",
  description: "Breaking changes per @aevion-io/fintech-sdk release. Currently one migration: v0.1.x → v0.2.x (modular API).",
  alternates: { canonical: "https://aevion.app/developers/fintech/migration" },
};

const C = { bg: "#050810", surface: "#0d1117", border: "#1e2a3a", text: "#e2e8f0", muted: "#64748b", code: "#0f1923", green: "#10b981", amber: "#f59e0b", red: "#ef4444", accent: "#6366f1" };

const GITHUB_CHANGELOG = "https://github.com/Dossymbek281078/AEVION/blob/main/packages/fintech-sdk/CHANGELOG.md";

function CodePre({ children }: { children: string }) {
  return (
    <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 8, padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.8rem", lineHeight: 1.55, color: "#a5f3fc", fontFamily: "ui-monospace, SFMono-Regular, monospace", margin: "0.75rem 0 0" }}>
      <code>{children}</code>
    </pre>
  );
}

export default function FintechMigrationPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>SDK Migration Guide</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          Breaking changes per <code>@aevion-io/fintech-sdk</code> release. The REST API surface itself hasn&apos;t shipped a deprecation yet — all migrations so far have been on the SDK client shape.
        </p>

        <div style={{ marginTop: 36, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.5rem 1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>v0.1.x → v0.2.x</h2>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: `${C.red}20`, color: "#fca5a5", textTransform: "uppercase" }}>
              Breaking
            </span>
            <span style={{ fontSize: "0.78rem", color: C.muted, marginLeft: "auto" }}>2026-05-13</span>
          </div>
          <p style={{ fontSize: "0.88rem", color: C.text, lineHeight: 1.6, margin: 0 }}>
            The legacy <code>AevionFintechClient</code> class and <code>createClient()</code> factory are removed.
            Migrate to the modular <code>FintechClient</code> — same six module shape (qgood, qmaskcard, veilnetxLedger, ztide, qchaingov, qpaynet), now lazily instantiated.
          </p>

          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: C.muted, marginTop: 20, marginBottom: 0 }}>Before (v0.1.x)</h3>
          <CodePre>{`import { createClient } from "@aevion-io/fintech-sdk";
const c = createClient({ baseUrl, token });`}</CodePre>

          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: C.muted, marginTop: 16, marginBottom: 0 }}>After (v0.2.x)</h3>
          <CodePre>{`import { FintechClient } from "@aevion-io/fintech-sdk";
const c = new FintechClient({ baseUrl }).withToken(token);`}</CodePre>

          <p style={{ fontSize: "0.82rem", color: C.muted, marginTop: 14, lineHeight: 1.6 }}>
            <strong style={{ color: C.amber }}>Renamed:</strong> <code>c.veilnetx</code> → <code>c.veilnetxLedger</code>.<br/>
            <strong style={{ color: C.green }}>New module:</strong> <code>c.qpaynet</code> (wallets, transfers, requests, merchant keys, webhook signing).
          </p>
        </div>

        <div style={{ marginTop: 28, padding: "1rem 1.25rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: "0.85rem", color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>No active deprecations on the REST API.</strong> All <code>/api/qpaynet/*</code>, <code>/api/qgood/*</code>, <code>/api/qmaskcard/*</code>, <code>/api/veilnetx-ledger/*</code>, <code>/api/ztide/*</code>, <code>/api/qchaingov/*</code> endpoints are stable. The <code>/api/payments/v1/*</code> surface (separate from fintech) is its own track — see its own changelog.
        </div>

        <div style={{ marginTop: 28, padding: "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: "0.82rem", color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>Related:</strong>{" "}
          <a href={GITHUB_CHANGELOG} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "none" }}>Full CHANGELOG.md ↗</a>
          {" · "}
          <Link href="/developers/fintech/changelog" style={{ color: C.accent, textDecoration: "none" }}>Changelog index →</Link>
          {" · "}
          <Link href="/developers/fintech/sdk" style={{ color: C.accent, textDecoration: "none" }}>SDK reference →</Link>
        </div>
      </div>
    </main>
  );
}
