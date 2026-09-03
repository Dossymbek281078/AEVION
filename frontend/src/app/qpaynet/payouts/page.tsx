"use client";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Payout {
  id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  method: "card" | "bank_transfer" | "kaspi";
  destination: string;
  status: "requested" | "approved" | "paid" | "rejected";
  rejected_reason: string | null;
  paid_external_ref: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

interface Wallet { id: string; name: string; balance: number; currency: string; }

const METHOD_KEY: Record<Payout["method"], string> = {
  card: "qpaynet.payouts.method.card",
  bank_transfer: "qpaynet.payouts.method.bank",
  kaspi: "qpaynet.payouts.method.kaspi",
};

const STATUS_CHIP: Record<Payout["status"], string> = {
  requested: "bg-amber-900 text-amber-300",
  approved:  "bg-blue-900 text-blue-300",
  paid:      "bg-emerald-900 text-emerald-300",
  rejected:  "bg-red-900 text-red-300",
};

const STATUS_KEY: Record<Payout["status"], string> = {
  requested: "qpaynet.payouts.status.requested",
  approved:  "qpaynet.payouts.status.approved",
  paid:      "qpaynet.payouts.status.paid",
  rejected:  "qpaynet.payouts.status.rejected",
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string, lang: string) {
  const localeTag = lang === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(localeTag, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PayoutsPage() {
  const { t, lang } = useI18n();
  const [token, setToken] = useState("");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Payout["method"]>("card");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  /**
   * Подписанный акт — основание выплаты.
   *
   * Прямая задача основателя 03.09.2026: «без подписи выплаты нет». Сервер
   * отказывает без него (422 с человеческим текстом), поэтому поле не
   * украшение: без выбора акта кнопка не должна даже пытаться.
   */
  const [signatureId, setSignatureId] = useState("");
  const [acts, setActs] = useState<Array<{ signatureId: string; at: string }>>([]);

  useEffect(() => {
    const saved = getAuthToken() ?? "";
    setToken(saved);
    if (!saved) { setLoading(false); return; }
    Promise.all([
      fetch(apiUrl("/api/qpaynet/payouts"), { headers: { Authorization: `Bearer ${saved}` } }).then(r => r.json()),
      fetch(apiUrl("/api/qpaynet/wallets"), { headers: { Authorization: `Bearer ${saved}` } }).then(r => r.json()),
    ]).then(([p, w]) => {
      setPayouts(p.payouts ?? []);
      setWallets(w.wallets ?? []);
      if (w.wallets?.[0]) setWalletId(w.wallets[0].id);
    }).finally(() => setLoading(false));

    // Подписанные акты — основания выплаты. Отдельным запросом, а не в
    // Promise.all выше: их отсутствие не должно мешать показать кошельки и
    // историю. Ручка отдаёт только подписи текущего пользователя.
    fetch(apiUrl("/api/qsign/v2/audit?event=sign&limit=20"), {
      headers: { Authorization: `Bearer ${saved}` },
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const items = (j.items ?? j.rows ?? []) as Array<{ signatureId?: string; at?: string }>;
        setActs(
          items
            .filter((x) => x.signatureId)
            .map((x) => ({ signatureId: String(x.signatureId), at: String(x.at ?? "") })),
        );
      })
      .catch(() => setActs([]));
  }, []);

  async function submit() {
    if (!walletId || !amount || !destination || !signatureId) return;
    setSubmitting(true); setError("");
    try {
      const r = await fetch(apiUrl("/api/qpaynet/payouts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletId, amount: parseFloat(amount), method, destination, signatureId }),
      });
      const d = await r.json();
      // Человеческий текст ВПЕРЁД кода. Сервер отдаёт `message` для человека
      // и `error` для машины; страница показывала код — то есть на отказ
      // выплаты человек увидел бы `act_signature_required` вместо «подпишите
      // акт в QSign». Тот же класс, что жаргон разработчика на витрине.
      if (!r.ok) throw new Error(d.message ?? d.error ?? t("qpaynet.payouts.err.generic"));
      const list = await fetch(apiUrl("/api/qpaynet/payouts"), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setPayouts(list.payouts ?? []);
      setAmount(""); setDestination("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qpaynet.payouts.err.generic"));
    } finally { setSubmitting(false); }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t("qpaynet.payouts.loginPrompt")}</p>
          <Link href="/auth" className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">{t("qpaynet.payouts.login")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">{t("qpaynet.payouts.title")}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Request form */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
          <h2 className="font-bold mb-1">{t("qpaynet.payouts.requestTitle")}</h2>
          <p className="text-xs text-slate-400 mb-3">
            {t("qpaynet.payouts.note")}
          </p>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.payouts.walletLabel")}</label>
            <select value={walletId} onChange={e => setWalletId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({fmt(w.balance)} {w.currency})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.payouts.methodLabel")}</label>
            <select value={method} onChange={e => setMethod(e.target.value as Payout["method"])}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              <option value="card">{t("qpaynet.payouts.opt.card")}</option>
              <option value="bank_transfer">{t("qpaynet.payouts.opt.bank")}</option>
              <option value="kaspi">{t("qpaynet.payouts.opt.kaspi")}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {method === "card" ? t("qpaynet.payouts.dest.card") : method === "kaspi" ? t("qpaynet.payouts.dest.kaspi") : t("qpaynet.payouts.dest.iban")}
            </label>
            <input value={destination} onChange={e => setDestination(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.payouts.amountLabel")}</label>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
            {amount && parseFloat(amount) > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                {t("qpaynet.payouts.feeHint", { fee: fmt(parseFloat(amount) * 0.001), total: fmt(parseFloat(amount) * 1.001) })}
              </p>
            )}
          </div>
          {/*
            Основание выплаты. Сервер отказывает без него (422 с человеческим
            текстом), поэтому поле обязательное, а кнопка без выбора не
            нажимается: показать отказ там, где его можно предотвратить, —
            это перекладывание нашей проверки на человека.
          */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.payouts.actLabel")}</label>
            {acts.length === 0 ? (
              <p className="text-[11px] text-amber-400">{t("qpaynet.payouts.actNone")}</p>
            ) : (
              <select
                value={signatureId}
                onChange={e => setSignatureId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t("qpaynet.payouts.actPick")}</option>
                {acts.map(a => (
                  <option key={a.signatureId} value={a.signatureId}>
                    {a.signatureId.slice(0, 12)} · {a.at.slice(0, 10)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={submitting || !amount || !destination || !signatureId}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
            {submitting ? "..." : t("qpaynet.payouts.submit")}
          </button>
        </div>

        {/* History */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("qpaynet.payouts.history", { count: payouts.length })}</h3>
          {loading && <div className="text-slate-500 text-sm py-8 text-center">{t("qpaynet.payouts.loading")}</div>}
          {!loading && payouts.length === 0 && <div className="text-slate-600 text-sm py-8 text-center">{t("qpaynet.payouts.empty")}</div>}
          <div className="space-y-2">
            {payouts.map(p => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_CHIP[p.status]}`}>{t(STATUS_KEY[p.status])}</span>
                      <span className="text-[10px] text-slate-500">{t(METHOD_KEY[p.method])}</span>
                      <span className="text-[10px] text-slate-600">{fmtDate(p.created_at, lang)}</span>
                    </div>
                    <div className="text-base font-bold">{fmt(p.amount)} {p.currency}</div>
                    <div className="text-[11px] text-slate-500 font-mono">→ {p.destination}</div>
                    {p.rejected_reason && <div className="text-[11px] text-red-400 mt-1">⚠ {p.rejected_reason}</div>}
                    {p.paid_external_ref && p.status === "paid" && (
                      <div className="text-[11px] text-emerald-500 mt-1">ref: {p.paid_external_ref}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
