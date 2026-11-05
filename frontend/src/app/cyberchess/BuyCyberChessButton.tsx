"use client";
/**
 * Кнопка «Купить CyberChess — $50/год» на первом экране лендингов Shorts
 * (/cyberchess/traps и /cyberchess/guide, ru/en/kk). 4.11.2026, задача
 * Оркестратора: до кассы Lemon Squeezy было 3 нажатия (лендинг → /pricing →
 * «Выбрать» → касса), стало 1 — кнопка сама открывает сессию кассы.
 *
 * Товар тот же, что продаёт /pricing?app=cyberchess: app=cyberchess, tierId=max
 * (12 месяцев; в магазине настроена только app_cyberchess_max — замер
 * /api/pricing/checkout/healthz 4.11). Цена из termPricing (CHESS_YEARLY_USD),
 * руками не пишется. Метка ролика ?c= уходит в тело запроса — бэкенд кладёт её
 * в custom data кассы, откуда вебхук и читает.
 *
 * Касса не ответила адресом — не тупик: ведём на /pricing?app=cyberchess с той
 * же меткой (прежний путь в 3 нажатия).
 */
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { channelNow } from "@/lib/channelNow";
import { withChannel } from "@/lib/products";
import { сКассойПартнёра } from "@/lib/lsAffiliate";
import { track } from "@/lib/track";
import { CHESS_YEARLY_USD } from "@/lib/termPricing";
import type { Yazyk } from "./traps/traps";

export const CHESS_CHECKOUT_BODY = { tierId: "max", app: "cyberchess", currency: "USD" } as const;
export const CHESS_PRICING_FALLBACK = "/pricing?app=cyberchess";
/** Запасной путь с меткой — руками, без keepChannel: в SSR тот метку не читает. */
export const fallbackHref = (channel: string): string => `${CHESS_PRICING_FALLBACK}&c=${encodeURIComponent(channel)}`;

export const BUY_LABEL: Record<Yazyk, string> = {
  ru: `Купить CyberChess — $${CHESS_YEARLY_USD}/год`,
  en: `Buy CyberChess — $${CHESS_YEARLY_USD}/year`,
  kk: `CyberChess сатып алу — жылына $${CHESS_YEARLY_USD}`,
};

const WAIT: Record<Yazyk, string> = { ru: "Открываем кассу…", en: "Opening checkout…", kk: "Касса ашылуда…" };

export function BuyCyberChessButton({ lang, source, fallbackChannel }: { lang: Yazyk; source: string; fallbackChannel: string }) {
  const [busy, setBusy] = useState(false);
  const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const channel = channelNow() ?? fallbackChannel;
    track({ type: "checkout_start", tier: CHESS_CHECKOUT_BODY.tierId, source, meta: { app: "cyberchess", channel } });
    let url: string | null = null;
    try {
      const r = await fetch(apiUrl("/api/pricing/checkout/session"), {
        method: "POST",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...CHESS_CHECKOUT_BODY, channel }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && typeof j?.url === "string" && j.url) url = сКассойПартнёра(withChannel(j.url, channel, source));
    } catch {
      url = null;
    }
    window.location.href = url ?? fallbackHref(channel);
  };
  return (
    <a
      href={fallbackHref(fallbackChannel)}
      onClick={onClick}
      data-testid={`buy-cyberchess-${source}`}
      aria-busy={busy}
      style={{ display: "inline-block", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none", background: "#16161a", color: "#fff" }}
    >
      {busy ? WAIT[lang] : BUY_LABEL[lang]}
    </a>
  );
}
