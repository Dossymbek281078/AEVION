/**
 * Файл инструментирования Next — ЕДИНСТВЕННОЕ место, где поднимается серверный
 * Sentry.
 *
 * До 21.08.2026 его не было вовсе, и каждая сборка печатала об этом прямым
 * текстом: «Could not find a Next.js instrumentation file. This indicates an
 * incomplete configuration of the Sentry SDK». Файлы `sentry.server.config.ts`
 * и `sentry.edge.config.ts` лежали в проекте и выглядели рабочими, но Next 16
 * сам их не подхватывает — их содержимое должно грузиться отсюда. То есть
 * ошибки в серверных ручках сайта (среди них `pay` и `payments`) не приходили
 * никуда: в браузере их не видно, в Sentry их не было.
 *
 * Класть файл больше некуда: Next сканирует родителя каталога `app` и признаёт
 * файл только на уровне `/` или `/src`. У нас `src/app`, значит `src/`.
 * Положенный в другое место игнорируется молча.
 *
 * Настройка безопасна для локальных и тестовых сборок: без переменной
 * SENTRY_DSN она не делает ничего.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/** Штатный способ Next 15+ отдавать ошибки серверного рендеринга и ручек. */
export const onRequestError = Sentry.captureRequestError;
