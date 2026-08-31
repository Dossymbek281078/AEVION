import { BUILD_STAMP } from "@/lib/buildStamp";
import { store } from "../payments/v1/_lib";
import { kvBackend } from "../payments/v1/_persist";

const STARTED_AT = Date.now();

export function GET() {
  const now = Date.now();
  const uptimeMs = now - STARTED_AT;
  const memUsed =
    typeof process !== "undefined" && process.memoryUsage
      ? Math.round(process.memoryUsage().rss / 1024 / 1024)
      : null;

  // 29.08.2026: пять поверхностей рапортовали ok жёсткой КОНСТАНТОЙ, и только
  // шестая проверяла по-настоящему. Признак недосмотра — непоследовательность
  // внутри одного файла: один автор, шесть однотипных записей, у одной
  // поведение другое.
  //
  // Хуже, что рядом в том же ответе стоит честное `persistence: "memory"` —
  // то есть ручка ЗНАЕТ, что данные живут в памяти процесса и теряются при
  // перезапуске, и тут же говорит «ok» про все поверхности. Два наших ответа
  // спорят об одном: кто прочитает ok, до persistence не дойдёт.
  const durable = kvBackend() === "kv";
  const lost = durable
    ? undefined
    : "хранилище в памяти процесса — записи теряются при перезапуске";
  const surfaces = [
    { name: "links", count: store.links.size, ok: durable, note: lost },
    { name: "checkouts", count: store.checkouts.size, ok: durable, note: lost },
    { name: "subscriptions", count: store.subscriptions.size, ok: durable, note: lost },
    { name: "webhooks", count: store.webhooks.size, ok: durable, note: lost },
    { name: "settlements", count: store.settlements.size, ok: durable, note: lost },
    {
      name: "idempotency_cache",
      count: store.idempotency.size,
      ok: store.idempotency.size < 5000,
    },
  ];

  const allOk = surfaces.every((s) => s.ok);

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: now,
      iso: new Date(now).toISOString(),
      uptime_ms: uptimeMs,
      uptime_human: formatUptime(uptimeMs),
      version: "v1.3",
      // Какой код сейчас на САЙТЕ. Поле version выше — зашитая строка: она
      // выглядит заполненной и не отвечает ни на что. У бэкенда та же дыра
      // стоила 14.08.2026 половины дня: /health говорил "unknown", и нельзя
      // было сказать, чья выкатка живёт на проде, — а выкатывают его семь
      // сессий подряд, каждая заменяя предыдущую целиком. Фронт правят как
      // минимум три ветки, и опознать его нечем до сих пор.
      //
      // Vercel подставляет эти переменные и на сборке из git, и при загрузке
      // папкой через CLI. Нет их — говорим "unknown" ЯВНО: выдуманная метка
      // хуже отсутствующей, потому что ей верят.
      build: {
        // Порядок источников: сначала то, что уехало ВНУТРИ сборки, потом
        // переменные Vercel. При выкатке папкой git-метки нет вовсе (проверено
        // 18.08.2026), а переменные проекта переживают чужую выкатку — им
        // верить первыми нельзя.
        commit:
          (BUILD_STAMP.commit !== "unknown" ? BUILD_STAMP.commit : "") ||
          (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) ||
          "unknown",
        branch:
          (BUILD_STAMP.branch !== "unknown" ? BUILD_STAMP.branch : "") ||
          process.env.VERCEL_GIT_COMMIT_REF ||
          "unknown",
        builtAt: BUILD_STAMP.builtAt,
        // Окружение Vercel: production или preview. Их деплои легко спутать.
        env: process.env.VERCEL_ENV || "local",
        // Идентификатор сборки — он есть всегда, даже когда git-метки нет.
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
        // Режим банковского модуля — и он важнее, чем кажется.
        //
        // `NEXT_PUBLIC_BANK_MODE` читают ДВА места с одинаковым дефолтом
        // "test", но с противоположными последствиями:
        //   • TestModeBanner — при дефолте баннер ПОКАЖЕТСЯ (это безопасно:
        //     лучше лишний раз предупредить, чем скрыть тестовый режим);
        //   • lib/sentry.ts — при дефолте боевые ошибки помечаются как
        //     `environment: "test"`, то есть их отфильтруют вместе с шумом.
        //
        // Второе — тихая потеря тревог, и снаружи она неотличима от тишины.
        // Значение не секрет (это имя режима), поэтому показываем как есть;
        // `null` означает, что переменная не задана вовсе.
        bankMode: process.env.NEXT_PUBLIC_BANK_MODE ?? null,
      },
      runtime: typeof process !== "undefined" ? process.version : "edge",
      memory_rss_mb: memUsed,
      persistence: kvBackend(),
      surfaces,
    },
    {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    }
  );
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}
