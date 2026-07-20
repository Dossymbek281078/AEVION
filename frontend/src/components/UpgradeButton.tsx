"use client";

import { useState } from "react";
import { gumroadCheckoutUrl } from "@/lib/gumroad";

// Единственный живой процессинг — Gumroad (Paddle/Stripe/LemonSqueezy не в
// primary). Кнопка ведёт на Gumroad-чекаут. Legacy-имя PaddleUpgradeButton
// реэкспортится из ./PaddleUpgradeButton для старых импортов (~11 модулей).

interface Props {
  tierId?: "pro" | "business";
  /** "button" — обычная кнопка, "banner" — полоса на всю ширину, "pill" — компактный */
  variant?: "button" | "banner" | "pill";
  /** Название приложения — пробрасывается в Gumroad URL для аналитики атрибуции */
  appId?: string;
  label?: string;
  className?: string;
}

export function UpgradeButton({
  tierId = "pro",
  variant = "button",
  appId = "platform",
  label,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    // Gumroad hosted checkout — единственный живой рельс.
    window.location.href = gumroadCheckoutUrl({ key: appId, tier: tierId });
  }

  const defaultLabel = "Разблокировать всё";
  const text = loading ? "Открываем оплату..." : (label ?? defaultLabel);

  if (variant === "banner") {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-gradient-to-r from-blue-600/20 to-violet-600/20 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">
              AEVION All-Access — $59/мес
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Все модули включены · Отмена в любой момент · Карта любого банка</div>
          </div>
          <button
            onClick={handleClick}
            disabled={loading}
            className="shrink-0 px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {text}
          </button>
        </div>
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
    </span>
  );
}
