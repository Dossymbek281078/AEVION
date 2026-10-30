import type { ComponentProps } from "react";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { PaywallScreen } from "./PaywallScreen";

/**
 * Стена закрытого модуля для СЕРВЕРНОЙ страницы — с языком первого кадра.
 *
 * ЗАЧЕМ (30.10.2026, вычитка Продукта к 8b02151ce). PaywallScreen берёт язык
 * из I18nProvider, который на сервере и до гидрации держит «en»; пока он не
 * готов, стена читает язык из ServerLangProvider (кука → Accept-Language → ru).
 * Раньше провайдер ставили в layout.tsx маршрута вместе с force-dynamic — и всё
 * поддерево уходило с CDN на рендер (smeta-trainer ~330 страниц, qcoreai ~48).
 * Здесь язык решается только на ветке, где стена действительно рисуется;
 * страница со стеной и так динамическая (fetchOrPaywall — cache: "no-store").
 * Сторож: app/__tests__/paywallScreenServerLang.guard.
 */
export async function ServerPaywallScreen(props: ComponentProps<typeof PaywallScreen>) {
  const lang = await serverLang("ru");
  return (
    <ServerLangProvider lang={lang}>
      <PaywallScreen {...props} />
    </ServerLangProvider>
  );
}
