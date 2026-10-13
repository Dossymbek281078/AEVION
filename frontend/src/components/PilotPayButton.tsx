"use client";
/**
 * «Pay $490 now» на /proof (волна 129б, 13.10.2026). Обычный путь кассы: событие
 * checkout_start с каналом, ссылка от нашего бэкенда (POST /api/proof/pilot-checkout →
 * LemonSqueezy, товар pilot_490), переход на кассу в той же вкладке — касса возвращает
 * на /pricing/checkout/success?ref=pilot_490. Отказ назван словами, ничего не списано.
 */
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { PILOT_USD, PILOT_RECORDS, PILOT_DAYS, PILOT_FEATURE } from "@/lib/proofPilot";

export function PilotPayButton() {
  const [s, setS] = useState<"idle" | "sending" | "error">("idle");
  const [note, setNote] = useState("");

  async function oplatit() {
    if (s === "sending") return;
    setS("sending"); setNote("");
    let path = "/proof", channel: string | null = null;
    try { path = window.location.pathname + window.location.search; channel = new URLSearchParams(window.location.search).get("c"); } catch { /* нет окна */ }
    track({ type: "checkout_start", source: "proof", value: PILOT_USD, meta: { product: PILOT_FEATURE, ...(channel ? { channel } : {}) } });
    try {
      const r = await fetch(apiUrl("/api/proof/pilot-checkout"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: PILOT_FEATURE, channel, post: channel, path }) });
      const body = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (r.ok && body.ok && body.url) { window.location.href = body.url; return; }
      setS("error");
      setNote(`Online payment is unavailable right now (${body.error ?? r.status}). Nothing was charged — send the request below and we invoice you after the scope is agreed.`);
    } catch {
      setS("error"); setNote("Network error — nothing was charged. Send the request below instead.");
    }
  }

  return (
    <div data-pilot-pay style={{ margin: "0 0 16px", padding: "14px 16px", border: "1px solid #99f6e4", borderRadius: 10, background: "#fff" }}>
      <button type="button" data-pilot-pay-button onClick={oplatit} disabled={s === "sending"} style={{ padding: "12px 20px", fontSize: 16, fontWeight: 800, borderRadius: 10, border: "none", background: "#0f766e", color: "#fff", cursor: s === "sending" ? "wait" : "pointer" }}>
        {s === "sending" ? "Opening the checkout…" : `Pay $${PILOT_USD} now`}
      </button>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
        Card checkout by Lemon Squeezy, receipt by email. After payment we email you within 24 hours to agree the scope — the record format and a fixed date. Up to {PILOT_RECORDS.toLocaleString("en-US")} records, {PILOT_DAYS} days.
      </p>
      {note && <p data-pilot-pay-note role="status" style={{ margin: "8px 0 0", fontSize: 14, color: "#b91c1c" }}>{note}</p>}
    </div>
  );
}
