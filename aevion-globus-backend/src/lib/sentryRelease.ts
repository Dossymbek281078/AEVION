/**
 * Версия для Sentry (поле `release`) — из build-info.json, а не из переменной окружения.
 *
 * 23.10.2026 (Продукт): пять последних ошибок бэка в Sentry (aevion-v7 / aevion-backend)
 * пришли с пустым полем release — оба наших Sentry.init брали `process.env.SENTRY_RELEASE`,
 * а на Railway такой переменной нет (есть только SENTRY_DSN и SENTRY_ENV). При разборе
 * инцидента приходилось сопоставлять время события с журналом выкаток вручную.
 * Бэк при этом знает свой коммит: `scripts/railway-deploy.sh` кладёт build-info.json в образ,
 * его читает readBuildInfo() и отдаёт /health → commit. Берём ту же отметку.
 *
 * Порядок: явная SENTRY_RELEASE (если её когда-нибудь зададут) → `aevion-globus-backend@<commit>`
 * из build-info → undefined (Sentry тогда не ставит release вовсе — честнее, чем «unknown»,
 * который склеил бы все выкатки в одну «версию»).
 */
import { readBuildInfo } from "./buildInfo";

export const SENTRY_RELEASE_PREFIX = "aevion-globus-backend@";

export function resolveSentryRelease(
  env: NodeJS.ProcessEnv = process.env,
  build: () => { commit: string } = readBuildInfo,
): string | undefined {
  const явная = env.SENTRY_RELEASE?.trim();
  if (явная) return явная;
  try {
    const commit = String(build().commit || "").trim();
    if (commit && commit !== "unknown") return `${SENTRY_RELEASE_PREFIX}${commit}`;
  } catch {
    /* build-info недоступен — release не ставим, Sentry всё равно принимает событие */
  }
  return undefined;
}
