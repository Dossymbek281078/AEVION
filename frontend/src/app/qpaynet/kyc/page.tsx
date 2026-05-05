"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface KycStatus {
  status: "none" | "pending" | "verified" | "rejected";
  fullName?: string;
  iinMasked?: string;
  address?: string;
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  thresholdKzt: number;
  monthlyOutgoingKzt: number;
  remainingKztBeforeKycRequired: number;
  autoVerifyEnabled?: boolean;
}

const STATUS_CHIP: Record<KycStatus["status"], string> = {
  none:     "bg-slate-800 text-slate-400",
  pending:  "bg-amber-900 text-amber-300",
  verified: "bg-emerald-900 text-emerald-300",
  rejected: "bg-red-900 text-red-300",
};

const STATUS_LABEL: Record<KycStatus["status"], string> = {
  none:     "Не подавался",
  pending:  "На проверке",
  verified: "Верифицирован",
  rejected: "Отклонён",
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function KycPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [iin, setIin] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    refresh(t).finally(() => setLoading(false));
  }, []);

  async function refresh(t: string) {
    const r = await fetch("/api/qpaynet/kyc/status", { headers: { Authorization: `Bearer ${t}` } });
    if (r.ok) setData(await r.json());
  }

  async function submit() {
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/qpaynet/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName, iin, address }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ошибка");
      await refresh(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Войдите чтобы пройти KYC</p>
          <Link href="/auth" className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">→ Войти</Link>
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
          <h1 className="text-sm font-bold">KYC верификация</h1>
        </div>
        {data && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_CHIP[data.status]}`}>
            {STATUS_LABEL[data.status]}
          </span>
        )}
      </header>

      <div className="max-w-md mx-auto px-6 py-8 space-y-5">
        {loading && <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>}

        {!loading && data && (
          <>
            {/* Stats */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="text-xs text-slate-400">Месячный лимит без KYC</div>
              <div className="text-2xl font-black text-white">{fmt(data.thresholdKzt)} ₸</div>
              <div className="text-xs text-slate-400">
                Использовано: <span className="text-amber-400 font-semibold">{fmt(data.monthlyOutgoingKzt)} ₸</span>
                {" · "}
                осталось: <span className="text-emerald-400 font-semibold">{fmt(data.remainingKztBeforeKycRequired)} ₸</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(100, (data.monthlyOutgoingKzt / data.thresholdKzt) * 100)}%` }}
                />
              </div>
            </div>

            {data.status === "verified" && (
              <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
                <div className="text-emerald-400 font-bold mb-1">✓ Верифицирован</div>
                <div className="text-xs text-emerald-300/80">
                  {data.fullName} · {data.iinMasked} · {data.verifiedAt && new Date(data.verifiedAt).toLocaleDateString("ru-RU")}
                </div>
                <p className="text-[11px] text-emerald-400/60 mt-2">Месячный лимит снят. Все суммы доступны.</p>
              </div>
            )}

            {data.status === "pending" && (
              <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4">
                <div className="text-amber-400 font-bold mb-1">⏱ На проверке</div>
                <div className="text-xs text-amber-300/80">
                  Подано: {data.submittedAt && new Date(data.submittedAt).toLocaleString("ru-RU")}
                </div>
                <p className="text-[11px] text-amber-400/60 mt-2">Обычно занимает 1-3 рабочих дня.</p>
              </div>
            )}

            {data.status === "rejected" && data.rejectedReason && (
              <div className="bg-red-950/40 border border-red-800 rounded-xl p-4">
                <div className="text-red-400 font-bold mb-1">✗ Отклонён</div>
                <div className="text-xs text-red-300/80">{data.rejectedReason}</div>
              </div>
            )}

            {(data.status === "none" || data.status === "rejected") && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
                <h2 className="font-bold">Подать данные</h2>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">ФИО (как в удостоверении)</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Иванов Иван Иванович"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">ИИН (12 цифр)</label>
                  <input value={iin} onChange={e => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="000000000000" inputMode="numeric"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Адрес проживания (опционально)</label>
                  <input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="г. Алматы, ул..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button onClick={submit} disabled={submitting || !fullName || iin.length !== 12}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg font-semibold text-sm">
                  {submitting ? "Отправка..." : "Подать на верификацию"}
                </button>
                {data.autoVerifyEnabled && (
                  <p className="text-[11px] text-amber-400/70">⚙ Dev: QPAYNET_KYC_AUTO_VERIFY=1 — мгновенная верификация без ручной проверки.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
