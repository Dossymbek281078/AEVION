"use client";

import { естьСледОплаты } from "@/lib/paymentTrace";
import { вспомнитьНамерение, тарифИзСсылки } from "@/lib/checkoutIntent";
import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

function CancelInner() {
  const tp = usePricingT();
  const sp = useSearchParams();
  /*
   * Тариф берём по убыванию точности, и порядок здесь не вкусовой.
   *
   * Адрес всегда точнее памяти вкладки: он описывает ИМЕННО эту оплату. Память
   * — запасной путь, потому что кассы тариф в адрес отмены не кладут вовсе:
   * PayBox и PayPal возвращают человека с одной меткой кассы. Замер отрисовкой
   * 02.09 показал, что из-за этого кнопка «вернуться к тарифу» не появлялась
   * НИКОГДА, а события отказа уходили без тарифа — по ним нельзя было сказать,
   * от какого тарифа отказываются.
   *
   * `ref` стоит вторым и сегодня не срабатывает: его в адресе отмены тоже нет.
   * Он здесь потому, что строка для касс уже передана владельцу их файла, и
   * когда она появится, адрес молча начнёт побеждать память — как и должен.
   */
  const tier =
    sp.get("tier") ?? тарифИзСсылки(sp.get("ref")) ?? вспомнитьНамерение()?.tier ?? null;

  /*
   * Тот же признак, что на экране «оплата принята», и НАМЕРЕННО тот же.
   *
   * Адрес публичный, событие уходило при любом открытии. Для отказа это тише,
   * чем для покупки, но хуже по-своему: покупки теперь отфильтрованы, а отказы
   * остались бы завышенными — и видимая доля доводящих оплату до конца стала бы
   * хуже настоящей. По такому числу решают «воронка плохая», и чинили бы
   * несуществующее.
   *
   * Проверено, что фильтр не теряет НАСТОЯЩИЕ отказы: адрес отмены задают
   * только две кассы — PayBox (`pg_failure_url` c `?paybox=1`) и PayPal
   * (`cancel_url` c `?paypal=1`), и обе несут метку. У LemonSqueezy и Gumroad
   * адрес отмены не настроен вовсе, то есть их отказ до этой страницы и не
   * доходит. Настроят — метку сюда добавить обязательно, иначе отказ станет
   * невидимым.
   */
  const касса =
    sp.get("provider") ??
    (sp.get("paypal") ? "paypal" : null) ??
    (sp.get("paybox") ? "paybox" : null);
  const следОплаты = естьСледОплаты({
    provider: касса,
    ref: sp.get("ref") ?? sp.get("session_id"),
    total: sp.get("total") ? Number(sp.get("total")) / 100 : null,
  });

  // Защёлка: в режиме разработки React вызывает эффект дважды, и без неё один
  // отказ считался бы за два. Приём взят у соседнего окна, которое чинило это
  // же место параллельно; там он был, у меня нет.
  const ужеОтмечено = useRef(false);

  useEffect(() => {
    if (!следОплаты || ужеОтмечено.current) return;
    ужеОтмечено.current = true;
    track({
      type: "checkout_cancel",
      tier: tier ?? undefined,
      source: "pricing",
      // Касса в мете — тоже их находка: без неё видно, что отказ был, но не
      // видно, у какой кассы люди отваливаются, а это разные починки.
      meta: { provider: касса },
    });
  }, [tier, следОплаты, касса]);

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {tp("back.allTiers")}
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
          {tp("checkout.cancel.title")}
        </h1>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0, marginBottom: 24, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          {tp("checkout.cancel.body")}
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
              {tp("checkout.cancel.return")} {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Link>
          )}
          <Link
            // Тема отличает обращение отказавшегося от оплаты от любого
            // другого: этот разговор — единственное место, где ещё можно
            // узнать причину отказа, и считать его вместе с прочими значит
            // не считать вовсе.
            href="/pricing/contact?topic=cancel"
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
            {tp("checkout.cancel.contact")}
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
            {tp("checkout.cancel.allTiers")}
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
