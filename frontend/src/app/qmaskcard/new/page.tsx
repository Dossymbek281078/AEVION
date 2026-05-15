"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

type Kind = "single-use" | "recurring" | "merchant-locked" | "category-locked";

type IssuedMask = {
  id: string;
  virtualPan: string;
  kind: Kind;
  label: string;
  spendLimitCents: number;
  remainingCents: number;
  currency: string;
  expiresAt: string;
  note?: string;
};

const C = { bg: "#0f172a", card: "#1e293b", border: "#334155", accent: "#a78bfa", text: "#f1f5f9", muted: "#94a3b8", danger: "#f87171", ok: "#34d399" };

const KIND_OPTIONS: { value: Kind; title: string; desc: string }[] = [
  { value: "single-use", title: "Single-use", desc: "Сгорит после первой авторизации." },
  { value: "recurring", title: "Recurring", desc: "Подписки. До лимита или истечения." },
  { value: "merchant-locked", title: "Merchant-locked", desc: "Только указанный мерчант." },
  { value: "category-locked", title: "Category-locked", desc: "Только указанная MCC-категория." },
];

const CURRENCIES = ["USD", "EUR", "KZT"] as const;

export default function NewMaskPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Kind>("single-use");
  const [lockedMerchant, setLockedMerchant] = useState("");
  const [lockedCategory, setLockedCategory] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [spendLimitUsd, setSpendLimitUsd] = useState<string>("100");
  const [ttlHours, setTtlHours] = useState<string>("168");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedMask | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { setToken(localStorage.getItem("aevion_token")); } catch { setToken(null); } finally { setTokenChecked(true); }
  }, []);

  const spendLimitCents = useMemo(() => {
    const n = parseFloat(spendLimitUsd);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [spendLimitUsd]);

  const ttlInt = useMemo(() => {
    const n = parseInt(ttlHours, 10);
    return Number.isFinite(n) ? n : 0;
  }, [ttlHours]);

  function reset() {
    setIssued(null); setError(null); setLabel(""); setKind("single-use");
    setLockedMerchant(""); setLockedCategory(""); setSpendLimitUsd("100");
    setTtlHours("168"); setCurrency("USD");
  }

  async function onCopy(pan: string) {
    try {
      await navigator.clipboard.writeText(pan);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!token) { setError("Не найден токен авторизации."); return; }
    if (label.trim().length < 1 || label.trim().length > 80) { setError("Label обязателен (1..80 символов)."); return; }
    if (spendLimitCents < 100 || spendLimitCents > 100_000_000) { setError("Spend limit: от $1 до $1,000,000."); return; }
    if (ttlInt < 1 || ttlInt > 8760) { setError("TTL: от 1 до 8760 часов."); return; }
    if (kind === "merchant-locked" && !lockedMerchant.trim()) { setError("Укажите merchant для merchant-locked маски."); return; }
    if (kind === "category-locked" && !lockedCategory.trim()) { setError("Укажите category для category-locked маски."); return; }

    const body: Record<string, unknown> = { label: label.trim(), kind, currency, spendLimitCents, ttlHours: ttlInt };
    if (kind === "merchant-locked") body.lockedToMerchant = lockedMerchant.trim();
    if (kind === "category-locked") body.lockedToCategory = lockedCategory.trim();

    setSubmitting(true);
    try {
      const r = await fetch(`${getApiBase()}/api/qmaskcard/masks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      const json = await r.json().catch(() => ({} as any));
      if (!r.ok) { setError(typeof json?.error === "string" ? json.error : `Ошибка ${r.status}`); return; }
      setIssued(json as IssuedMask);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "network error";
      setError(`Сеть/таймаут: ${msg}`);
    } finally { setSubmitting(false); }
  }

  if (!tokenChecked) {
    return (
      <main style={S.page}><div style={S.container}><BackLink />
        <div style={{ ...S.card, textAlign: "center", color: C.muted }}>Загрузка…</div>
      </div></main>
    );
  }

  if (!token) {
    return (
      <main style={S.page}><div style={S.container}><BackLink />
        <h1 style={S.title}>Issue virtual mask</h1>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 14, color: C.muted }}>Чтобы выпустить виртуальную маску, нужен токен AEVION.</div>
          <Link href="/auth?next=/qmaskcard/new" style={{ display: "inline-block", padding: "10px 18px", background: C.accent, color: "#0b1020", fontWeight: 800, textDecoration: "none", borderRadius: 8, fontSize: 13 }}>Войти →</Link>
        </div>
      </div></main>
    );
  }

  if (issued) {
    return (
      <main style={S.page}><div style={S.container}><BackLink />
        <h1 style={S.title}>Маска выпущена</h1>
        <div style={S.card}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Virtual PAN</div>
          <button type="button" onClick={() => onCopy(issued.virtualPan)} aria-label="Copy virtual PAN"
            style={{ marginTop: 8, width: "100%", padding: "14px 16px", background: "#0b1020", border: `1px solid ${C.accent}`, borderRadius: 10, color: C.text, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 800, letterSpacing: "0.08em", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span>{issued.virtualPan}</span>
            <span style={{ fontSize: 12, color: copied ? C.ok : C.muted, fontFamily: "inherit" }}>{copied ? "✓ copied" : "copy"}</span>
          </button>
          <div style={{ marginTop: 14, padding: "10px 12px", background: "#3f1d1d", border: "1px solid #7f1d1d", borderRadius: 8, color: "#fecaca", fontSize: 12, fontWeight: 600 }}>
            Сохрани его — больше ты этот PAN не увидишь.
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Field label="Label" value={issued.label} />
            <Field label="Kind" value={issued.kind} />
            <Field label="Limit" value={fmtMoney(issued.spendLimitCents, issued.currency)} />
            <Field label="Remaining" value={fmtMoney(issued.remainingCents, issued.currency)} />
            <Field label="Currency" value={issued.currency} />
            <Field label="Expires" value={new Date(issued.expiresAt).toLocaleString()} />
          </div>
          {issued.note && <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>{issued.note}</div>}
          <button type="button" onClick={reset} style={{ ...S.btn, marginTop: 18, width: "100%" }}>Выпустить ещё одну</button>
        </div>
      </div></main>
    );
  }

  return (
    <main style={S.page}><div style={S.container}><BackLink />
      <h1 style={S.title}>Issue virtual mask</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Виртуальный PAN с лимитом и сроком жизни. Реальная карта остаётся скрытой.</p>

      <form onSubmit={onSubmit} style={S.card}>
        <Row label="Label">
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Netflix subscription" style={S.input} required />
        </Row>

        <Row label="Kind">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {KIND_OPTIONS.map((opt) => {
              const active = kind === opt.value;
              return (
                <label key={opt.value} style={{ padding: 12, background: active ? "#2a2150" : "#0b1020", border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 10, cursor: "pointer", display: "block" }}>
                  <input type="radio" name="kind" value={opt.value} checked={active} onChange={() => setKind(opt.value)} style={{ marginRight: 6 }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{opt.title}</span>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{opt.desc}</div>
                </label>
              );
            })}
          </div>
        </Row>

        {kind === "merchant-locked" && (
          <Row label="Merchant">
            <input type="text" value={lockedMerchant} onChange={(e) => setLockedMerchant(e.target.value)} placeholder="netflix.com" style={S.input} required />
          </Row>
        )}

        {kind === "category-locked" && (
          <Row label="Category (MCC)">
            <input type="text" value={lockedCategory} onChange={(e) => setLockedCategory(e.target.value)} placeholder="streaming" style={S.input} required />
          </Row>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Row label={`Spend limit (${currency})`}>
            <input type="number" min={1} max={1_000_000} step="0.01" value={spendLimitUsd} onChange={(e) => setSpendLimitUsd(e.target.value)} style={S.input} required />
          </Row>
          <Row label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={S.input}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>
          <Row label="TTL (часов)">
            <input type="number" min={1} max={8760} value={ttlHours} onChange={(e) => setTtlHours(e.target.value)} style={S.input} required />
          </Row>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#3f1d1d", border: `1px solid ${C.danger}`, borderRadius: 8, color: "#fecaca", fontSize: 12 }}>{error}</div>
        )}

        <button type="submit" disabled={submitting} style={{ ...S.btn, marginTop: 18, width: "100%", opacity: submitting ? 0.6 : 1, cursor: submitting ? "wait" : "pointer" }}>
          {submitting ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Spinner /> Выпускаем…</span>) : "Выпустить маску →"}
        </button>
      </form>
      <style>{`@keyframes qmask-spin { to { transform: rotate(360deg); } }`}</style>
    </div></main>
  );
}

function BackLink() {
  return <Link href="/qmaskcard" style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>← QMaskCard</Link>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, background: "#0b1020", border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "qmask-spin 0.8s linear infinite" }} />;
}

function fmtMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents)) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: C.bg, color: C.text, padding: "32px 24px" },
  container: { maxWidth: 760, margin: "0 auto" },
  title: { fontSize: 28, fontWeight: 900, margin: "12px 0 4px" },
  card: { padding: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 },
  input: { width: "100%", padding: "10px 12px", background: "#0b1020", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" },
  btn: { padding: "12px 18px", background: C.accent, color: "#0b1020", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer" },
};
