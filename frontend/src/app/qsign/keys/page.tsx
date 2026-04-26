"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type KeyRow = {
  kid: string;
  algo: "HMAC-SHA256" | "Ed25519";
  status: "active" | "retired" | string;
  publicKey: string | null;
  createdAt: string;
  retiredAt: string | null;
  notes: string | null;
};

type KeysResponse = {
  algoVersion: string;
  canonicalization: string;
  active: { hmac: string | null; ed25519: string | null };
  keys: KeyRow[];
  total: number;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const mono: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#334155",
};
const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

export default function QSignKeysPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<KeysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/qsign/v2/keys"), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: KeysResponse = await res.json();
      setData(d);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (txt: string, what: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      showToast(`${what} copied`, "success");
    } catch {
      showToast("Copy failed", "error");
    }
  };

  const byAlgo = useMemo(() => {
    const out: Record<string, KeyRow[]> = { "HMAC-SHA256": [], Ed25519: [] };
    for (const k of data?.keys || []) {
      if (!out[k.algo]) out[k.algo] = [];
      out[k.algo].push(k);
    }
    for (const algo of Object.keys(out)) {
      out[algo].sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }
    return out;
  }, [data]);

  return (
    <main>
      <ProductPageShell maxWidth={1080}>
        <Wave1Nav />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <Link
            href="/qsign"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#475569",
              textDecoration: "none",
            }}
          >
            ← QSign Studio
          </Link>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              color: loading ? "#94a3b8" : "#0f172a",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Hero */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 22 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              padding: "26px 26px 22px",
              color: "#fff",
            }}
          >
            <h1
              style={{
                fontSize: 26,
                fontWeight: 900,
                margin: "0 0 6px",
                letterSpacing: "-0.02em",
              }}
            >
              QSign v2 — Key registry
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.85,
                lineHeight: 1.5,
                maxWidth: 720,
              }}
            >
              The registry tracks all HMAC-SHA256 and Ed25519 keys ever used by QSign.
              Active keys sign new payloads; retired keys stay valid forever for verifying
              historical signatures. Rotation is admin-gated and creates an overlap window.
            </p>
            {data ? (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  fontSize: 11,
                  opacity: 0.85,
                }}
              >
                <span>
                  {data.algoVersion} · {data.canonicalization}
                </span>
                <span>
                  active hmac:{" "}
                  <code style={{ fontFamily: "monospace" }}>
                    {data.active.hmac || "—"}
                  </code>
                </span>
                <span>
                  active ed25519:{" "}
                  <code style={{ fontFamily: "monospace" }}>
                    {data.active.ed25519 || "—"}
                  </code>
                </span>
                <span>total keys: {data.total}</span>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div
            style={{
              ...card,
              borderColor: "rgba(239,68,68,0.25)",
              background: "rgba(254,226,226,0.35)",
              color: "#b91c1c",
              marginBottom: 20,
            }}
          >
            <strong>Failed to load keys:</strong> {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div style={{ ...card, textAlign: "center", color: "#64748b" }}>
            Loading…
          </div>
        ) : null}

        {data ? (
          <div style={{ display: "grid", gap: 20 }}>
            {(["HMAC-SHA256", "Ed25519"] as const).map((algo) => (
              <section key={algo} style={card}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{algo}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {algo === "HMAC-SHA256"
                        ? "Symmetric signature — requires shared secret to verify."
                        : "Asymmetric signature — any party can verify with the public key."}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.06)",
                      color: "#334155",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {byAlgo[algo]?.length || 0} key{(byAlgo[algo]?.length || 0) === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Timeline strip */}
                <Timeline keys={byAlgo[algo] || []} />

                {/* Key cards */}
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(min(100%, 380px), 1fr))",
                    marginTop: 16,
                  }}
                >
                  {(byAlgo[algo] || []).map((k) => (
                    <KeyCard key={k.kid} k={k} onCopy={copy} />
                  ))}
                  {(byAlgo[algo] || []).length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        border: "1px dashed rgba(15,23,42,0.15)",
                        borderRadius: 10,
                        color: "#94a3b8",
                        fontSize: 13,
                        textAlign: "center",
                      }}
                    >
                      No keys registered yet.
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {/* Rotation docs */}
        <div
          style={{
            marginTop: 24,
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 14,
            padding: 18,
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              marginBottom: 8,
              color: "#0f172a",
            }}
          >
            Rotate a key (admin)
          </div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>
              Rotation demotes the current active key to <code>retired</code> and makes the
              new one active. Retired keys continue to verify historical signatures forever.
            </p>
            <pre
              style={{
                ...mono,
                background: "#0f172a",
                color: "#e2e8f0",
                padding: 12,
                borderRadius: 10,
                margin: "6px 0 0",
                overflow: "auto",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >{`curl -X POST $BASE/api/qsign/v2/keys/rotate \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"algo":"Ed25519","notes":"quarterly rotation"}'`}</pre>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
              For Ed25519 you must supply either <code>body.publicKey</code> (64-hex) or set
              <code> env[secretRef]</code> to a 64-hex seed before calling — otherwise the
              rotation refuses to create a silent ephemeral key.
            </p>
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}

/* ───────── sub-components ───────── */

function Timeline({ keys }: { keys: KeyRow[] }) {
  if (keys.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: "#f8fafc",
        border: "1px solid rgba(15,23,42,0.06)",
        overflowX: "auto",
      }}
    >
      {keys.map((k, idx) => {
        const active = k.status === "active";
        return (
          <div
            key={k.kid}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: active ? "#065f46" : "#e2e8f0",
                color: active ? "#fff" : "#475569",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: active ? "#10b981" : "#94a3b8",
                }}
              />
              {k.kid}
            </div>
            {idx < keys.length - 1 ? (
              <span
                style={{
                  width: 20,
                  height: 2,
                  background: "rgba(15,23,42,0.12)",
                  flexShrink: 0,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function KeyCard({
  k,
  onCopy,
}: {
  k: KeyRow;
  onCopy: (txt: string, what: string) => void;
}) {
  const active = k.status === "active";
  const statusBg = active ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.12)";
  const statusFg = active ? "#047857" : "#475569";
  return (
    <div
      style={{
        border: active
          ? "1.5px solid rgba(16,185,129,0.4)"
          : "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: 14,
        background: active ? "rgba(16,185,129,0.03)" : "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          gap: 8,
        }}
      >
        <code style={{ ...mono, fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
          {k.kid}
        </code>
        <span
          style={{
            padding: "2px 10px",
            borderRadius: 999,
            background: statusBg,
            color: statusFg,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {k.status}
        </span>
      </div>

      <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
        <div>
          <div style={label}>created</div>
          <div style={{ color: "#334155" }}>{formatDate(k.createdAt)}</div>
        </div>
        {k.retiredAt ? (
          <div>
            <div style={label}>retired</div>
            <div style={{ color: "#334155" }}>{formatDate(k.retiredAt)}</div>
          </div>
        ) : null}
        {k.notes ? (
          <div>
            <div style={label}>notes</div>
            <div style={{ color: "#475569", fontSize: 12 }}>{k.notes}</div>
          </div>
        ) : null}
        {k.publicKey ? (
          <div>
            <div style={label}>public key</div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <code
                style={{
                  ...mono,
                  wordBreak: "break-all",
                  flex: 1,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {k.publicKey}
              </code>
              <button
                onClick={() => onCopy(k.publicKey!, `${k.kid} public key`)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(15,23,42,0.15)",
                  background: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                copy
              </button>
            </div>
          </div>
        ) : k.algo === "HMAC-SHA256" ? (
          <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
            HMAC secrets are never exposed. Verification requires server access.
          </div>
        ) : null}
      </div>
    </div>
  );
}
