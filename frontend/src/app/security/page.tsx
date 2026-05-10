import type { Metadata } from "next";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

export const metadata: Metadata = {
  title: "AEVION Security — how we protect data, authorship and payments",
  description:
    "Platform-wide security overview: Quantum Shield key management, Ed25519 signatures, post-quantum readiness, eIDAS / ESIGN / Berne compliance, audit trails and vulnerability disclosure.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "AEVION Security",
    description: "Quantum Shield · Ed25519 · audit trails · eIDAS/ESIGN compliance · post-quantum readiness.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Security", description: "Platform security overview." },
};

const LAYERS = [
  {
    n: "01",
    title: "Quantum Shield — cryptographic floor",
    accent: "#5eead4",
    body:
      "Master keys split via Shamir's Secret Sharing (k of n). Ed25519 signatures everywhere. Key derivation designed to remain credible after the post-quantum transition.",
    href: "/quantum-shield",
  },
  {
    n: "02",
    title: "Identity — single account, scoped permissions",
    accent: "#7dd3fc",
    body:
      "One AEVION account drives 27 modules. JWT bearer with short lifetime + refresh; passkey-ready stack. Private data is never exposed through the public Trust Graph.",
    href: "/auth",
  },
  {
    n: "03",
    title: "Authorship — provable, on-chain timestamps",
    accent: "#a78bfa",
    body:
      "QRight registers SHA-256 + HMAC + Quantum Shield hash before any third party can see the work. Proof can be presented offline; verification is open at /verify.",
    href: "/qright",
  },
  {
    n: "04",
    title: "Validators — public quorum, no opaque jury",
    accent: "#86efac",
    body:
      "Planet routes submissions to independent validators. Verdicts are co-signed and published on-chain — anyone can re-check the quorum without trusting AEVION.",
    href: "/planet",
  },
  {
    n: "05",
    title: "Audit — Merkle-tree trails, replayable",
    accent: "#fbbf24",
    body:
      "Every privileged action is appended to a Merkle-tree audit log. Receipts are exportable as Ed25519-signed PDFs and verifiable from any device, including offline.",
    href: "/bank/security",
  },
  {
    n: "06",
    title: "Disclosure — RFC 9116 security.txt",
    accent: "#f472b6",
    body:
      "Vulnerability reports and responsible disclosure are accepted at the standard /.well-known/security.txt contact. Acknowledgments live on the public changelog.",
    href: "/.well-known/security.txt",
  },
];

const COMPLIANCE = [
  { code: "eIDAS",        scope: "EU electronic signatures",       fit: "QSign signature framework + Bureau certificates" },
  { code: "ESIGN Act",    scope: "US e-signature law",             fit: "QSign signatures recognised across US jurisdictions" },
  { code: "Berne",        scope: "International copyright",        fit: "QRight authorship → recognised across 181 signatories" },
  { code: "WIPO + TRIPS", scope: "Global IP frameworks",           fit: "Bureau certificates cite both standards on issuance" },
  { code: "GDPR",         scope: "EU data protection",             fit: "Minimal data, right-to-erase, audit log on access" },
  { code: "KZ Digital Sig", scope: "Kazakhstan e-signature law",   fit: "Native first-class — QSign aligned from day 1" },
];

const FAQ = [
  {
    q: "Where is the data stored, and who can access it?",
    a: "Authorship and payment data live in encrypted PostgreSQL with row-level access control. Master keys never leave Quantum Shield (k-of-n shards across independent stores). No employee has unilateral access — all privileged actions are logged to a Merkle-tree audit trail.",
  },
  {
    q: "What happens if a private key is compromised?",
    a: "Quantum Shield key recovery: rotate the affected shards (any K of N is enough to reconstruct), revoke the compromised public key in QSign, re-sign the affected receipts, broadcast revocation through the Planet validator network. Authorship timestamps remain valid because they're separate from the user signing key.",
  },
  {
    q: "Are you ready for post-quantum?",
    a: "The signature stack today is Ed25519, the same as Signal, GitHub and most major secure platforms. Quantum Shield's KDF is post-quantum-ready — key derivation can swap to a PQ-safe primitive (e.g. ML-KEM) without re-issuing existing receipts. Dilithium preview is already in the QSign repository.",
  },
  {
    q: "How do you handle vulnerability reports?",
    a: "Send to yahiin1978@gmail.com with subject 'AEVION security' or use the /.well-known/security.txt contact. Acknowledgment within 24 hours, fix coordination per CVD norms, public credit on /changelog once mitigated.",
  },
  {
    q: "Do you publish a SOC 2 / ISO 27001 report?",
    a: "Not yet — at MVP scale we ship the controls before paying for the audit. The control map (encryption at rest, least-privilege access, audit trails, incident response) is implemented and documented for under-NDA review.",
  },
];

export default function SecurityPage() {
  return (
    <main style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 200px)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
        <Wave1Nav />

        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", color: "#0d9488", margin: "0 0 8px", textTransform: "uppercase" }}>
            Platform security
          </p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", margin: "0 0 12px", color: "#0f172a" }}>
            Trust by construction.
          </h1>
          <p style={{ fontSize: 15, color: "#475569", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Six independent layers between user data and any attacker — cryptographic floor, identity scope,
            provable authorship, validator quorum, replayable audit, public disclosure. None of them
            is &quot;trust us&quot;; each is verifiable from outside AEVION.
          </p>
        </div>

        <section style={{ marginTop: 28, display: "grid", gap: 12 }}>
          {LAYERS.map((l) => (
            <Link
              key={l.n}
              href={l.href}
              style={{
                padding: 22,
                borderRadius: 14,
                background: "#fff",
                border: `1px solid ${l.accent}33`,
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: `${l.accent}1A`,
                  border: `1px solid ${l.accent}55`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 16,
                  fontWeight: 900,
                  color: l.accent,
                }}
              >
                {l.n}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>{l.title}</div>
                <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{l.body}</div>
              </div>
            </Link>
          ))}
        </section>

        <section
          style={{
            marginTop: 24,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Compliance map</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px", lineHeight: 1.6 }}>
            We ride the standards bodies, not predict them. Each module is wired to an existing legal framework.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {COMPLIANCE.map((c) => (
              <div
                key={c.code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(140px, 180px) minmax(160px, 220px) 1fr",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(15,23,42,0.03)",
                  border: "1px solid rgba(15,23,42,0.05)",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontWeight: 800, color: "#0d9488" }}>{c.code}</div>
                <div style={{ color: "#475569" }}>{c.scope}</div>
                <div style={{ color: "#0f172a" }}>{c.fit}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Frequently asked questions</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {FAQ.map((f, i) => (
              <details
                key={i}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "rgba(15,23,42,0.02)",
                }}
              >
                <summary style={{ fontWeight: 700, color: "#0f172a", cursor: "pointer", fontSize: 14 }}>{f.q}</summary>
                <div style={{ marginTop: 8, fontSize: 14, color: "#475569", lineHeight: 1.65 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>Reach the security team</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.95 }}>
            <div>
              <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20security" style={{ color: "#fff", fontWeight: 800 }}>
                yahiin1978@gmail.com
              </a>
              {" "}— subject &quot;AEVION security&quot;, ack within 24h.
            </div>
            <div style={{ marginTop: 6 }}>
              Disclosure file:{" "}
              <a href="/.well-known/security.txt" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
                /.well-known/security.txt
              </a>
              {" "}· Vulnerability acknowledgments:{" "}
              <Link href="/changelog" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
                /changelog
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
