import { FREE_ACTIONS_PER_MONTH } from "@/lib/freeActionQuota";
import { planetFromPerMonth, planetPricePerMonth } from "@/lib/termPricing";
import { tq } from "./qrightI18n";

/**
 * Текст предложения после 402 free_quota_exceeded на /qright — на языке страницы.
 *
 * 🔴 30.10.2026, повод. Витрина показывала английское «Free registrations this
 * month are used up (4 of 3)» при любом языке страницы: текст был литералом в
 * разметке, а «used» бэкенд считает ВМЕСТЕ с отказанной попыткой — отсюда «4 из 3».
 * Теперь: перевод через tq (ключ — английская строка, как у всей страницы),
 * а показанное «использовано» не превышает норму: Math.min(used, норма).
 * Норма — из ответа бэкенда; не пришла (0/NaN) — копия числа из lib/freeActionQuota.ts.
 */
export function quotaOfferText(
  lang: string | undefined,
  quota: { used: number; freePerMonth: number },
): { headline: string; body: string } {
  const limit = quota.freePerMonth > 0 ? quota.freePerMonth : FREE_ACTIONS_PER_MONTH;
  const used = Math.min(Math.max(0, quota.used), limit);
  const headline = tq(lang, "Free registrations this month are used up ({used} of {limit}) — the subscription has no limit.")
    .replace("{used}", String(used))
    .replace("{limit}", String(limit));
  const body = tq(lang, "The AEVION Planet plan removes the limit and opens every app — from ${from}/mo on the 12-month term, ${month}/mo with no term.")
    .replace("{from}", String(planetFromPerMonth()))
    .replace("{month}", String(planetPricePerMonth("lite")));
  return { headline, body };
}
