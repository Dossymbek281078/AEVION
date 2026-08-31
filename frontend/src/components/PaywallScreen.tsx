import Link from "next/link";
import { KeepChannelLink } from "./KeepChannelLink";
import { tierLabel, type PaywallPayload, type CanonicalTier } from "@/lib/paywall";

/**
 * Reusable blocking screen rendered when the backend returns a 402
 * upgrade_required response (see lib/paywall.ts). RSC-friendly — no client
 * state needed; it's a pure presentation component over the payload.
 *
 * Visual contract:
 *   - clear module name + current plan
 *   - required tiers as visible chips
 *   - primary CTA → /pricing (anchored to the tier the user needs)
 *   - secondary "Back" link to the module's hub
 *
 * Pair with <PaywallScreen> in any RSC page that calls fetchOrPaywall().
 */

/**
 * Акценты тарифов — 700-оттенки, потому что экран светлый.
 *
 * Раньше здесь стояли яркие 400/500 (#06b6d4, #f59e0b, #34d399): они читались
 * на тёмном фоне `#0f172a`, но этот же цвет используется КАК ТЕКСТ на подложке
 * `${color}22` и как фон кнопки под белым текстом. После перевода экрана в
 * светлую схему (2026-07-26) amber на белом давал ~2:1 при норме WCAG AA 4.5:1
 * — то есть «просто поменять фон» означало бы отдать нечитаемую страницу тем,
 * кому и так отказали в доступе. Значения подобраны под светлый фон.
 */
const TIER_ACCENT: Record<CanonicalTier, string> = {
  free: "#64748b",
  lite: "#0e7490",
  medium: "#6d28d9",
  full: "#b45309",
  enterprise: "#047857",
};

interface Props {
  payload: PaywallPayload;
  /** Optional hub path to link back to (e.g. "/modules"). Default: "/". */
  backHref?: string;
  /** Optional override label for the back link. */
  backLabel?: string;
}

export function PaywallScreen({ payload, backHref = "/", backLabel = "← На главную" }: Props) {
  const { module, plan, requiredTiers, upgradeUrl } = payload;
  const primaryTier = requiredTiers[0] ?? "full";
  const accent = TIER_ACCENT[primaryTier] ?? "#f59e0b";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <Link
          href={backHref}
          style={{ fontSize: 12, color: "#64748b", textDecoration: "none", display: "inline-block", marginBottom: 24 }}
        >
          {backLabel}
        </Link>

        <div
          aria-hidden
          style={{
            fontSize: 48,
            lineHeight: 1,
            marginBottom: 16,
            filter: "grayscale(0.2)",
          }}
        >
          🔒
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 12px", lineHeight: 1.15 }}>
          Модуль «{module}» доступен на старших тарифах
        </h1>

        <p style={{ fontSize: 14, color: "#475569", margin: "0 0 24px", lineHeight: 1.5 }}>
          Ваш текущий план — <strong style={{ color: "#0f172a" }}>{tierLabel(plan)}</strong>.
          Чтобы открыть {module}, выберите один из тарифов ниже.
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 28,
          }}
          aria-label="Доступные тарифы"
        >
          {requiredTiers.map((t) => {
            const color = TIER_ACCENT[t] ?? "#94a3b8";
            return (
              <span
                key={t}
                style={{
                  padding: "6px 14px",
                  background: `${color}22`,
                  border: `1px solid ${color}66`,
                  color,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {tierLabel(t)}
              </span>
            );
          })}
        </div>

        {/*
          Метка канала переживает переход к тарифам.

          Экран платной стены видит КАЖДЫЙ, кто пришёл в закрытый модуль без
          оплаты — это десять страниц. Ссылка «выбрать тариф» ведёт на /pricing,
          а та с 31.08 читает метку и доводит её до кассы. Без переноса метка
          терялась ровно перед страницей, которая её ждёт.
        */}
        <KeepChannelLink
          href={upgradeUrl}
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: accent,
            color: "#fff",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: `0 8px 24px -8px ${accent}99`,
          }}
        >
          Перейти к тарифам →
        </KeepChannelLink>

        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 28, lineHeight: 1.5 }}>
          Уже оплатили? <Link href="/account" style={{ color: "#0d9488", textDecoration: "underline" }}>Проверьте статус подписки</Link>
        </p>
      </div>
    </main>
  );
}
