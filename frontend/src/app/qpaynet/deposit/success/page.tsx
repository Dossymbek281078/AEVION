"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface CheckoutMeta {
  id: string;
  wallet_id: string;
  amount: number;
  provider: "stripe" | "stub";
  status: "open" | "paid" | "expired" | "failed";
  tx_id: string | null;
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SuccessInner() {
  const params = useSearchParams();
  const router = useRouter();
  const cid = params.get("cid") ?? "";
  const isStub = params.get("stub") === "1";
  const [meta, setMeta] = useState<CheckoutMeta | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!cid) { setError("cid не указан"); return; }
    const t = localStorage.getItem("aevion_token") ?? "";
    if (!t) { setError("Войдите для проверки"); return; }
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      const r = await fetch(`/api/qpaynet/deposit/checkout/${cid}`, { headers: { Authorization: `Bearer ${t}` } });
      if (cancelled) return;
      if (!r.ok) { setError("Не найдено"); return; }
      const d = await r.json();
      setMeta(d);
      if (d.status === "open" && attempts < 10) {
        attempts++;
        setTimeout(poll, 1500);
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [cid]);

  async function confirmStub() {
    setConfirming(true);
    const t = localStorage.getItem("aevion_token") ?? "";
    const r = await fetch("/api/qpaynet/deposit/confirm-stub", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ id: cid }),
    });
    if (r.ok) {
      const meta2 = await fetch(`/api/qpaynet/deposit/checkout/${cid}`, { headers: { Authorization: `Bearer ${t}` } });
      if (meta2.ok) setMeta(await meta2.json());
    }
    setConfirming(false);
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-slate-400">{error}</p>
        <Link href="/qpaynet" className="text-violet-400 text-sm underline mt-4 inline-block">← К кошельку</Link>
      </div>
    );
  }

  if (!meta) return <div className="text-center py-20 text-slate-500 text-sm">Проверяем платёж...</div>;

  return (
    <div className="max-w-md mx-auto py-16 px-6 text-center">
      {meta.status === "paid" ? (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Пополнено</h1>
          <p className="text-slate-300 text-lg mb-6">+{fmt(meta.amount)} ₸ на ваш кошелёк</p>
          <button onClick={() => router.push("/qpaynet")}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">
            ← К кошельку
          </button>
        </>
      ) : isStub && meta.status === "open" ? (
        <>
          <div className="text-5xl mb-4">🧪</div>
          <h1 className="text-2xl font-bold mb-2">Stub-режим</h1>
          <p className="text-slate-400 text-sm mb-6">
            STRIPE_SECRET_KEY не настроен. Нажмите чтобы симулировать оплату {fmt(meta.amount)} ₸.
          </p>
          <button onClick={confirmStub} disabled={confirming}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
            {confirming ? "..." : "Симулировать оплату"}
          </button>
        </>
      ) : (
        <>
          <div className="text-5xl mb-4">⏱</div>
          <h1 className="text-xl font-bold mb-2">Ожидаем подтверждения</h1>
          <p className="text-slate-400 text-sm">Provider: {meta.provider}, status: {meta.status}</p>
        </>
      )}
    </div>
  );
}

export default function DepositSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
      </header>
      <Suspense><SuccessInner /></Suspense>
    </div>
  );
}
