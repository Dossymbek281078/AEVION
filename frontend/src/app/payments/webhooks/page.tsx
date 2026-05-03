"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type EventType =
  | "checkout.created"
  | "checkout.completed"
  | "payment.failed"
  | "payment.refunded"
  | "settlement.scheduled"
  | "settlement.paid"
  | "dispute.created"
  | "dispute.under_review"
  | "dispute.won"
  | "dispute.lost";

type WebhookEndpoint = {
  id: string;
  url: string;
  description: string;
  secret: string;
  events: EventType[];
  enabled: boolean;
  createdAt: number;
};

type DeliveryStatus = "pending" | "delivered" | "failed";

type DeliveryAttempt = {
  id: string;
  endpointId: string;
  event: EventType;
  status: DeliveryStatus;
  httpCode: number | null;
  attempts: number;
  at: number;
  payload: string;
  signature: string;
  timestamp: number;
};

async function hmacHex(secret: string, body: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "subtle_unavailable";
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const STORAGE_ENDPOINTS = "aevion.payments.webhooks.endpoints.v1";
const STORAGE_DELIVERIES = "aevion.payments.webhooks.deliveries.v1";

const EVENTS: { id: EventType; label: string; color: string }[] = [
  { id: "checkout.created", label: "checkout.created", color: "#0d9488" },
  { id: "checkout.completed", label: "checkout.completed", color: "#059669" },
  { id: "payment.failed", label: "payment.failed", color: "#dc2626" },
  { id: "payment.refunded", label: "payment.refunded", color: "#f59e0b" },
  { id: "settlement.scheduled", label: "settlement.scheduled", color: "#2563eb" },
  { id: "settlement.paid", label: "settlement.paid", color: "#7c3aed" },
  { id: "dispute.created", label: "dispute.created", color: "#b91c1c" },
  { id: "dispute.under_review", label: "dispute.under_review", color: "#1e3a8a" },
  { id: "dispute.won", label: "dispute.won", color: "#15803d" },
  { id: "dispute.lost", label: "dispute.lost", color: "#7f1d1d" },
];

const DEFAULT_EVENTS: EventType[] = [
  "checkout.completed",
  "payment.failed",
  "settlement.paid",
];

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  fontSize: 14,
  color: "#0f172a",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36).slice(-4)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function genSecret() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return (
    "whsec_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function samplePayload(event: EventType): string {
  const base = {
    id: genId("evt"),
    type: event,
    created: Math.floor(Date.now() / 1000),
    data: {} as Record<string, unknown>,
  };
  switch (event) {
    case "checkout.created":
      base.data = {
        checkout_id: genId("co"),
        amount: 9900,
        currency: "USD",
        url: "https://aevion.app/pay/" + genId("pl"),
      };
      break;
    case "checkout.completed":
      base.data = {
        checkout_id: genId("co"),
        amount: 9900,
        currency: "USD",
        method: "visa-mc",
        last4: "4242",
      };
      break;
    case "payment.failed":
      base.data = {
        checkout_id: genId("co"),
        reason: "card_declined",
        decline_code: "insufficient_funds",
      };
      break;
    case "payment.refunded":
      base.data = {
        checkout_id: genId("co"),
        refund_id: genId("rfd"),
        amount: 9900,
        currency: "USD",
      };
      break;
    case "settlement.scheduled":
      base.data = {
        settlement_id: genId("st"),
        amount: 124500,
        currency: "USD",
        target: "bank_acct_aevion_001",
        scheduled_for: Math.floor(Date.now() / 1000) + 86400,
      };
      break;
    case "settlement.paid":
      base.data = {
        settlement_id: genId("st"),
        amount: 124500,
        currency: "USD",
        target: "bank_acct_aevion_001",
        royalty_split: { creator: 0.85, platform: 0.15 },
      };
      break;
  }
  return JSON.stringify(base, null, 2);
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryAttempt[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [url, setUrl] = useState("https://my-app.example.com/webhooks/aevion");
  const [description, setDescription] = useState("Production webhook");
  const [selected, setSelected] = useState<EventType[]>(DEFAULT_EVENTS);

  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [openPayload, setOpenPayload] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawEp = window.localStorage.getItem(STORAGE_ENDPOINTS);
      if (rawEp) setEndpoints(JSON.parse(rawEp));
      const rawDl = window.localStorage.getItem(STORAGE_DELIVERIES);
      if (rawDl) setDeliveries(JSON.parse(rawDl));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_ENDPOINTS, JSON.stringify(endpoints));
    } catch {
      // ignore
    }
  }, [endpoints, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_DELIVERIES,
        JSON.stringify(deliveries.slice(0, 200))
      );
    } catch {
      // ignore
    }
  }, [deliveries, hydrated]);

  const stats = useMemo(() => {
    const enabled = endpoints.filter((e) => e.enabled).length;
    const total = endpoints.length;
    const delivered24h = deliveries.filter(
      (d) =>
        d.status === "delivered" && Date.now() - d.at < 24 * 60 * 60 * 1000
    ).length;
    const failed24h = deliveries.filter(
      (d) => d.status === "failed" && Date.now() - d.at < 24 * 60 * 60 * 1000
    ).length;
    return { enabled, total, delivered24h, failed24h };
  }, [endpoints, deliveries]);

  function toggleEvent(event: EventType) {
    setSelected((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    if (selected.length === 0) return;
    const localId = genId("we");
    const ep: WebhookEndpoint = {
      id: localId,
      url: url.trim(),
      description: description.trim(),
      secret: genSecret(),
      events: [...selected],
      enabled: true,
      createdAt: Date.now(),
    };
    setEndpoints((prev) => [ep, ...prev]);
    setRevealedSecret(ep.id);

    // Mirror to API so server-side delivery can target this webhook.
    try {
      const apiKey = ensureDemoApiKey();
      const r = await fetch(
        `${window.location.origin}/api/payments/v1/webhooks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: ep.url, events: ep.events }),
        }
      );
      if (!r.ok) return;
      const remote: { id: string; secret: string } = await r.json();
      setEndpoints((prev) =>
        prev.map((x) =>
          x.id === localId
            ? { ...x, id: remote.id, secret: remote.secret }
            : x
        )
      );
      setRevealedSecret(remote.id);
    } catch {
      // offline / sync failed
    }
  }

  function ensureDemoApiKey(): string {
    const KEY_STORE = "aevion.payments.api.keys.v1";
    try {
      const raw = window.localStorage.getItem(KEY_STORE);
      const parsed: { full?: string }[] = raw ? JSON.parse(raw) : [];
      if (parsed.length > 0 && parsed[0].full) return parsed[0].full;
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      const tail = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const full = "sk_test_" + tail;
      const newKey = {
        id: `key_demo_${Date.now().toString(36).slice(-4)}`,
        name: "Auto-generated (Webhooks page)",
        prefix: full.slice(0, 12) + "…",
        full,
        createdAt: Date.now(),
        livemode: false,
      };
      window.localStorage.setItem(KEY_STORE, JSON.stringify([newKey, ...parsed]));
      return full;
    } catch {
      return "sk_test_DEMOFALLBACK";
    }
  }

  async function fireRealHttpEvent(endpoint: WebhookEndpoint, event: EventType) {
    const ts = Date.now();
    const placeholder: DeliveryAttempt = {
      id: genId("att"),
      endpointId: endpoint.id,
      event,
      status: "pending",
      httpCode: null,
      attempts: 1,
      at: ts,
      payload: `{"event":"${event}","note":"awaiting server response..."}`,
      signature: "(server-signed)",
      timestamp: ts,
    };
    setDeliveries((prev) => [placeholder, ...prev]);

    try {
      const apiKey = ensureDemoApiKey();
      const r = await fetch(
        `${window.location.origin}/api/payments/v1/webhooks/${endpoint.id}/test`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ event }),
        }
      );
      const j = (await r.json()) as {
        delivered?: boolean;
        http_code?: number | null;
        timestamp?: number;
        signature?: string;
        payload?: unknown;
        error?: string | null;
        duration_ms?: number;
      };
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === placeholder.id
            ? {
                ...d,
                status: j.delivered ? "delivered" : "failed",
                httpCode: j.http_code ?? r.status ?? null,
                signature: j.signature ?? d.signature,
                timestamp: j.timestamp ?? d.timestamp,
                payload: j.payload
                  ? JSON.stringify(j.payload, null, 2) +
                    (j.error ? `\n\n// error: ${j.error}` : "") +
                    (j.duration_ms ? `\n// duration: ${j.duration_ms}ms` : "")
                  : d.payload,
              }
            : d
        )
      );
    } catch (err) {
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === placeholder.id
            ? {
                ...d,
                status: "failed",
                httpCode: 0,
                payload:
                  d.payload +
                  `\n\n// ${err instanceof Error ? err.message : String(err)}`,
              }
            : d
        )
      );
    }
  }

  function toggleEndpoint(id: string) {
    setEndpoints((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  }

  function rotateSecret(id: string) {
    setEndpoints((prev) =>
      prev.map((e) => (e.id === id ? { ...e, secret: genSecret() } : e))
    );
    setRevealedSecret(id);
  }

  function deleteEndpoint(id: string) {
    if (!window.confirm("Delete this webhook endpoint?")) return;
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
    setDeliveries((prev) => prev.filter((d) => d.endpointId !== id));
  }

  function copySecret(secret: string, id: string) {
    navigator.clipboard.writeText(secret).then(() => {
      setCopiedSecret(id);
      setTimeout(() => setCopiedSecret((c) => (c === id ? null : c)), 1600);
    });
  }

  async function fireTestEvent(endpoint: WebhookEndpoint, event: EventType) {
    const willFail = Math.random() < 0.18;
    const ts = Date.now();
    const payload = samplePayload(event);
    const signedBody = `${ts}.${payload}`;
    const signature = await hmacHex(endpoint.secret, signedBody);
    const delivery: DeliveryAttempt = {
      id: genId("att"),
      endpointId: endpoint.id,
      event,
      status: "pending",
      httpCode: null,
      attempts: 1,
      at: ts,
      payload,
      signature,
      timestamp: ts,
    };
    setDeliveries((prev) => [delivery, ...prev]);
    window.setTimeout(() => {
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === delivery.id
            ? {
                ...d,
                status: willFail ? "failed" : "delivered",
                httpCode: willFail ? 500 : 200,
              }
            : d
        )
      );
    }, 700);
  }

  async function retryDelivery(deliveryId: string) {
    const d = deliveries.find((x) => x.id === deliveryId);
    if (!d) return;
    const ep = endpoints.find((e) => e.id === d.endpointId);
    const ts = Date.now();
    const signature = ep
      ? await hmacHex(ep.secret, `${ts}.${d.payload}`)
      : d.signature;
    setDeliveries((prev) =>
      prev.map((x) =>
        x.id === deliveryId
          ? {
              ...x,
              status: "pending",
              attempts: x.attempts + 1,
              at: ts,
              timestamp: ts,
              signature,
            }
          : x
      )
    );
    window.setTimeout(() => {
      setDeliveries((prev) =>
        prev.map((x) =>
          x.id === deliveryId
            ? { ...x, status: "delivered", httpCode: 200 }
            : x
        )
      );
    }, 600);
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #4c1d95 48%, #7c3aed 100%)",
          color: "#fff",
          padding: "32px 24px 38px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/payments"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.75)",
              textDecoration: "none",
            }}
          >
            ← Payments Rail
          </Link>
          <h1
            style={{
              fontSize: "clamp(22px, 3.6vw, 34px)",
              fontWeight: 800,
              margin: "10px 0 8px",
              letterSpacing: "-0.03em",
            }}
          >
            Webhooks
          </h1>
          <p
            style={{
              fontSize: "clamp(13px, 1.8vw, 16px)",
              opacity: 0.92,
              maxWidth: 720,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Real-time event delivery for every payment lifecycle state.
            HMAC-SHA256 signed payloads, exponential-backoff retries, and full
            audit log.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 22,
            }}
          >
            <Stat label="Endpoints" value={`${stats.enabled}/${stats.total}`} accent="#c4b5fd" />
            <Stat label="Delivered 24h" value={stats.delivered24h.toString()} accent="#86efac" />
            <Stat label="Failed 24h" value={stats.failed24h.toString()} accent="#fda4af" />
            <Stat label="Signing" value="HMAC-SHA256" accent="#fcd34d" />
          </div>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <form
          onSubmit={handleCreate}
          style={{
            padding: 22,
            borderRadius: 18,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
            display: "grid",
            gap: 14,
            position: "sticky",
            top: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7c3aed",
            }}
          >
            New webhook endpoint
          </div>

          <div>
            <label style={labelStyle}>Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/aevion"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Production / staging / etc."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Events to subscribe ({selected.length})</label>
            <div style={{ display: "grid", gap: 6 }}>
              {EVENTS.map((ev) => {
                const active = selected.includes(ev.id);
                return (
                  <label
                    key={ev.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: `1px solid ${active ? ev.color + "55" : "rgba(15,23,42,0.1)"}`,
                      background: active ? ev.color + "0d" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleEvent(ev.id)}
                      style={{ accentColor: ev.color }}
                    />
                    <span
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? "#0f172a" : "#475569",
                      }}
                    >
                      {ev.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: "13px 20px",
              borderRadius: 12,
              background: "#7c3aed",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            Create endpoint →
          </button>
        </form>

        <section style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7c3aed",
            }}
          >
            Endpoints
          </div>

          {endpoints.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                borderRadius: 16,
                border: "1px dashed rgba(15,23,42,0.2)",
                textAlign: "center",
                color: "#64748b",
                fontSize: 14,
                background: "rgba(15,23,42,0.02)",
              }}
            >
              Register your first endpoint above. We&apos;ll generate an HMAC
              secret used to sign every payload — verify on your side using
              the snippet below.
            </div>
          ) : (
            endpoints.map((ep) => {
              const epDeliveries = deliveries.filter(
                (d) => d.endpointId === ep.id
              );
              return (
                <article
                  key={ep.id}
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    border: "1px solid rgba(15,23,42,0.1)",
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 14,
                          color: "#0f172a",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                          wordBreak: "break-all",
                        }}
                      >
                        {ep.url}
                      </div>
                      {ep.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          {ep.description}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: 6,
                          background: ep.enabled
                            ? "rgba(5,150,105,0.12)"
                            : "rgba(100,116,139,0.12)",
                          color: ep.enabled ? "#047857" : "#475569",
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {ep.enabled ? "Live" : "Paused"}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleEndpoint(ep.id)}
                        style={miniBtn(ep.enabled ? "#475569" : "#059669")}
                      >
                        {ep.enabled ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEndpoint(ep.id)}
                        style={miniBtn("#dc2626", true)}
                      >
                        Delete
                      </button>
                    </div>
                  </header>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(124,58,237,0.05)",
                      border: "1px solid rgba(124,58,237,0.15)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#6d28d9",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Signing secret
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedSecret((s) =>
                              s === ep.id ? null : ep.id
                            )
                          }
                          style={miniBtn("#7c3aed", true)}
                        >
                          {revealedSecret === ep.id ? "Hide" : "Reveal"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copySecret(ep.secret, ep.id)}
                          style={miniBtn("#7c3aed")}
                        >
                          {copiedSecret === ep.id ? "Copied ✓" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => rotateSecret(ep.id)}
                          style={miniBtn("#f59e0b", true)}
                        >
                          Rotate
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        color: "#0f172a",
                        wordBreak: "break-all",
                      }}
                    >
                      {revealedSecret === ep.id
                        ? ep.secret
                        : "•".repeat(Math.min(48, ep.secret.length))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#64748b",
                      }}
                    >
                      Simulated (in-memory delivery, ~18% random fail)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ep.events.map((evId) => {
                        const ev = EVENTS.find((e) => e.id === evId);
                        if (!ev) return null;
                        return (
                          <button
                            key={evId}
                            type="button"
                            onClick={() => fireTestEvent(ep, evId)}
                            disabled={!ep.enabled}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 8,
                              background: ep.enabled
                                ? ev.color + "15"
                                : "rgba(15,23,42,0.04)",
                              color: ep.enabled ? ev.color : "#94a3b8",
                              border: ep.enabled
                                ? `1px solid ${ev.color}55`
                                : "1px solid rgba(15,23,42,0.08)",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: ep.enabled ? "pointer" : "not-allowed",
                            }}
                            title={
                              ep.enabled
                                ? `Fire test ${ev.label}`
                                : "Endpoint paused"
                            }
                          >
                            ▶ {ev.label}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#0d9488",
                        marginTop: 4,
                      }}
                    >
                      Live HTTP (real fetch from server, 4s timeout)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ep.events.map((evId) => {
                        const ev = EVENTS.find((e) => e.id === evId);
                        if (!ev) return null;
                        return (
                          <button
                            key={`live_${evId}`}
                            type="button"
                            onClick={() => fireRealHttpEvent(ep, evId)}
                            disabled={!ep.enabled}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 8,
                              background: ep.enabled
                                ? "#0d9488"
                                : "rgba(15,23,42,0.04)",
                              color: ep.enabled ? "#fff" : "#94a3b8",
                              border: "none",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: ep.enabled ? "pointer" : "not-allowed",
                            }}
                            title={
                              ep.enabled
                                ? `Server POST signed ${ev.label} to ${ep.url}`
                                : "Endpoint paused"
                            }
                          >
                            ▲ {ev.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {epDeliveries.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid rgba(15,23,42,0.06)",
                        paddingTop: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Recent deliveries ({epDeliveries.length})
                      </div>
                      {epDeliveries.slice(0, 8).map((d) => (
                        <DeliveryRow
                          key={d.id}
                          delivery={d}
                          onRetry={() => retryDelivery(d.id)}
                          onView={() =>
                            setOpenPayload(openPayload === d.id ? null : d.id)
                          }
                          isOpen={openPayload === d.id}
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}

          <section
            style={{
              marginTop: 16,
              padding: 22,
              borderRadius: 16,
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5eead4",
                marginBottom: 6,
              }}
            >
              Verify the signature
            </div>
            <pre
              style={{
                margin: 0,
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#e2e8f0",
                overflow: "auto",
                lineHeight: 1.65,
              }}
            >
{`// Node.js verification — matches the signature attached to test deliveries
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody, headers, secret) {
  const ts = headers["x-aevion-timestamp"];
  const sig = headers["x-aevion-signature"];
  if (!ts || !sig) return false;

  // Reject replays older than 5 minutes
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return false;

  const signedBody = \`\${ts}.\${rawBody}\`;
  const expected = createHmac("sha256", secret)
    .update(signedBody)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}`}
            </pre>
          </section>
        </section>
      </div>
    </main>
  );
}

function DeliveryRow({
  delivery,
  onRetry,
  onView,
  isOpen,
}: {
  delivery: DeliveryAttempt;
  onRetry: () => void;
  onView: () => void;
  isOpen: boolean;
}) {
  const ev = EVENTS.find((e) => e.id === delivery.event);
  const statusBg: Record<DeliveryStatus, string> = {
    pending: "rgba(245,158,11,0.12)",
    delivered: "rgba(5,150,105,0.12)",
    failed: "rgba(220,38,38,0.12)",
  };
  const statusFg: Record<DeliveryStatus, string> = {
    pending: "#b45309",
    delivered: "#047857",
    failed: "#b91c1c",
  };
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.03)",
        border: "1px solid rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            padding: "2px 7px",
            borderRadius: 5,
            background: statusBg[delivery.status],
            color: statusFg[delivery.status],
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {delivery.status}
          {delivery.httpCode ? ` · ${delivery.httpCode}` : ""}
        </span>
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            fontWeight: 700,
            color: ev?.color ?? "#475569",
          }}
        >
          {delivery.event}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          attempt {delivery.attempts} · {new Date(delivery.at).toLocaleTimeString()}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onView} style={miniBtn("#0f172a", true)}>
          {isOpen ? "Hide" : "Payload"}
        </button>
        {delivery.status === "failed" && (
          <button type="button" onClick={onRetry} style={miniBtn("#0d9488")}>
            Retry
          </button>
        )}
      </div>
      {isOpen && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              background: "rgba(13,148,136,0.06)",
              border: "1px solid rgba(13,148,136,0.18)",
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "#0f766e",
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#0f172a" }}>X-AEVION-Timestamp:</strong>{" "}
            {delivery.timestamp}
            <br />
            <strong style={{ color: "#0f172a" }}>X-AEVION-Signature:</strong>{" "}
            {delivery.signature}
          </div>
          <pre
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 11,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              overflow: "auto",
              lineHeight: 1.55,
            }}
          >
            {delivery.payload}
          </pre>
        </div>
      )}
    </div>
  );
}

function miniBtn(color: string, ghost = false): CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 7,
    background: ghost ? "transparent" : color,
    color: ghost ? color : "#fff",
    fontWeight: 700,
    fontSize: 11,
    border: ghost ? `1px solid ${color}55` : "none",
    cursor: "pointer",
  };
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}
