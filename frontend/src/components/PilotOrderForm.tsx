"use client";
/**
 * Форма заказа пилота $490 на /proof (волна 129, 13.10.2026). До неё единственный путь
 * был mailto — тупик без почтового клиента, 0 нажатий за 14 дней. Форма шлёт POST на
 * наш бэкенд (письмо на data@ + автоответ), считает feature_use pilot_490 и говорит
 * об отказе словами, а не молчит. mailto остаётся запасным путём под формой.
 */
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { PILOT_USD, PILOT_RECORDS, PILOT_DAYS, PILOT_FEATURE } from "@/lib/proofPilot";

type Sostoyanie = "idle" | "sending" | "done" | "error";

export function PilotOrderForm() {
  const [email, setEmail] = useState("");
  const [records, setRecords] = useState(String(PILOT_RECORDS));
  const [days, setDays] = useState(String(PILOT_DAYS));
  const [data, setData] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: людям не показывается
  const [s, setS] = useState<Sostoyanie>("idle");
  const [note, setNote] = useState("");

  async function otpravit(e: React.FormEvent) {
    e.preventDefault();
    if (s === "sending") return;
    const адрес = email.trim();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(адрес)) { setS("error"); setNote("Please enter a work email."); return; }
    setS("sending"); setNote("");
    track({ type: "cta_click", source: "proof", value: PILOT_USD, meta: { feature: PILOT_FEATURE, product: PILOT_FEATURE, via: "form" } });
    track({ type: "feature_use", source: "proof", meta: { feature: PILOT_FEATURE, via: "form" } });
    let path = "/proof", channel: string | null = null, post: string | null = null;
    try { path = window.location.pathname + window.location.search; const q = new URLSearchParams(window.location.search); channel = q.get("c"); post = channel; } catch { /* нет окна */ }
    try {
      const r = await fetch(apiUrl("/api/proof/pilot-order"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: адрес, records, days, data, website, channel, post, path }) });
      const body = (await r.json().catch(() => ({}))) as { ok?: boolean; mailed?: { us?: boolean; buyer?: boolean }; errors?: string[]; error?: string };
      if (r.ok && body.ok) {
        setS("done");
        setNote(body.mailed?.buyer ? "Received. A confirmation is on its way to your inbox; we reply with the format and a fixed date." : "Received. We could not send the confirmation email, but your request is recorded — we reply from data@aevion.app.");
      } else {
        setS("error");
        setNote(body.error === "valid_email_required" ? "Please enter a work email." : `Could not send the request (${body.error ?? r.status}). Use the email link below.`);
      }
    } catch {
      setS("error"); setNote("Network error — the request did not reach us. Use the email link below.");
    }
  }

  const поле: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #99f6e4", fontSize: 15, background: "#fff" };
  return (
    <form data-pilot-order-form onSubmit={otpravit} style={{ display: "grid", gap: 10, marginBottom: 14 }} aria-label={`Order the pilot — $${PILOT_USD}`}>
      <label style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>Work email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={поле} autoComplete="email" />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>Records
          <input type="number" min={1} max={1000000} value={records} onChange={(e) => setRecords(e.target.value)} style={поле} />
        </label>
        <label style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>Days
          <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} style={поле} />
        </label>
      </div>
      <label style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>What the data is (one line)
        <input type="text" maxLength={500} value={data} onChange={(e) => setData(e.target.value)} placeholder="e.g. product catalogue, 25k rows, JSON" style={поле} />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap" }} />
      <button type="submit" data-pilot-order-submit disabled={s === "sending"} style={{ padding: "12px 20px", fontSize: 16, fontWeight: 800, borderRadius: 10, border: "none", background: s === "done" ? "#065f46" : "#0f766e", color: "#fff", cursor: s === "sending" ? "wait" : "pointer" }}>
        {s === "sending" ? "Sending…" : s === "done" ? "Request received ✓" : `Order the pilot — $${PILOT_USD}`}
      </button>
      {note && <p data-pilot-order-note role="status" style={{ margin: 0, fontSize: 14, color: s === "error" ? "#b91c1c" : "#065f46" }}>{note}</p>}
      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>Nothing is charged by this form: the invoice comes after we agree the scope.</p>
    </form>
  );
}
