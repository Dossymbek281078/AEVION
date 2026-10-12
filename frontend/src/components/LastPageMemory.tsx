"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Запоминает последнюю страницу сайта (кроме /auth) — чтобы вход вернул туда.
 *
 * 🔴 Замер прода 12.10.2026 (окно Приложения-31.12): возврат по
 * document.referrer НЕ работает при переходе через <Link> — referrer остаётся
 * от первой загрузки (у прямого захода он пустой). Ссылка «Войти →» на z-tide
 * давала на /auth referrer "". Поэтому путь пишем сами при каждой смене страницы.
 */
export const ПОСЛЕДНЯЯ_СТРАНИЦА = "aevion.lastPage.v1";

export default function LastPageMemory() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname === "/auth" || pathname.startsWith("/auth/")) return;
    try {
      sessionStorage.setItem(ПОСЛЕДНЯЯ_СТРАНИЦА, pathname + window.location.search);
    } catch {}
  }, [pathname]);
  return null;
}
