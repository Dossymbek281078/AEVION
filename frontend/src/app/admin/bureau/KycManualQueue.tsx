"use client";

/**
 * Очередь ручной проверки личности (бюро «Проверено», 21.10.2026).
 *
 * Сотрудник видит поданные документы, открывает файлы (каждый просмотр бэк
 * пишет в журнал бюро) и принимает решение. Файлы идут с Bearer-токеном, поэтому
 * открываются через blob, а не прямой ссылкой. Пока BUREAU_KYC_PROVIDER не
 * manual, ручки отвечают 404 kyc_manual_disabled — это показывается словами,
 * а не пустой очередью: пустая очередь при выключенном флаге выглядела бы как
 * «заявок нет».
 */
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { apiUrl } from "@/lib/apiBase";

type Item = {
  id: string;
  email: string | null;
  declaredName: string | null;
  declaredCountry: string | null;
  status: string;
  docType: string | null;
  hasFiles: boolean;
  submittedAt: string | null;
  purgeAfter: string | null;
  purgedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
  verifiedName: string | null;
};

type Load = { kind: "loading" } | { kind: "ok"; items: Item[] } | { kind: "disabled" } | { kind: "error"; detail: string };

const FILTERS = ["review", "pending", "approved", "rejected", "expired", "all"];

const row: CSSProperties = { border: "1px solid rgba(15,23,42,0.1)", borderRadius: 10, padding: 12, marginBottom: 10 };
const input: CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12, minWidth: 0 };
const btn: CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" };

export function KycManualQueue({
  authHeaders,
  notify,
}: {
  authHeaders: () => Record<string, string>;
  notify: (msg: string, kind: "success" | "error") => void;
}) {
  const [filter, setFilter] = useState("review");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [names, setNames] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const r = await fetch(apiUrl(`/api/bureau/admin/kyc-manual?status=${encodeURIComponent(filter)}`), {
        headers: authHeaders(),
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 && j?.error === "kyc_manual_disabled") return setLoad({ kind: "disabled" });
      if (!r.ok) return setLoad({ kind: "error", detail: String(j?.error || r.status) });
      setLoad({ kind: "ok", items: j.items || [] });
    } catch (e) {
      setLoad({ kind: "error", detail: (e as Error).message || "network" });
    }
  }, [authHeaders, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openFile(id: string, kind: "document" | "selfie") {
    // Вкладку открываем до запроса: после await браузер счёл бы её всплывающим окном.
    const w = window.open("", "_blank");
    try {
      const r = await fetch(apiUrl(`/api/bureau/admin/kyc-manual/${id}/file/${kind}`), { headers: authHeaders(), cache: "no-store" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        w?.close();
        return notify(`File ${kind}: ${j?.error || r.status}`, "error");
      }
      const url = URL.createObjectURL(await r.blob());
      if (w) w.location.href = url;
      else notify("Popup blocked — allow popups for this site", "error");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      w?.close();
      notify(`File ${kind}: ${(e as Error).message}`, "error");
    }
  }

  async function decide(it: Item, decision: "approved" | "rejected") {
    const verifiedName = (names[it.id] ?? it.declaredName ?? "").trim();
    const reason = (reasons[it.id] ?? "").trim();
    if (decision === "approved" && !verifiedName) return notify("Name as in the document is required", "error");
    if (decision === "rejected" && !reason) return notify("Reason is required to reject", "error");
    const r = await fetch(apiUrl(`/api/bureau/admin/kyc-manual/${it.id}/decide`), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        verifiedName: decision === "approved" ? verifiedName : undefined,
        verifiedCountry: decision === "approved" ? (countries[it.id] ?? it.declaredCountry ?? "").trim() || undefined : undefined,
        verifiedDocType: decision === "approved" ? it.docType || undefined : undefined,
        reason: reason || undefined,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return notify(`Decision failed: ${j?.error || r.status}`, "error");
    }
    notify(decision === "approved" ? "Identity approved" : "Rejected", "success");
    void reload();
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div data-admin-kyc-manual>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#0f172a", flex: "1 1 auto" }}>Manual identity checks</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={input} aria-label="Status filter">
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button type="button" style={btn} onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      {load.kind === "loading" && <div style={{ color: "#64748b", fontSize: 13 }}>Loading…</div>}
      {load.kind === "disabled" && (
        <div data-admin-kyc-manual-disabled style={{ color: "#64748b", fontSize: 13 }}>
          Manual review is off: <code>BUREAU_KYC_PROVIDER</code> is not <code>manual</code>. Nothing can be submitted.
        </div>
      )}
      {load.kind === "error" && (
        <div style={{ color: "#b91c1c", fontSize: 13 }}>Could not load the queue: {load.detail}</div>
      )}
      {load.kind === "ok" && load.items.length === 0 && (
        <div style={{ color: "#64748b", fontSize: 13 }}>No sessions with status “{filter}”.</div>
      )}
      {load.kind === "ok" &&
        load.items.map((it) => (
          <div key={it.id} data-admin-kyc-item={it.id} style={row}>
            <div style={{ fontSize: 13, color: "#0f172a", overflowWrap: "anywhere" }}>
              <strong>{it.declaredName || "—"}</strong> · {it.email || "no email"} · {it.declaredCountry || "—"} ·{" "}
              <code>{it.status}</code>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0 8px", overflowWrap: "anywhere" }}>
              {it.id} · doc: {it.docType || "—"} · submitted {fmt(it.submittedAt)} ·{" "}
              {it.purgedAt ? `files deleted ${fmt(it.purgedAt)}` : `files deleted after ${fmt(it.purgeAfter)}`}
              {it.decidedAt && ` · decided ${fmt(it.decidedAt)} by ${it.decidedBy || "?"}`}
              {it.reason && ` · reason: ${it.reason}`}
              {it.verifiedName && ` · verified as ${it.verifiedName}`}
            </div>
            {it.hasFiles && !it.purgedAt && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <button type="button" data-kyc-action="document" style={btn} onClick={() => void openFile(it.id, "document")}>
                  Open document
                </button>
                <button type="button" data-kyc-action="selfie" style={btn} onClick={() => void openFile(it.id, "selfie")}>
                  Open selfie
                </button>
              </div>
            )}
            {it.status === "review" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <input
                  style={{ ...input, flex: "1 1 180px" }}
                  placeholder="Name exactly as in the document"
                  value={names[it.id] ?? it.declaredName ?? ""}
                  onChange={(e) => setNames((m) => ({ ...m, [it.id]: e.target.value }))}
                />
                <input
                  style={{ ...input, width: 60 }}
                  placeholder="KZ"
                  maxLength={2}
                  value={countries[it.id] ?? it.declaredCountry ?? ""}
                  onChange={(e) => setCountries((m) => ({ ...m, [it.id]: e.target.value }))}
                />
                <button
                  type="button"
                  data-kyc-action="approve"
                  style={{ ...btn, background: "#16a34a", color: "#fff", border: "none" }}
                  onClick={() => void decide(it, "approved")}
                >
                  Approve
                </button>
                <input
                  style={{ ...input, flex: "1 1 180px" }}
                  placeholder="Reason (required to reject)"
                  value={reasons[it.id] ?? ""}
                  onChange={(e) => setReasons((m) => ({ ...m, [it.id]: e.target.value }))}
                />
                <button
                  type="button"
                  data-kyc-action="reject"
                  style={{ ...btn, color: "#dc2626", borderColor: "rgba(220,38,38,0.4)" }}
                  onClick={() => void decide(it, "rejected")}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
