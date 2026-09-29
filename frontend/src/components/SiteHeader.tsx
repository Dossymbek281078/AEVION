"use client";

import { useEffect, useRef } from "react";
import { KeepChannelLink } from "@/components/KeepChannelLink";
// Ссылки шапки идут через KeepChannelLink, а не через обычный Link, намеренно.
// Замер 31.08.2026 в браузере на /en/go?c=yt: из 29 внутренних ссылок страницы
// метку канала несла ОДНА — написанная в теле страницы. Остальные 28 приходят
// из общих шапки и подвала и метку теряли. Человек приходит с ролика, жмёт
// «Pricing» — и покупка после этого приходит в отчёт как пришедшая ниоткуда.
// Внешняя ссылка на openapi.json ниже намеренно осталась обычной <a>.
import { getBackendOrigin } from "@/lib/apiBase";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PlatformAiSavings from "@/components/PlatformAiSavings";
import RevenueGoalBadge from "@/components/RevenueGoalBadge";
import AiOfflineToggle from "@/components/AiOfflineToggle";
import SkipToContent from "@/components/SkipToContent";

/**
 * Разделы шапки — ОДИН список на полную строку и на телефонное меню.
 * Два списка об одном разошлись бы молча: на широком экране раздел есть, на
 * телефоне его нет, и никто этого не заметит.
 */
/** Три главные кнопки — тоже один список на обе раскладки. */
const ГЛАВНЫЕ = [
  { href: "/demo", label: "Demo", color: "#fff", bg: "linear-gradient(135deg, #0d9488, #0ea5e9)" },
  { href: "/explore", label: "Explore", color: "#1a1205", bg: "linear-gradient(135deg, #a9761f, #e6b24a)" },
  { href: "/shop", label: "Shop", color: "#fff", bg: "linear-gradient(135deg, #059669, #10b981)" },
];

