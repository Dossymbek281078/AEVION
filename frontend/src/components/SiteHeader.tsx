"use client";

import Link from "next/link";
import { getBackendOrigin } from "@/lib/apiBase";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PlatformAiSavings from "@/components/PlatformAiSavings";
import RevenueGoalBadge from "@/components/RevenueGoalBadge";
import AiOfflineToggle from "@/components/AiOfflineToggle";

export function SiteHeader() {
  const origin = getBackendOrigin();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>AEVION</span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            Trust · IP · Globus
          </span>
        </Link>

        {/* Шапка на телефоне занимала ~200 точек из 844 — пять рядов ссылок,
            и под ними на /demo ещё восемь строк перечня модулей до первого
            содержательного слова. Замерено 09.08.2026 на 390×844.

            Тринадцать ссылок и три бейджа в одной строке с переносом дают эти
            пять рядов автоматически. Поэтому на узком экране остаётся то, ради
            чего человек пришёл: логотип, три главных перехода и переключатель
            языка. Остальное — на /explore, это и есть каталог, и он в один
            тап от кнопки Explore, которая никуда не делась.

            Сделано чистым CSS без состояния и без JS: любое раскрывающееся
            меню на React здесь означало бы риск рассинхрона при гидрации,
            а шапка рисуется на каждой странице. */}
        <style>{`
          @media (max-width: 900px) {
            .aev-nav-secondary { display: none !important; }
          }
        `}</style>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <Link href="/demo" style={{ padding: "5px 10px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12, color: "#fff", background: "linear-gradient(135deg, #0d9488, #0ea5e9)" }}>
            Demo
          </Link>
          <Link href="/explore" style={{ padding: "5px 10px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12, color: "#1a1205", background: "linear-gradient(135deg, #a9761f, #e6b24a)" }}>
            Explore
          </Link>
          <Link href="/shop" style={{ padding: "5px 10px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12, color: "#fff", background: "linear-gradient(135deg, #059669, #10b981)" }}>
            Shop
          </Link>
          {[
            { href: "/auth", label: "Auth" },
            { href: "/qright", label: "QRight" },
            { href: "/qsign", label: "QSign" },
            { href: "/bureau", label: "Bureau" },
            { href: "/planet", label: "Planet" },
            { href: "/awards", label: "Awards" },
            { href: "/bank", label: "Bank" },
            { href: "/cyberchess", label: "Chess" },
            { href: "/pricing", label: "Pricing" },
          ].map((x) => (
            // translate="no" — это ИМЕНА ПРОДУКТОВ, а не проза. Живой перевод
            // раздувал их до неузнаваемости, замерено на проде 10.08.2026:
            // «QSign» превратился в «Быстрая регистрация» (147 точек вместо 56),
            // а «API» — в «Интерфейс прикладного программирования», 284 точки.
            // На телефоне доступная ширина 350, то есть одна эта подпись не
            // влезает в экран целиком и забирает себе отдельный ряд.
            // Обходчик DOM уважает этот атрибут — см. walk() в AutoTranslate.
            <Link key={x.href} href={x.href} translate="no" className="aev-nav-secondary" style={{ padding: "5px 8px", borderRadius: 6, textDecoration: "none", color: "#334155", fontSize: 12, fontWeight: 600 }}>
              {x.label}
            </Link>
          ))}
          <a href={`${origin}/api/openapi.json`} target="_blank" rel="noreferrer" translate="no" className="aev-nav-secondary" style={{ padding: "5px 8px", borderRadius: 6, textDecoration: "none", color: "#0d9488", fontSize: 12, fontWeight: 600, border: "1px solid rgba(13,148,136,0.3)" }}>
            API
          </a>
          <span className="aev-nav-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <AiOfflineToggle />
            <PlatformAiSavings />
            <RevenueGoalBadge />
          </span>
          <div style={{ marginLeft: 4 }}>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
