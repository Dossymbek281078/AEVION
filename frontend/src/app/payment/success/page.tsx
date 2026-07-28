"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";

/**
 * Куда LemonSqueezy возвращает человека после оплаты.
 *
 * 28.07.2026 этого маршрута не существовало: провайдер задаёт
 * `redirect_url: ${base}/payment/success?intentId=...`
 * (`aevion-globus-backend/src/lib/payment/lemonSqueezyProvider.ts:134`), а
 * https://aevion.app/payment/success отвечал 404 — замерено curl'ом. То есть
 * последним экраном оплаты у заплатившего человека была страница «не найдено».
 * PayBox возвращал на живой `/pricing/checkout/success`, поэтому дыра была
 * ровно у основного процессинга.
 *
 * Чего эта страница НЕ делает: не утверждает, что оплата подтверждена. Ручки,
 * которая по intentId сказала бы «списано», в бэкенде нет — доступ выдаёт
 * вебхук. Писать «оплата подтверждена» без такой проверки значило бы повторить
 * тот же класс ошибки, из-за которого убрали заглушку чекаута.
 */
function PaymentSuccessInner() {
  const sp = useSearchParams();
  const intentId = sp.get("intentId");

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          ← Цены
        </Link>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>
          Оплата отправлена процессингу
        </h1>
        <p style={{ fontSize: 15, color: "#475569", margin: "0 0 20px", lineHeight: 1.6 }}>
          Платёж принят на стороне LemonSqueezy. Доступ включается автоматически, когда
          процессинг подтвердит оплату — обычно в течение минуты. Письмо с чеком придёт
          от LemonSqueezy на почту, указанную при оплате.
        </p>

        {intentId && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 13,
              color: "#334155",
              marginBottom: 20,
              wordBreak: "break-all",
            }}
          >
            Номер платежа для обращения в поддержку:{" "}
            <strong style={{ fontFamily: "ui-monospace, monospace" }}>{intentId}</strong>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/apps"
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Открыть модули
          </Link>
          <Link
            href="/pricing/contact"
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Доступ не появился — написать нам
          </Link>
        </div>
      </div>
    </ProductPageShell>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessInner />
    </Suspense>
  );
}
