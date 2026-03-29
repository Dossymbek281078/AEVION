"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type RightObject = {
  id: string;
  title: string;
  kind: string;
  description: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerUserId?: string;
  country?: string;
  city?: string;
  contentHash: string;
  createdAt: string;
};

type SignResponse = {
  payload: unknown;
  signature: string;
  algo: string;
  createdAt: string;
};

type VerifyResponse = {
  valid: boolean;
  expected: string;
  provided: string;
};

const STORAGE_KEY = "aevion_ip_bureau_signatures_v2";
const AUTH_TOKEN_KEY = "aevion_auth_token_v1";

export default function BureauPage() {
  const { showToast } = useToast();
  const [objects, setObjects] = useState<RightObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [signatureByObjectId, setSignatureByObjectId] = useState<
    Record<string, string>
  >({});

  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<{
    objectId: string;
    valid: boolean;
    expected: string;
    provided: string;
  } | null>(null);

  /** Fallback country/city from Globus deep link: /bureau?country=&city= */
  const [ctxCountry, setCtxCountry] = useState("");
  const [ctxCity, setCtxCity] = useState("");
  const [focusObjectId, setFocusObjectId] = useState<string | null>(null);
  const didScrollFocus = useRef(false);

  const payloadForObject = useMemo(() => {
    // IMPORTANT: HMAC is computed from JSON.stringify(payload) in backend.
    // We use the same shape and key order (inserted in the same way).
    return (x: RightObject) => ({
      objectId: x.id,
      title: x.title,
      contentHash: x.contentHash,
      country: x.country || null,
      city: x.city || null,
    });
  }, []);

  const mergedForPayload = (x: RightObject): RightObject => ({
    ...x,
    country: x.country || ctxCountry || undefined,
    city: x.city || ctxCity || undefined,
  });

  const copyPayloadJson = async (x: RightObject) => {
    setErr(null);
    const payload = payloadForObject(mergedForPayload(x));
    const text = JSON.stringify(payload);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(x.id);
      window.setTimeout(() => setCopiedId((id) => (id === x.id ? null : id)), 2000);
    } catch {
      setErr("Failed to copy payload (clipboard access)");
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSignatureByObjectId(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("country");
    const ci = sp.get("city");
    const focus = sp.get("focus");
    if (c) setCtxCountry(c);
    if (ci) setCtxCity(ci);
    if (focus) setFocusObjectId(focus);
    didScrollFocus.current = false;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr(null);
        const headers: HeadersInit = {};
        try {
          const t = localStorage.getItem(AUTH_TOKEN_KEY);
          if (t) headers.Authorization = `Bearer ${t}`;
        } catch {
          // ignore
        }
        const res = await fetch(apiUrl("/api/qright/objects"), { headers });
        if (!res.ok) throw new Error("Backend not responding: /api/qright/objects");
        const data = await res.json();
        setObjects(data.items || []);
      } catch (e: any) {
        setErr(e.message || "Error loading objects");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (loading || !focusObjectId || didScrollFocus.current) return;
    const el = document.getElementById(`bureau-object-${focusObjectId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      didScrollFocus.current = true;
    }
  }, [loading, focusObjectId, objects.length]);

  const persistSignatures = (next: Record<string, string>) => {
    setSignatureByObjectId(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const signObject = async (x: RightObject) => {
    setVerifyState(null);
    setBusyId(x.id);
    setErr(null);

    try {
      const payload = payloadForObject(mergedForPayload(x));
      const res = await fetch(apiUrl("/api/qsign/sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Signing error");
      }
      const data: SignResponse = await res.json();

      const next = { ...signatureByObjectId, [x.id]: data.signature || "" };
      persistSignatures(next);
      showToast("Object signed (QSign)", "success");
    } catch (e: any) {
      setErr(e.message || "Signing error");
      showToast(e.message || "Signing error", "error");
    } finally {
      setBusyId(null);
    }
  };

  const verifyObject = async (x: RightObject) => {
    setErr(null);
    setVerifyState(null);
    setBusyId(x.id);

    try {
      const signature = signatureByObjectId[x.id];
      if (!signature) throw new Error("Sign the object first");

      const payload = payloadForObject(mergedForPayload(x));

      const res = await fetch(apiUrl("/api/qsign/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, signature }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Verification error");
      }

      const data: VerifyResponse = await res.json();
      setVerifyState({
        objectId: x.id,
        valid: !!data.valid,
        expected: data.expected,
        provided: data.provided,
      });
      if (data.valid) showToast("Signature VALID — integrity confirmed", "success");
      else showToast("Signature INVALID — data mismatch", "error");
    } catch (e: any) {
      setErr(e.message || "Verification error");
      showToast(e.message || "Verification error", "error");
    } finally {
      setBusyId(null);
    }
  };

  const resetAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSignatureByObjectId({});
    setVerifyState(null);
  };

  return (
    <main>
      <ProductPageShell>
      <Wave1Nav />
      <PipelineSteps current="bureau" />
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          padding: 18,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666" }}>IP / Legal</div>
            <h1 style={{ fontSize: 28, marginTop: 6, marginBottom: 6 }}>
              AEVION IP Bureau
            </h1>
            <div style={{ color: "#555", lineHeight: 1.5 }}>
              QRight registry + signature verification via QSign. Certificate-ready format in MVP.
            </div>
            {(ctxCountry || ctxCity) && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: "#333",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(10,160,80,0.35)",
                  background: "rgba(10,160,80,0.06)",
                }}
              >
                <b>Globus context:</b> {ctxCity || "—"}
                {ctxCountry ? `, ${ctxCountry}` : ""} — location will be used in payload if object has
                no own location.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={resetAll}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 650,
              }}
            >
              Reset signatures (local)
            </button>
          </div>
        </div>
      </div>

      {err && <div style={{ color: "crimson", marginTop: 12 }}>{err}</div>}

      <div style={{ marginTop: 18, marginBottom: 12, color: "#666" }}>
        QRight objects: <b>{objects.length}</b>
      </div>

      {loading ? (
        <div style={{ marginTop: 18 }}>Loading...</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {objects.map((x) => {
            const signature = signatureByObjectId[x.id] || "";
            const verifiedThis = verifyState?.objectId === x.id ? verifyState : null;
            const statusColor = verifiedThis
              ? verifiedThis.valid
                ? "#0a5"
                : "#c00"
              : "#999";

            const isFocused = focusObjectId === x.id;
            return (
              <article
                key={x.id}
                id={`bureau-object-${x.id}`}
                style={{
                  border: isFocused
                    ? "2px solid rgba(10,160,80,0.65)"
                    : "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 16,
                  padding: 16,
                  background: isFocused ? "rgba(10,160,80,0.04)" : "#fff",
                  boxShadow: isFocused ? "0 0 0 4px rgba(10,160,80,0.12)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {x.kind} • {new Date(x.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 850, marginTop: 6 }}>
                      {x.title}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>contentHash</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#111",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                        marginTop: 6,
                      }}
                    >
                      {x.contentHash}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: "#555", lineHeight: 1.5 }}>
                  {x.description}
                </div>

                {(x.country || x.city) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                    Location: {x.city ? x.city : "—"}
                    {x.country ? `, ${x.country}` : ""}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Owner</div>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>
                      {x.ownerName || "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {x.ownerEmail || "—"}
                    </div>
                    {x.ownerUserId ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#999",
                          marginTop: 6,
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                        }}
                        title={x.ownerUserId}
                      >
                        userId: {x.ownerUserId.slice(0, 8)}…
                      </div>
                    ) : null}
                  </div>

                  <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Certificate Status</div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6, color: statusColor }}>
                      {verifiedThis
                        ? verifiedThis.valid
                          ? "VALID (confirmed)"
                          : "INVALID (mismatch)"
                        : signature
                        ? "SIGNED (locally)"
                        : "NOT SIGNED"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => copyPayloadJson(x)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: copiedId === x.id ? "rgba(10,160,80,0.12)" : "#fff",
                      color: "#111",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {copiedId === x.id ? "Copied" : "Copy payload JSON"}
                  </button>
                  <button
                    onClick={() => signObject(x)}
                    disabled={busyId === x.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: busyId === x.id ? "#999" : "#111",
                      color: "#fff",
                      cursor: busyId === x.id ? "default" : "pointer",
                      fontWeight: 750,
                    }}
                  >
                    {busyId === x.id ? "Signing..." : "Sign QRight"}
                  </button>
                  <button
                    onClick={() => verifyObject(x)}
                    disabled={busyId === x.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #0a5",
                      background: "#0a5",
                      color: "#fff",
                      cursor: busyId === x.id ? "default" : "pointer",
                      fontWeight: 750,
                    }}
                  >
                    {busyId === x.id ? "Verifying..." : "Verify signature"}
                  </button>

                  <button
                    disabled
                    title="Placeholder for future PDF export"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px dashed rgba(0,0,0,0.25)",
                      background: "rgba(0,0,0,0.03)",
                      color: "rgba(0,0,0,0.35)",
                      cursor: "not-allowed",
                      fontWeight: 750,
                    }}
                  >
                    PDF export (soon)
                  </button>
                </div>

                {signature ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                      Signature (QSign)
                    </div>
                    <textarea
                      readOnly
                      value={signature}
                      rows={3}
                      style={{
                        width: "100%",
                        fontFamily: "monospace",
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        fontSize: 12,
                      }}
                    />
                    {verifiedThis && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                        expected: {verifiedThis.expected}
                        <br />
                        provided: {verifiedThis.provided}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      </ProductPageShell>
    </main>
  );
}

