"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { PaywallScreen } from "@/components/PaywallScreen";
import { apiFetchOrPaywall, PaywallError, type PaywallPayload } from "@/lib/paywall";
import ModulePricingChip from "@/components/ModulePricingChip";

/**
 * QMaskCard — virtual card masking layer (interactive UI).
 * Backend: /api/qmaskcard (masks, charges, stats — 384 lines).
 */

type MaskKind = "single-use" | "recurring" | "merchant-locked" | "category-locked";

type Mask = {
  id: string;
  label: string;
  virtualPan: string;
  kind: MaskKind;
  lockedToMerchant: string | null;
  lockedToCategory: string | null;
  currency: string;
  spendLimitCents: string | number;
  remainingCents: string | number;
  expiresAt: string | null;
  frozenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type Charge = {
  id: string;
  maskId: string;
  amountCents: string | number;
  currency: string;
  merchantName: string | null;
  merchantCategory: string | null;
  geoCountry: string | null;
  status: "authorized" | "declined";
  declineReason: string | null;
  riskScore: number;
  createdAt: string;
};

type Stats = {
  active_masks: number;
  total_masks: number;
  authorized_charges: number;
  declined_charges: number;
  volume_cents: string | number;
};

function bearer(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function hasToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(getAuthToken());
}
function fmtMoney(cents: string | number, currency: string): string {
  const n = Number(cents) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(n);
}
function shortPan(pan: string): string {
  if (pan.length <= 18) return pan;
  return pan.slice(0, 10) + "…" + pan.slice(-4);
}

const KIND_LABEL: Record<MaskKind, string> = {
  "single-use": "Single-use (self-destruct)",
  "recurring": "Recurring",
  "merchant-locked": "Merchant-locked",
  "category-locked": "Category-locked",
};

export default function QMaskCardPage() {
  const [authed, setAuthed] = useState(false);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Create form
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<MaskKind>("single-use");
  const [spendLimit, setSpendLimit] = useState("50");
  const [currency, setCurrency] = useState("USD");
  const [ttlHours, setTtlHours] = useState("168");
  const [lockedMerchant, setLockedMerchant] = useState("");
  const [lockedCategory, setLockedCategory] = useState("");
  const [creating, setCreating] = useState(false);

  // Test charge form
  const [chargeMaskId, setChargeMaskId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("10");
  const [chargeMerchant, setChargeMerchant] = useState("");
  const [chargeCategory, setChargeCategory] = useState("");
  const [charging, setCharging] = useState(false);

  const [paywall, setPaywall] = useState<PaywallPayload | null>(null);

  const loadStats = useCallback(async () => {
    // First fetch goes through the paywall helper — 402 from the gate
    // surfaces as PaywallError → swap to <PaywallScreen> before the
    // /masks and /charges calls even fire.
    try {
      const stats = await apiFetchOrPaywall<Stats>("/api/qmaskcard/stats", { cache: "no-store" });
      setStats(stats);
    } catch (e) {
      if (e instanceof PaywallError) setPaywall(e.payload);
    }
  }, []);
  const loadMasks = useCallback(async () => {
    if (!hasToken()) { setAuthed(false); return; }
    try {
      const r = await fetch(apiUrl("/api/qmaskcard/masks"), { headers: bearer(), cache: "no-store" });
      if (r.status === 401) { setAuthed(false); return; }
      if (r.ok) { const j = await r.json(); setMasks(j.masks ?? []); setAuthed(true); }
    } catch { /* ignore */ }
  }, []);
  const loadCharges = useCallback(async () => {
    if (!hasToken()) return;
    try {
      const r = await fetch(apiUrl("/api/qmaskcard/charges"), { headers: bearer(), cache: "no-store" });
      if (r.ok) { const j = await r.json(); setCharges(j.charges ?? []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadStats(); void loadMasks(); void loadCharges(); }, [loadStats, loadMasks, loadCharges]);

  const createMask = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        label, kind, currency,
        spendLimitCents: Math.round(parseFloat(spendLimit) * 100),
        ttlHours: parseInt(ttlHours, 10),
      };
      if (kind === "merchant-locked" && lockedMerchant) body.lockedToMerchant = lockedMerchant;
      if (kind === "category-locked" && lockedCategory) body.lockedToCategory = lockedCategory;
      const r = await fetch(apiUrl("/api/qmaskcard/masks"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearer() },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) {
        setMsg(`✓ Маска создана: ${j.virtualPan}`);
        setLabel(""); setSpendLimit("50"); setLockedMerchant(""); setLockedCategory("");
        await loadMasks(); await loadStats();
      } else {
        setMsg(`✗ ${j.error ?? "create_failed"}`);
      }
    } catch { setMsg("✗ Network error"); }
    finally { setCreating(false); }
  };

  const revokeMask = async (id: string) => {
    try {
      const r = await fetch(apiUrl(`/api/qmaskcard/masks/${id}/revoke`), {
        method: "POST", headers: bearer(),
      });
      if (r.ok) { setMsg("✓ Маска отозвана"); await loadMasks(); await loadStats(); }
      else setMsg("✗ Revoke failed");
    } catch { setMsg("✗ Network error"); }
  };

  const setFrozen = async (id: string, freeze: boolean) => {
    try {
      const r = await fetch(apiUrl(`/api/qmaskcard/masks/${id}/${freeze ? "freeze" : "unfreeze"}`), {
        method: "POST", headers: bearer(),
      });
      if (r.ok) { setMsg(freeze ? "❄️ Маска заморожена" : "✓ Маска разморожена"); await loadMasks(); }
      else { const j = await r.json().catch(() => ({})); setMsg(`✗ ${j.error ?? (freeze ? "freeze" : "unfreeze") + "_failed"}`); }
    } catch { setMsg("✗ Network error"); }
  };

  const editLimit = async (m: Mask) => {
    const cur = (Number(m.spendLimitCents) / 100).toString();
    const input = typeof window !== "undefined" ? window.prompt(`Новый лимит для «${m.label}» (${m.currency}). Уже потрачено сохраняется.`, cur) : null;
    if (input === null) return;
    const val = parseFloat(input);
    if (!Number.isFinite(val) || val <= 0) { setMsg("✗ Неверная сумма"); return; }
    try {
      const r = await fetch(apiUrl(`/api/qmaskcard/masks/${m.id}/limit`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearer() },
        body: JSON.stringify({ spendLimitCents: Math.round(val * 100) }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg(`✓ Лимит обновлён: ${fmtMoney(j.spendLimitCents, m.currency)}`); await loadMasks(); await loadStats(); }
      else if (j.error === "limit_below_spent") setMsg(`✗ Лимит ниже потраченного (${fmtMoney(j.spentCents, m.currency)})`);
      else setMsg(`✗ ${j.error ?? "limit_update_failed"}`);
    } catch { setMsg("✗ Network error"); }
  };

  const testCharge = async (e: React.FormEvent) => {
    e.preventDefault(); setCharging(true); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        maskId: chargeMaskId,
        amountCents: Math.round(parseFloat(chargeAmount) * 100),
        currency: "USD",
      };
      if (chargeMerchant) body.merchantName = chargeMerchant;
      if (chargeCategory) body.merchantCategory = chargeCategory;
      const r = await fetch(apiUrl("/api/qmaskcard/charges"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearer() },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) {
        setMsg(`✓ Authorized (risk ${j.riskScore}/100${j.autoRevoked ? ", mask auto-revoked" : ""})`);
        setChargeAmount("10"); setChargeMerchant(""); setChargeCategory("");
        await loadMasks(); await loadCharges(); await loadStats();
      } else if (r.status === 402) {
        setMsg(`✗ Declined: ${j.reason}`);
        await loadCharges();
      } else {
        setMsg(`✗ ${j.error ?? "charge_failed"}`);
      }
    } catch { setMsg("✗ Network error"); }
    finally { setCharging(false); }
  };

  if (paywall) {
    return <PaywallScreen payload={paywall} backHref="/fintech" backLabel="← Fintech" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950 text-slate-100">
      <header
        // Полоса раздела прилипает ПОД шапкой сайта, а не под неё: у шапки
        // тоже sticky top:0, но слой 50 против 30 — при прокрученной странице
        // она закрывала кнопку «Купить» и строку цены. Замер прода 28.08.2026.
        style={{ top: "var(--aevion-header-h, 0px)" }}
        className="border-b border-slate-800/60 px-5 py-3 backdrop-blur sticky top-0 z-30 bg-slate-950/60">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← AEVION</Link>
          <div className="flex items-center gap-3">
            <Link href="/qmaskcard/dashboard" className="text-xs text-slate-400 hover:text-white">Публичная статистика →</Link>
            <ModulePricingChip moduleId="qmaskcard" theme="dark" />
            <div className="text-xs font-mono tracking-[0.2em] text-amber-300">Q·MASKCARD</div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
        <div className="inline-block rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200 mb-5">
          Virtual masking · Antifraud · MVP
        </div>
        <h1 className="text-4xl sm:text-5xl font-light leading-tight tracking-tight mb-4">
          Real card{" "}
          <span className="bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent font-semibold">
            never leaves your wallet.
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl text-base sm:text-lg leading-relaxed">
          Каждая покупка — отдельная виртуальная маска с собственным лимитом, TTL
          и (опционально) привязкой к мерчанту. Утечка одной не открывает остальные.
          Single-use самоуничтожаются после первого charge. AI-фрод-скоринг на каждой авторизации.
        </p>
      </section>

      {/* Stats */}
      {stats && (
        <section className="mx-auto max-w-6xl px-5 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Active masks" value={stats.active_masks.toLocaleString()} />
            <Stat label="Total masks" value={stats.total_masks.toLocaleString()} />
            <Stat label="Authorized" value={stats.authorized_charges.toLocaleString()} accent />
            <Stat label="Declined" value={stats.declined_charges.toLocaleString()} />
            <Stat label="Volume" value={fmtMoney(stats.volume_cents, "USD")} />
          </div>
        </section>
      )}

      {msg && (
        <div className="mx-auto max-w-6xl px-5 mb-4">
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.startsWith("✓") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200" : "bg-rose-500/10 border border-rose-500/30 text-rose-200"}`}>
            {msg}
          </div>
        </div>
      )}

      {!authed ? (
        <section className="mx-auto max-w-3xl px-5 pb-12">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-8 text-center backdrop-blur">
            <div className="text-5xl mb-3">🪪</div>
            <h2 className="text-xl font-semibold mb-2">Войди, чтобы выпустить маску</h2>
            <p className="text-slate-400 mb-5 text-sm">Все маски привязаны к твоему AEVION-аккаунту. Реальный PAN никогда не сохраняется на нашей стороне.</p>
            <Link href="/auth" className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400">
              Войти →
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Create + Test charge */}
          <section className="mx-auto max-w-6xl px-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Create mask */}
            <form onSubmit={createMask} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
              <div className="text-sm font-semibold text-amber-200 mb-4">🪪 Выпустить маску</div>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Название (для тебя)">
                  <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={80}
                    placeholder="напр.: Netflix · Sept 2026"
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                </Field>
                <Field label="Тип">
                  <select value={kind} onChange={(e) => setKind(e.target.value as MaskKind)}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none">
                    {(Object.entries(KIND_LABEL) as Array<[MaskKind, string]>).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Лимит">
                    <div className="flex">
                      <input type="number" step="0.01" min="1" value={spendLimit} onChange={(e) => setSpendLimit(e.target.value)} required
                        className="flex-1 bg-slate-950/60 border border-slate-700 rounded-l-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                        className="bg-slate-900 border border-l-0 border-slate-700 rounded-r-lg px-2 text-sm">
                        <option>USD</option><option>EUR</option><option>KZT</option><option>RUB</option>
                      </select>
                    </div>
                  </Field>
                  <Field label="TTL (часов)">
                    <input type="number" min="1" max="8760" value={ttlHours} onChange={(e) => setTtlHours(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </Field>
                </div>
                {kind === "merchant-locked" && (
                  <Field label="Merchant">
                    <input value={lockedMerchant} onChange={(e) => setLockedMerchant(e.target.value)} required
                      placeholder="Netflix"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </Field>
                )}
                {kind === "category-locked" && (
                  <Field label="Category">
                    <input value={lockedCategory} onChange={(e) => setLockedCategory(e.target.value)} required
                      placeholder="streaming"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </Field>
                )}
              </div>
              <button type="submit" disabled={creating}
                className="mt-4 w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold disabled:opacity-50">
                {creating ? "…" : "Выпустить виртуалку"}
              </button>
            </form>

            {/* Test charge */}
            <form onSubmit={testCharge} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
              <div className="text-sm font-semibold text-amber-200 mb-4">⚡ Тест-чарж</div>
              <p className="text-xs text-slate-500 mb-3">Имитирует merchant-запрос для проверки лимитов и antifraud-скоринга.</p>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Mask">
                  <select value={chargeMaskId} onChange={(e) => setChargeMaskId(e.target.value)} required
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none">
                    <option value="">— выбери маску —</option>
                    {masks.filter(m => !m.revokedAt && !m.frozenAt).map(m => (
                      <option key={m.id} value={m.id}>{m.label} · {fmtMoney(m.remainingCents, m.currency)} left</option>
                    ))}
                  </select>
                </Field>
                <Field label="Сумма (USD)">
                  <input type="number" step="0.01" min="0.01" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} required
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                </Field>
                <Field label="Merchant (опц.)">
                  <input value={chargeMerchant} onChange={(e) => setChargeMerchant(e.target.value)}
                    placeholder="Netflix"
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                </Field>
                <Field label="Category (опц.)">
                  <input value={chargeCategory} onChange={(e) => setChargeCategory(e.target.value)}
                    placeholder="streaming"
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                </Field>
              </div>
              <button type="submit" disabled={charging || !chargeMaskId}
                className="mt-4 w-full py-2.5 rounded-lg bg-slate-800 border border-amber-500/40 text-amber-200 font-bold disabled:opacity-50 hover:bg-slate-700">
                {charging ? "…" : "Авторизовать"}
              </button>
            </form>
          </section>

          {/* My masks */}
          <section className="mx-auto max-w-6xl px-5 pb-8">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
              <div className="text-sm font-semibold text-amber-200 mb-4">🗂 Мои маски ({masks.length})</div>
              {masks.length === 0 ? (
                <div className="text-slate-500 text-center py-8 text-sm">Пока нет масок. Создай первую слева.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {masks.map((m) => {
                    const remaining = Number(m.remainingCents);
                    const limit = Number(m.spendLimitCents);
                    const pct = limit > 0 ? (remaining / limit) * 100 : 0;
                    const isRevoked = !!m.revokedAt;
                    const isFrozen = !isRevoked && !!m.frozenAt;
                    return (
                      <div key={m.id} className={`rounded-lg border ${isRevoked ? "border-slate-800 opacity-50" : isFrozen ? "border-sky-500/40" : "border-amber-500/30"} bg-slate-950/40 p-4`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                              {isFrozen && <span title="frozen">❄️</span>}{m.label}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{KIND_LABEL[m.kind]}</div>
                          </div>
                          {isRevoked ? (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">revoked</span>
                          ) : isFrozen ? (
                            <span className="text-[10px] bg-sky-500/15 border border-sky-500/30 text-sky-300 px-2 py-0.5 rounded">frozen</span>
                          ) : null}
                        </div>
                        <div className="font-mono text-xs text-slate-400 mb-3">{shortPan(m.virtualPan)}</div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-mono ${isFrozen ? "text-sky-300" : "text-emerald-300"}`}>{fmtMoney(remaining, m.currency)}</span>
                          <span className="text-slate-500">из {fmtMoney(limit, m.currency)}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                          <div className={`h-full ${isFrozen ? "bg-gradient-to-r from-sky-400 to-sky-500" : "bg-gradient-to-r from-emerald-400 to-amber-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        {(m.lockedToMerchant || m.lockedToCategory) && (
                          <div className="text-xs text-slate-500 mt-2">
                            🔒 {m.lockedToMerchant ?? m.lockedToCategory}
                          </div>
                        )}
                        {m.expiresAt && (
                          <div className="text-xs text-slate-500 mt-1">
                            истекает {new Date(m.expiresAt).toLocaleString()}
                          </div>
                        )}
                        {!isRevoked && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                            {isFrozen ? (
                              <button onClick={() => setFrozen(m.id, false)}
                                className="text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-300 px-2.5 py-1 rounded hover:bg-sky-500/30">
                                ▶ Разморозить
                              </button>
                            ) : (
                              <button onClick={() => setFrozen(m.id, true)}
                                className="text-[11px] bg-slate-800 border border-sky-500/30 text-sky-300 px-2.5 py-1 rounded hover:bg-sky-500/20">
                                ❄️ Заморозить
                              </button>
                            )}
                            <button onClick={() => editLimit(m)}
                              className="text-[11px] bg-slate-800 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded hover:bg-amber-500/20">
                              ✎ Лимит
                            </button>
                            <button onClick={() => revokeMask(m.id)}
                              className="text-[11px] bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded hover:bg-rose-500/30 ml-auto">
                              🗑 Отозвать
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Charges history */}
          {charges.length > 0 && (
            <section className="mx-auto max-w-6xl px-5 pb-8">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
                <div className="text-sm font-semibold text-amber-200 mb-4">📜 История чарджей</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-amber-500/20">
                        <th className="py-2 px-2 text-left">When</th>
                        <th className="py-2 px-2 text-left">Merchant</th>
                        <th className="py-2 px-2 text-right">Amount</th>
                        <th className="py-2 px-2 text-center">Status</th>
                        <th className="py-2 px-2 text-center">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.slice(0, 20).map((c) => (
                        <tr key={c.id} className="border-b border-white/5">
                          <td className="py-2 px-2 text-slate-400 text-xs">{new Date(c.createdAt).toLocaleString()}</td>
                          <td className="py-2 px-2">{c.merchantName ?? <span className="text-slate-600">—</span>}</td>
                          <td className="py-2 px-2 text-right font-mono">{fmtMoney(c.amountCents, c.currency)}</td>
                          <td className="py-2 px-2 text-center">
                            {c.status === "authorized" ? (
                              <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded">authorized</span>
                            ) : (
                              <span className="text-[10px] bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded" title={c.declineReason ?? ""}>
                                declined
                              </span>
                            )}
                          </td>
                          <td className={`py-2 px-2 text-center font-mono text-xs ${c.riskScore >= 60 ? "text-rose-300" : c.riskScore >= 30 ? "text-amber-300" : "text-emerald-300"}`}>
                            {c.riskScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Concept rail (preserved feature messaging) */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { t: "🪪 N виртуалок на 1 реальную", d: "Под каждый магазин/подписку — собственная маска. Реальный PAN не покидает наш слой." },
            { t: "🎯 Лимит per-card", d: "Каждая маска с лимитом и TTL. Утечка одной не открывает остальные." },
            { t: "💣 Self-destruct", d: "Single-use revoke'ятся автоматом после первого charge. Подписочный фрод невозможен." },
            { t: "🛡 AI antifraud", d: "Per-charge risk score (0-100) на основе amount/velocity/geo. Записывается в audit log." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 backdrop-blur">
              <div className="text-sm font-semibold text-amber-200 mb-1">{f.t}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800/60 px-5 py-6 mt-8">
        <div className="mx-auto max-w-6xl text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>AEVION · QMaskCard · meta-tokenization layer · not a card issuer</span>
          <span className="font-mono">/api/qmaskcard</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 text-center backdrop-blur">
      <div className={`text-xl font-bold font-mono ${accent ? "text-emerald-300" : "text-amber-300"}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
