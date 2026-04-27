"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";

function CancelInner() {
  const sp = useSearchParams();
  const tier = sp.get("tier");

  useEffect(() => {
    track({
      type: "checkout_cancel",
      tier: tier ?? undefined,
      source: "pricing",
    });
  }, [tier]);

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Все тарифы
        </Link>
      </div>

      <div
        style={{
          padding: 40,
          textAlign: "center",
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>↩</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em", color: "#0f172a" }}>
          Оплата отменена
        </h1>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0, marginBottom: 24, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          Никаких списаний не было. Если что-то не понравилось в чекауте или возникли вопросы по
          тарифу — напишите нам, разберёмся.
        </p>

        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {tier && (
            <Link
              href={`/pricing/${tier}`}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Вернуться к {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Link>
          )}
          <Link
            href="/pricing/contact"
            style={{
              padding: "12px 24px",
              background: "#0f172a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Связаться с продажами
          </Link>
          <Link
            href="/pricing"
            style={{
              padding: "12px 24px",
              background: "#f1f5f9",
              color: "#0f172a",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Все тарифы
          </Link>
        </div>
      </div>
    </ProductPageShell>
  );
}

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={null}>
      <CancelInner />
    </Suspense>
  );
}
