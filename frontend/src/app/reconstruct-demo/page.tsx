"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface Shard {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
  location: string;
  createdAt: string;
  lastVerified: string;
}

interface GenerateResponse {
  demo: true;
  ephemeral: true;
  shieldId: string;
  publicKeySpkiHex: string;
  publicKeyRawHex: string;
  threshold: number;
  totalShards: number;
  hmacKeyVersion: number;
  shards: Shard[];
  note: string;
}

interface ReconstructSuccess {
  demo: true;
  valid: true;
  reconstructed: true;
  shieldId: string;
  verifiedAt: string;
}

interface ReconstructFailure {
  valid: false;
  reconstructed: false;
  reason: string;
}

type ReconstructResponse = ReconstructSuccess | ReconstructFailure;

function shardToJson(s: Shard): string {
  return JSON.stringify(
    {
      index: s.index,
      sssShare: s.sssShare,
      hmac: s.hmac,
      hmacKeyVersion: s.hmacKeyVersion,
    },
    null,
    2,
  );
}

function tamperShard(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Shard;
    const hmac = parsed.hmac;
    const flipped =
      hmac.slice(0, -1) + (hmac.slice(-1) === "0" ? "1" : "0");
    return JSON.stringify(
      {
        index: parsed.index,
        sssShare: parsed.sssShare,
        hmac: flipped,
        hmacKeyVersion: parsed.hmacKeyVersion,
      },
      null,
      2,
    );
  } catch {
    return raw;
  }
}

const REASON_MESSAGES: Record<string, string> = {
  INVALID_HMAC:
    "At least one shard failed HMAC verification. The shard was tampered, mis-paired with a different shield, or its hmacKeyVersion doesn't match.",
  INSUFFICIENT_SHARDS:
    "Not enough shards provided. Threshold is 2-of-3.",
  RECONSTRUCTION_FAILED:
    "Shamir combine succeeded but the recovered private key does not match the expected public key. Shards are from a different keypair.",
  DUPLICATE_SHARD_INDEX:
    "Two shards share the same index. Lagrange interpolation requires distinct points.",
  INVALID_SHARD_FORMAT:
    "Shard JSON is malformed. Required fields: index (number), sssShare (string), hmac (string), hmacKeyVersion (number).",
  DEMO_DISABLED:
    "Demo endpoints are disabled on this server (ENABLE_DEMO_ENDPOINTS=false).",
  RATE_LIMITED:
    "Rate limit exceeded (10 requests per minute per IP). Try again shortly.",
};