const РАЗДЕЛЫ = [
  { href: "/auth", label: "Auth" },
  { href: "/qright", label: "QRight" },
  { href: "/qsign", label: "QSign" },
  { href: "/bureau", label: "Bureau" },
  { href: "/planet", label: "Planet" },
  { href: "/awards", label: "Awards" },
  { href: "/bank", label: "Bank" },
  { href: "/cyberchess", label: "Chess" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const origin = getBackendOrigin();
  const headerRef = useRef<HTMLElement | null>(null);

  // Шапка публикует свою ВЫСОТУ, чтобы прилипающие полосы разделов могли
  // встать под ней, а не под неё. Замер 28.08.2026: полоса вкладок QGood
  // тоже sticky с top: 0, но слоем 10 против 50 — при 1280x900 шапка
  // накрывала её целиком, и все четыре вкладки давали 0 доступных точек
  // из 16. Прокрутка не спасала: обе прилипают к нулю.
  //
  // Почему ResizeObserver, а не число: на узком экране шапка переносится
  // в два ряда и её высота меняется. Именно поэтому дефект виден при
  // 1280 и не виден при 1463 — фиксированное значение было бы неверным
  // ровно там, где оно нужнее всего.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty(
        "--aevion-header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--aevion-header-h");
    };
  }, []);
  return (
    <>
    <SkipToContent />
    {/* Стили шапки — медиазапросами, потому что раскладка обязана быть верной
        С ПЕРВОЙ отрисовки: на телефоне меряется первый экран, а не то, что
        получится после гидрации. Границу берём 700 px: при 390 шапка занимала
        154 px, и ширины хватает ровно до планшета. */}
    <style>{`
      .aev-hdr-menu { display: none; }
      .aev-hdr-menu > summary {
        list-style: none; cursor: pointer; user-select: none;
        padding: 6px 12px; border-radius: 10px; font-size: 20px; line-height: 1;
        border: 1px solid rgba(15,23,42,0.12); background: #fff; color: #0f172a;
      }
      .aev-hdr-menu > summary::-webkit-details-marker { display: none; }
      .aev-hdr-menu-panel {
        position: absolute; right: 12px; left: 12px; margin-top: 8px;
        display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
        padding: 8px; border-radius: 14px; background: #fff;
        border: 1px solid rgba(15,23,42,0.12);
        box-shadow: 0 12px 30px rgba(15,23,42,0.14); z-index: 60;
      }
      @media (max-width: 700px) {
        .aev-hdr-menu { display: block; }
        .aev-hdr-full { display: none !important; }
        .aev-hdr-counters { display: none !important; }
      }
    `}</style>
    <header
      ref={headerRef}
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
        <KeepChannelLink href="/" style={{ textDecoration: "none", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>AEVION</span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            Trust · IP · Globus
          </span>
        </KeepChannelLink>

        {/* ТЕЛЕФОННОЕ МЕНЮ (30.09.2026).
            Замер на 390 px: шапка занимала 154 px — 18 % первого экрана, — и в
            ней помещались 14 ссылок и два счётчика («AI saved $0.23» и
            «$1M: 0.00%»). На страницах модулей, куда приходят по роликам, это
            означало, что пятая часть первого экрана уходит на навигацию и на
            два числа, которых посетитель не понимает.
            Раскладка решается МЕДИАЗАПРОСОМ, а не замером ширины в JS: иначе
            телефон сначала получил бы широкую шапку и перерисовал её после
            гидрации — а меряется именно первый экран. */}
        <details className="aev-hdr-menu">
          <summary aria-label="Меню разделов">☰</summary>
          <nav className="aev-hdr-menu-panel">
            {/* Три главные кнопки идут первыми и во всю ширину: на телефоне они
                и есть то, ради чего меню открывают. */}
            {ГЛАВНЫЕ.map((x) => (
              <KeepChannelLink
                key={x.href}
                href={x.href}
                style={{ gridColumn: "1 / -1", padding: "11px 12px", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 15, color: x.color, background: x.bg, textAlign: "center" }}
              >
                {x.label}
              </KeepChannelLink>
            ))}
            {РАЗДЕЛЫ.map((x) => (
              <KeepChannelLink key={x.href} href={x.href} style={{ padding: "10px 12px", textDecoration: "none", color: "#0f172a", fontSize: 15, fontWeight: 700 }}>
                {x.label}
              </KeepChannelLink>
            ))}
            <a
              href={`${origin}/api/openapi.json`}
              target="_blank"
              rel="noreferrer"
              style={{ gridColumn: "1 / -1", padding: "10px 12px", textAlign: "center", textDecoration: "none", color: "#0d9488", fontSize: 14, fontWeight: 700 }}
            >
              API
            </a>
          </nav>
        </details>

        <div className="aev-hdr-full" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {ГЛАВНЫЕ.map((x) => (
            <KeepChannelLink key={x.href} href={x.href} style={{ padding: "5px 10px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12, color: x.color, background: x.bg }}>
              {x.label}
            </KeepChannelLink>
          ))}
          {РАЗДЕЛЫ.map((x) => (
            <KeepChannelLink key={x.href} href={x.href} style={{ padding: "5px 8px", borderRadius: 6, textDecoration: "none", color: "#334155", fontSize: 12, fontWeight: 600 }}>
              {x.label}
            </KeepChannelLink>
          ))}
          <a href={`${origin}/api/openapi.json`} target="_blank" rel="noreferrer" style={{ padding: "5px 8px", borderRadius: 6, textDecoration: "none", color: "#0d9488", fontSize: 12, fontWeight: 600, border: "1px solid rgba(13,148,136,0.3)" }}>
            API
          </a>
          <AiOfflineToggle />
          {/* Счётчики платформы на телефоне не показываем совсем, а не прячем
              в меню: «AI saved $0.23» и «$1M: 0.00%» — числа для нас, а гостю
              они говорят обратное тому, ради чего он пришёл. Решение о том,
              показывать ли выручку публично ВООБЩЕ, за основателем; здесь
              только мобильный экран. */}
          <span className="aev-hdr-counters">
            <PlatformAiSavings />
            <RevenueGoalBadge />
          </span>
        </div>

        {/* Переключатель языка остаётся ВИДИМЫМ на телефоне: живой трафик у нас
            смешанный, и человек, попавший не на свой язык, должен видеть выход
            сразу, а не искать его в меню. */}
        <div style={{ marginLeft: 4 }}>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
    </>
  );
}
