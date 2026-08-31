"use client";

import { useEffect, useRef } from "react";

import LanguageSwitcher from "@/components/LanguageSwitcher";

export function AppShellLanguagePill() {
  const ref = useRef<HTMLDivElement>(null);

  // Плашка закреплена сверху справа и ЗАМЕНЯЕТ шапку на страницах-приложениях.
  // Содержимое течёт под ней, и на короткой странице под неё попадает ссылка
  // подвала: замер 31.08.2026 на 390px — 0 доступных точек из 15, без плашки
  // 15 из 15. Публикуем высоту, чтобы страница могла её учесть; переменная
  // снимается при размонтировании, поэтому там, где плашки нет, отступа тоже
  // нет.
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el) return;
    const обновить = () => {
      const h = el.getBoundingClientRect().height;
      root.style.setProperty("--aevion-pill-h", `${Math.round(h) + 12}px`);
    };
    обновить();
    const ro = new ResizeObserver(обновить);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--aevion-pill-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-app-shell-pill="true"
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 60,
        padding: 4,
        borderRadius: 10,
        background: "rgba(15,23,42,0.78)",
        backdropFilter: "blur(8px)",
        color: "#e2e8f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      }}
    >
      <LanguageSwitcher />
    </div>
  );
}
