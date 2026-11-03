"use client";

import { useI18nOptional } from "@/lib/i18n";

/**
 * Гость кончил бесплатные запуски /qcoreai/multi — что ему показать.
 *
 * 3.11.2026, путь из Shorts 4.11 («один вопрос — несколько моделей»): после
 * двух запусков сервер отвечает 402 guest_quota_exhausted, а страница клала
 * в красную плашку ERROR двуязычный текст и адрес входа СЫРЫМ текстом
 * («…sign in to continue. /auth?next=/qcoreai/multi») — не ссылкой, без
 * тарифов. На всей странице не было ни одной дороги к оплате: человек с
 * ролика упирался в стену без двери.
 *
 * Здесь две двери: вход (норма продолжится, ?c= ролика не теряется — вход
 * возвращает на тот же адрес) и тарифы Мультичата.
 */

export type GuestWall = { loginHref: string; pricingHref: string };

export const PRICING_HREF = "/pricing?app=multichat";

/** null — это не стена гостя (другая 402 или другая ошибка). */
export function guestWallFrom(status: number, body: unknown, here: string): GuestWall | null {
  if (status !== 402) return null;
  const b = (body ?? {}) as { error?: unknown };
  if (b.error !== "guest_quota_exhausted") return null;
  // Сервер шлёт /auth?next=/qcoreai/multi без строки запроса — метка ролика
  // терялась бы на входе. Возвращаем на ТОТ ЖЕ адрес, что открыт.
  const next = here.startsWith("/") && !here.startsWith("//") ? here : "/qcoreai/multi";
  return { loginHref: `/auth?next=${encodeURIComponent(next)}`, pricingHref: PRICING_HREF };
}

const TEXT = {
  ru: {
    title: "Бесплатные запуски без входа на сегодня кончились",
    body: "Войдите по почте — бесплатная норма продолжится. Нужно больше — тарифы Мультичата.",
    login: "Войти по почте",
    pricing: "Тарифы Мультичата",
  },
  en: {
    title: "Free guest runs for today are used up",
    body: "Sign in with email to keep your free allowance. Need more — see Multichat plans.",
    login: "Sign in with email",
    pricing: "Multichat plans",
  },
};

export function GuestQuotaWall({ wall }: { wall: GuestWall }) {
  const lang = useI18nOptional()?.lang;
  const t = lang === "ru" || lang === "kk" ? TEXT.ru : TEXT.en;
  return (
    <div
      role="alert"
      data-guest-wall
      style={{
        background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.3)",
        borderRadius: 12, padding: "12px 14px", marginBottom: 10, fontSize: 13,
        color: "#0f172a", overflowWrap: "anywhere",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.title}</div>
      <div style={{ color: "#475569", marginBottom: 10 }}>{t.body}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href={wall.loginHref}
          data-guest-wall-login
          style={{ padding: "8px 14px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 800, textDecoration: "none" }}
        >
          {t.login}
        </a>
        <a
          href={wall.pricingHref}
          data-guest-wall-pricing
          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", fontWeight: 700, textDecoration: "none" }}
        >
          {t.pricing}
        </a>
      </div>
    </div>
  );
}