export default function ReconstructDemoPage() {
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");

  const [result, setResult] = useState<ReconstructResponse | null>(null);
  const [reconstructing, setReconstructing] = useState(false);
  const [reconstructError, setReconstructError] = useState<string | null>(
    null,
  );

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setGenerateError(null);
    setResult(null);
    setSlot1("");
    setSlot2("");
    setSlot3("");
    try {
      const res = await fetch(apiUrl("/api/pipeline/demo-generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as GenerateResponse | { reason?: string; error?: string };
      if (!res.ok) {
        const reason = (json as { reason?: string }).reason;
        setGenerateError(
          (reason && REASON_MESSAGES[reason]) ||
            (json as { error?: string }).error ||
            `HTTP ${res.status}`,
        );
        return;
      }
      setGenerated(json as GenerateResponse);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "network error",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleReconstruct(): Promise<void> {
    if (!generated) return;
    setReconstructing(true);
    setReconstructError(null);
    setResult(null);

    const slots = [slot1, slot2, slot3].filter((s) => s.trim().length > 0);
    const parsed: unknown[] = [];
    for (const s of slots) {
      try {
        parsed.push(JSON.parse(s));
      } catch {
        setReconstructError("One of the shard slots is not valid JSON.");
        setReconstructing(false);
        return;
      }
    }

    try {
      const res = await fetch(apiUrl("/api/pipeline/demo-reconstruct"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shieldId: generated.shieldId,
          publicKeySpkiHex: generated.publicKeySpkiHex,
          shards: parsed,
        }),
      });
      const json = (await res.json()) as ReconstructResponse;
      setResult(json);
    } catch (err) {
      setReconstructError(
        err instanceof Error ? err.message : "network error",
      );
    } finally {
      setReconstructing(false);
    }
  }

  function fillSlot(slot: number, shardIdx: number): void {
    if (!generated) return;
    const shard = generated.shards[shardIdx];
    const json = shardToJson(shard);
    if (slot === 1) setSlot1(json);
    else if (slot === 2) setSlot2(json);
    else if (slot === 3) setSlot3(json);
  }

  function tamper(slot: number): void {
    if (slot === 1) setSlot1((v) => tamperShard(v));
    else if (slot === 2) setSlot2((v) => tamperShard(v));
    else if (slot === 3) setSlot3((v) => tamperShard(v));
  }

  const filledSlots = [slot1, slot2, slot3].filter((s) => s.trim().length > 0)
    .length;
  const canReconstruct = generated !== null && filledSlots >= 2 && !reconstructing;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ background: "#0f172a", padding: "20px 0" }}>
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 900,
                color: "#fff",
              }}
            >
              A
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              AEVION
            </span>
          </a>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Quantum Shield — Reconstruction Demo
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px 60px" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0d9488",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
            }}
          >
            Live Cryptographic Demonstration
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              margin: 0,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            Reconstruct the Private Key from 2 Shards
          </h1>
          <p
            style={{
              marginTop: 10,
              color: "#475569",
              fontSize: 15,
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            This page runs against the real AEVION backend. We generate an
            ephemeral Ed25519 keypair, split the private key into 3 shards
            using Shamir&apos;s Secret Sharing over GF(256), and authenticate
            each shard with HMAC-SHA256. Paste any 2 shards below to
            reconstruct the key — the server will verify by signing a probe
            message with the recovered key and checking the signature against
            the public key we generated.
          </p>
          <p
            style={{
              marginTop: 8,
              color: "#94a3b8",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Nothing is persisted. Everything is ephemeral — keypair, shards,
            public key — discarded after this session.
          </p>
        </div>

        {/* Step 1: Generate */}
        <div
          style={{
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#0d9488",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              1
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              Generate ephemeral shield
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: generating
                ? "#94a3b8"
                : "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: generating ? "default" : "pointer",
            }}
          >
            {generating ? "Generating…" : "Generate test shield"}
          </button>

          {generateError && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.15)",
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {generateError}
            </div>
          )}

          {generated && (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Shield ID
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#334155",
                  marginBottom: 16,
                  wordBreak: "break-all",
                }}
              >
                {generated.shieldId}
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Public key (SPKI, hex)
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#334155",
                  marginBottom: 20,
                  wordBreak: "break-all",
                  background: "#f1f5f9",
                  padding: "8px 10px",
                  borderRadius: 8,
                }}
              >
                {generated.publicKeySpkiHex}
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Shards (threshold {generated.threshold} of{" "}
                {generated.totalShards})
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                {generated.shards.map((s, i) => (
                  <div
                    key={s.index}
                    style={{
                      borderRadius: 12,
                      border: "1px solid rgba(15,23,42,0.08)",
                      padding: 14,
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          color: "#0d9488",
                        }}
                      >
                        Shard #{s.index}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        {s.location}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginBottom: 6,
                      }}
                    >
                      sssShare: {s.sssShare.slice(0, 18)}…
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginBottom: 10,
                      }}
                    >
                      hmac: {s.hmac.slice(0, 18)}…
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[1, 2, 3].map((slot) => (
                        <button
                          key={slot}
                          onClick={() => fillSlot(slot, i)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: 6,
                            border: "1px solid rgba(15,23,42,0.12)",
                            background: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: "#475569",
                          }}
                        >
                          →Slot {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Paste */}
        <div
          style={{
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#0d9488",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              2
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              Paste any 2 shards
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {[
              { slot: 1, value: slot1, setter: setSlot1 },
              { slot: 2, value: slot2, setter: setSlot2 },
              { slot: 3, value: slot3, setter: setSlot3 },
            ].map(({ slot, value, setter }) => (
              <div key={slot}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Slot {slot}
                </div>
                <textarea
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder="Paste shard JSON here…"
                  style={{
                    width: "100%",
                    height: 140,
                    padding: 10,
                    fontFamily: "monospace",
                    fontSize: 11,
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#f8fafc",
                    resize: "vertical",
                    color: "#334155",
                  }}
                />
                <button
                  onClick={() => tamper(slot)}
                  disabled={!value.trim()}
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(239,68,68,0.3)",
                    background: value.trim() ? "#fff1f2" : "#f8fafc",
                    color: value.trim() ? "#dc2626" : "#cbd5e1",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: value.trim() ? "pointer" : "default",
                  }}
                >
                  Tamper HMAC (flip last bit)
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3: Reconstruct */}
        <div
          style={{
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#0d9488",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              3
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              Reconstruct &amp; verify
            </div>
          </div>

          <button
            onClick={handleReconstruct}
            disabled={!canReconstruct}
            style={{
              padding: "14px 28px",
              borderRadius: 12,
              border: "none",
              background: !canReconstruct
                ? "#cbd5e1"
                : "linear-gradient(135deg, #0d9488, #06b6d4)",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15,
              cursor: canReconstruct ? "pointer" : "default",
              width: "100%",
            }}
          >
            {reconstructing
              ? "Running Lagrange interpolation + Ed25519 verify…"
              : `Reconstruct with ${filledSlots} shard${filledSlots === 1 ? "" : "s"}`}
          </button>

          {reconstructError && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.15)",
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {reconstructError}
            </div>
          )}

          {result && result.valid === true && (
            <div
              style={{
                marginTop: 16,
                padding: "18px 20px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(13,148,136,0.06))",
                border: "1px solid rgba(16,185,129,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 24 }}>✅</span>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#059669",
                  }}
                >
                  Reconstruction verified
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.6,
                }}
              >
                The server combined your shards via Lagrange interpolation,
                recovered the Ed25519 private key, signed a probe message
                with it, and checked the signature against the public key
                shown above. The signature verifies.
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#94a3b8",
                  fontFamily: "monospace",
                }}
              >
                shieldId: {result.shieldId} · verifiedAt:{" "}
                {new Date(result.verifiedAt).toLocaleString()}
              </div>
            </div>
          )}

          {result && result.valid === false && (
            <div
              style={{
                marginTop: 16,
                padding: "18px 20px",
                borderRadius: 12,
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 24 }}>❌</span>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#dc2626",
                  }}
                >
                  Reconstruction rejected
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#991b1b",
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                {result.reason}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.6,
                }}
              >
                {REASON_MESSAGES[result.reason] ||
                  "The server refused to accept these shards."}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.15)",
            fontSize: 12,
            color: "#92400e",
            lineHeight: 1.6,
          }}
        >
          <b>Note:</b> demo endpoints are rate-limited to 10 requests per
          minute per IP and are disabled in production by default (toggle via
          the <code>ENABLE_DEMO_ENDPOINTS</code> server env). Nothing shown
          here is persisted to the AEVION database.
        </div>
      </div>
    </div>
  );
}
