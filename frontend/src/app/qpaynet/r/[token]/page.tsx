"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface RequestMeta {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  expiresAt: string | null;
  paidAt: string | null;
}

interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance: number;
}

function formatKzt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2 }) + " ₸";
}

export default function PayRequestPage() {
  const { t, lang } = useI18n();
  const localeTag = lang === "en" ? "en-US" : "ru-RU";
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<RequestMeta | null>(null);
  const [stage, setStage] = useState<"loading" | "ready" | "paid" | "expired" | "error">("loading");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromWalletId, setFromWalletId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ newBalance: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("aevion_token"));
    fetch(`/api/qpaynet/requests/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setStage("error"); return; }
        setMeta(d);
        if (d.status === "paid") { setStage("paid"); return; }
        if (d.status === "cancelled" || d.status === "expired") { setStage("expired"); return; }
        setStage("ready");
      })
      .catch(() => setStage("error"));
  }, [token]);

  useEffect(() => {
    if (stage !== "ready") return;
    const auth = localStorage.getItem("aevion_token") ?? "";
    if (!auth) return;
    fetch(apiUrl("/api/qpaynet/wallets"), { headers: { Authorization: `Bearer ${auth}` } })
      .then((r) => r.json())
      .then((d) => {
        const ws = (d.wallets ?? []).filter((w: Wallet) => w.currency === (meta?.currency ?? "KZT"));
        setWallets(ws);
        if (ws.length > 0) setFromWalletId(ws[0].id);
      })
      .catch(() => {});
  }, [stage, meta?.currency]);

  async function handlePay() {
    const auth = localStorage.getItem("aevion_token") ?? "";
    if (!auth) { setError(t("qpaynet.pay.err.auth")); return; }
    if (!fromWalletId) { setError(t("qpaynet.pay.err.noWallet")); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/qpaynet/requests/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ fromWalletId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? t("qpaynet.pay.err.payFail"));
      setSuccess({ newBalance: d.newBalance });
      setStage("paid");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qpaynet.pay.err.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💸</div>
          <p className="text-sm">{t("qpaynet.pay.loading")}</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2">{t("qpaynet.pay.notFoundTitle")}</h1>
          <Link href="/qpaynet" className="text-violet-400 hover:text-violet-300 text-sm underline">← QPayNet</Link>
        </div>
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold mb-2">{t("qpaynet.pay.expiredTitle")}</h1>
          <p className="text-slate-400 text-sm mb-4">
            {meta?.status === "cancelled" ? t("qpaynet.pay.cancelledMsg") : t("qpaynet.pay.expiredMsg")}
          </p>
          <Link href="/qpaynet" className="text-violet-400 hover:text-violet-300 text-sm underline">← QPayNet</Link>
        </div>
      </div>
    );
  }

  if (stage === "paid" && meta) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-black mb-2">{t("qpaynet.pay.paidTitle")}</h1>
          <p className="text-slate-400 text-sm mb-2">{formatKzt(meta.amount)}</p>
          <p className="text-slate-500 text-sm mb-6">{meta.description}</p>
          {success && (
            <p className="text-emerald-400 text-sm mb-4">
              {t("qpaynet.pay.balanceLeft")} {formatKzt(success.newBalance)}
            </p>
          )}
          <Link
            href="/qpaynet"
            className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-semibold text-sm transition-colors"
          >
            {t("qpaynet.pay.toWallet")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💸</div>
          <h1 className="text-2xl font-black mb-1">{t("qpaynet.pay.title")}</h1>
          <p className="text-slate-500 text-xs">{t("qpaynet.pay.subtitle")}</p>
        </div>
        {meta && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
            <div className="text-center mb-4">
              <p className="text-3xl font-black text-white">{formatKzt(meta.amount)}</p>
              <p className="text-slate-400 text-sm mt-1">{meta.description}</p>
            </div>
            {meta.expiresAt && (
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-3 py-2 text-xs text-amber-300 text-center">
                ⏱ {t("qpaynet.pay.validUntil")} {new Date(meta.expiresAt).toLocaleString(localeTag)}
              </div>
            )}
          </div>
        )}
        {!isLoggedIn ? (
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-4">{t("qpaynet.pay.loginPrompt")}</p>
            <Link
              href={`/auth?redirect=/qpaynet/r/${token}`}
              className="block w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-semibold text-sm text-center transition-colors"
            >
              {t("qpaynet.pay.loginBtn")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {wallets.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-4">
                {t("qpaynet.pay.noWallets")}{" "}
                <Link href="/qpaynet" className="text-violet-400 underline">{t("qpaynet.pay.createWallet")}</Link>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t("qpaynet.pay.fromLabel")}</label>
                <select
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {formatKzt(w.balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={submitting || wallets.length === 0 || !fromWalletId}
              className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
            >
              {submitting ? t("qpaynet.pay.processing") : `${t("qpaynet.pay.payBtn")} ${meta ? formatKzt(meta.amount) : ""}`}
            </button>
            <p className="text-center text-xs text-slate-600">
              {t("qpaynet.pay.feeNote")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
