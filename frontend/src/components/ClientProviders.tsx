"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { syncTokenAliases } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";
import { PlanLimitToastBridge } from "@/components/PlanLimitToastBridge";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AppShellLanguagePill } from "@/components/AppShellLanguagePill";
import { AppShellRevenueBadge } from "@/components/AppShellRevenueBadge";
import { AutoTranslate } from "@/components/AutoTranslate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import RouteAnnouncer from "@/components/RouteAnnouncer";
import { WebVitals } from "@/components/WebVitals";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PaywallModal } from "@/components/PaywallModal";
import { AgentDock } from "@/components/AgentDock";
import { AdPixels } from "@/components/AdPixels";

// Prefixes where standalone app shells take over — no global header/footer.
// These pages are full apps (game, dashboards, trading) — the global product nav
// distracts from the in-app workflow, so we hide it.
const APP_PREFIXES = [
  "/build", "/qright", "/qsign", "/qcoreai", "/multichat-engine",
  "/cyberchess",
];

/**
 * «Голые» страницы — без шапки, подвала и плавающих виджетов.
 *
 * Это НЕ то же самое, что APP_PREFIXES: там полноэкранные приложения, которым
 * вместо шапки выдаются свои app-shell элементы (языковой pill, бейдж выручки).
 * Здесь — посадочные страницы, вся ценность которых в фокусе.
 *
 * `/go` — ссылка из шапки профиля в Instagram/TikTok/Threads. Человек приходит
 * с телефона сразу после ролика, и у него секунды внимания. С глобальной шапкой
 * на странице оказывалось 37 ссылок, из них 31 — мелкие цели навигации выше
 * контента (замерено 26.07.2026). Ради одного нужного нажатия это провал.
 */
const BARE_PREFIXES = ["/go"];

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Псевдонимы токена — тем, кто вошёл ДО правки 10.08.2026. Десятки модулей
  // читают токен под именами, которые боевой код никогда не писал; теперь их
  // пишет владелец (src/lib/auth.ts), но у уже вошедших setAuthToken больше
  // не вызовется — поэтому досинхронизация при старте. Идемпотентна и дешева:
  // одно чтение localStorage, если пользователь не авторизован.
  useEffect(() => {
    syncTokenAliases();
  }, []);
  const isApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isBare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // CyberChess is a separate session/branch (see aevion-globus-backend/CLAUDE.md) —
  // no new UI gets added to that shell from here, goal badge included.
  const isCyberchess = pathname === "/cyberchess" || pathname.startsWith("/cyberchess/");

  return (
    <I18nProvider>
      {/* observe={!isApp}: на full-app оболочках (CyberChess, build, qright…)
          оставляем разовый стартовый перевод, но НЕ вешаем live-MutationObserver —
          он гонял walk() на каждый ход/тик часов и лагал механику ходов. */}
      <AutoTranslate observe={!isApp}>
        {!isApp && !isBare && <SiteHeader />}
        {isApp && !isBare && <AppShellLanguagePill />}
        {isApp && !isBare && !isCyberchess && <AppShellRevenueBadge />}
        {/*
          Переход между страницами клиентский: браузер не переносит фокус
          и не объявляет новую комнату. Замер 03.09.2026 — на всех трёх
          переходах цепочки фокус оказывался на body, а живых областей
          на страницах было ноль.
        */}
        <RouteAnnouncer />
        <ToastProvider>
          <PlanLimitToastBridge />
          <div style={{ flex: 1 }}>{children}</div>
        </ToastProvider>
        {!isApp && !isBare && <SiteFooter />}
        <ServiceWorkerRegister />
        <WebVitals />
        {/* Пиксели рекламных кабинетов. Вне isApp/isBare-развилок сознательно:
            заход на /go — первое, что видит человек из рекламы, и терять его
            PageView только потому, что страница «голая», нельзя. Без переменной
            окружения компонент не рендерит ничего. */}
        <AdPixels />
        <InstallPrompt />
        <PaywallModal />
        {/* Global AI Agent — available on product/module pages. Hidden on the
            full-app shells (qcoreai, multichat, cyberchess, build…) which own
            their own in-app AI/UX and are worked in separate sessions. */}
        {!isApp && !isBare && <AgentDock />}
      </AutoTranslate>
    </I18nProvider>
  );
}