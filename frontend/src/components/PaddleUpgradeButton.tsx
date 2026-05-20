"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

// Paddle Price IDs — production live
const PRICE_IDS: Record<string, string> = {
  pro:      "pri_01krzxq0t2rmy9erdv54c9ny3w", // $19/мес
  business: "pri_01krzy7zgqn32xc52qjbkfhvz0", // $49/мес
};

interface Props {
  tierId?: "pro" | "business";
  /** "button" — обычная кнопка, "banner" — полоса на всю ширину, "pill" — компактный */
  variant?: "button" | "banner" | "pill";
  /** Название приложения для атрибуции (appId в Paddle metadata) */
  appId?: string;
  label?: string;
  className?: string;
}

export function PaddleUpgradeButton({
  tierId = "pro",
  variant = "button",
  appId = "platform",
  label,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setNotice(null);
    try {
      const priceId = PRICE_IDS[tierId];
      const r = await fetch(apiUrl("/api/paddle/checkout"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId, appId, tierId }),
      });
      const j = await r.json();
      if (j.url) {
        window.location.href = j.url;
      } else if (j.error?.includes("checkout_not_enabled")) {
        setNotice("Платёжный шлюз проходит верификацию — будет доступен в течение 1-3 дней");
      } else {
        setNotice("Попробуйте позже или напишите нам на support@aevion.app");
      }
    } catch {
      setNotice("Нет соединения — проверьте интернет и попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  const defaultLabel = tierId === "pro" ? "Начать бесплатно — 14 дней" : "Попробовать Business";
  const text = loading ? "Загружаем..." : (label ?? defaultLabel);

  const noticeEl = notice ? (
    <p className="mt-2 text-xs text-amber-400/80 text-center">{notice}</p>
  ) : null;

  if (variant === "banner") {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-gradient-to-r from-blue-600/20 to-violet-600/20 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">
              {tierId === "pro" ? "AEVION Pro — $19/мес" : "AEVION Business — $49/мес"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">14 дней бесплатно · Отмена в любой момент · Карта любого банка</div>
          </div>
          <button
            onClick={handleClick}
            disabled={loading}
            className="shrink-0 px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {text}
          </button>
        </div>
        {noticeEl}
      </div>
    );
  }

  if (variant === "pill") {
    return (
      <span>
        <button
          onClick={handleClick}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-full transition-colors disabled:opacity-50 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          {text}
        </button>
        {noticeEl}
      </span>
    );
  }

  // default: button
  return (
    <span className={`inline-block ${className}`}>
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {text}
      </button>
      {noticeEl}
    </span>
  );
}
