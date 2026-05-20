"use client";

import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";

const PLANS = [
  {
    priceId: "pri_01krzxq0t2rmy9erdv54c9ny3w",
    name: "Pro",
    price: "$19",
    period: "/ month",
    annual: false,
    highlight: true,
    trial: "14 days free",
    features: [
      "Unlimited QCoreAI runs",
      "50 GB QMedia storage",
      "AI Memory",
      "API keys",
      "Advanced analytics",
      "Priority support",
      "Organizations",
    ],
  },
  {
    priceId: "pri_01krzyf5trnvptmpwdxz570mpf",
    name: "Pro Annual",
    price: "$192",
    period: "/ year",
    annual: true,
    highlight: false,
    trial: "14 days free · save 16%",
    features: [
      "Everything in Pro",
      "2 months free",
      "Annual invoice",
    ],
  },
  {
    priceId: "pri_01krzy7zgqn32xc52qjbkfhvz0",
    name: "Business",
    price: "$49",
    period: "/ month",
    annual: false,
    highlight: false,
    trial: "14 days free",
    features: [
      "Everything in Pro",
      "Custom AI models",
      "SLA 99.9%",
      "Dedicated support",
      "Custom integrations",
      "On-premise option",
    ],
  },
];

export default function PaddlePricingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(priceId: string) {
    setError(null);
    setLoading(priceId);
    try {
      const base = BACKEND ? `${BACKEND}/api/paddle` : "/api/paddle";
      const res = await fetch(`${base}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, email: email || undefined, appId: "platform" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Ошибка создания checkout");
      }
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Работает для Казахстана · Paddle Billing
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Тарифы AEVION</h1>
          <p className="text-gray-400 max-w-md mx-auto">
            14 дней бесплатно на любом тарифе. Отмена в любой момент. Оплата картой любого банка.
          </p>
        </div>

        {/* Email input */}
        <div className="flex justify-center mb-8">
          <input
            type="email"
            placeholder="your@email.com (необязательно)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.priceId}
              className={`relative rounded-2xl p-6 border ${
                plan.highlight
                  ? "bg-blue-600/10 border-blue-500/40"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-blue-500 text-white font-semibold">
                  Популярный
                </div>
              )}

              <div className="mb-4">
                <div className="text-sm font-medium text-gray-400 mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <div className="text-xs text-green-400 mt-1">{plan.trial}</div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.priceId)}
                disabled={loading === plan.priceId}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  plan.highlight
                    ? "bg-blue-500 hover:bg-blue-400 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.priceId ? "Загружаем..." : `Начать — ${plan.trial.split("·")[0].trim()}`}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6 text-center text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {error}
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-8">
          Платежи обрабатывает Paddle — Merchant of Record. Поддерживаются карты Visa, Mastercard, American Express.
          Выплаты производятся на KZ банковский счёт.
        </p>
      </div>
    </div>
  );
}
