import type { MetadataRoute } from "next";
import { DISALLOWED_PATHS } from "./robots";
import { getApiBase } from "@/lib/apiBase";

/** Адреса с `index: false`, собранные обходом; нужны и для статического списка. */
let scannedNoIndex = new Set<string>();

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

// ⚠️ Руками сюда добавлять адрес МОЖНО только если страница уже есть:
// обход каталогов ниже подхватывает новые страницы сам, а запись в этом
// списке живёт вечно и не проверяется ничем. Замер 21.08.2026: карта
// отдавала поисковику 4 мёртвых адреса из 782, и три из них пришли
// отсюда — /bureau/transparency и /qcontract/documents (страниц нет ни
// в одной из веток) и /qcoreai/docs (страница есть, но её вырезал
// незаякоренный шаблон docs/ в .vercelignore — починено там же).
/**
 * Запрещён ли адрес для поисковика. Вынесено на уровень модуля, чтобы
 * сторож мог проверить предикат БЕЗ сети: карта сайта тянет живые
 * списки вакансий и проектов, и тест, зовущий её целиком, проверял бы
 * заодно доступность бэкенда — то есть краснел бы не по делу.
 */
export function isBlockedForCrawlers(u: string): boolean {
  const p = u.replace(/^https?:\/\/[^/]+/, "");
  return DISALLOWED_PATHS.some((d) => p === d || p === d.replace(/\/$/, "") || p.startsWith(d));
}

const TOP_LEVEL_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/modules", changeFrequency: "daily", priority: 0.9 },
  { path: "/qright", changeFrequency: "daily", priority: 0.9 },
  { path: "/qright/transparency", changeFrequency: "weekly", priority: 0.6 },
  { path: "/bureau", changeFrequency: "daily", priority: 0.9 },
  { path: "/qsign", changeFrequency: "weekly", priority: 0.7 },
  { path: "/quantum-shield", changeFrequency: "weekly", priority: 0.7 },
  { path: "/planet", changeFrequency: "daily", priority: 0.8 },
  { path: "/awards", changeFrequency: "daily", priority: 0.8 },
  { path: "/qreal", changeFrequency: "weekly", priority: 0.8 },
  { path: "/qcoreai", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qcoreai/multi", changeFrequency: "weekly", priority: 0.65 },
  { path: "/qcoreai/playground", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcoreai/optimize", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcoreai/pipeline", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcoreai/docs", changeFrequency: "monthly", priority: 0.7 },
  { path: "/qcoreai/providers", changeFrequency: "weekly", priority: 0.55 },
  { path: "/cyberchess", changeFrequency: "weekly", priority: 0.7 },
  { path: "/cyberchess/cpi", changeFrequency: "monthly", priority: 0.65 },
  { path: "/cyberchess/cpi/dashboard", changeFrequency: "daily", priority: 0.7 },
  { path: "/cyberchess/cpi/leaderboard", changeFrequency: "hourly", priority: 0.75 },
  { path: "/cyberchess/economy", changeFrequency: "weekly", priority: 0.6 },
  { path: "/cyberchess/training", changeFrequency: "daily", priority: 0.7 },
  { path: "/cyberchess/tournament", changeFrequency: "daily", priority: 0.75 },
  { path: "/cyberchess/studio", changeFrequency: "weekly", priority: 0.6 },
  // QBuild static routes
  { path: "/build", changeFrequency: "daily", priority: 1.0 },
  { path: "/build/vacancies", changeFrequency: "hourly", priority: 0.9 },
  { path: "/build/stats", changeFrequency: "hourly", priority: 0.7 },
  { path: "/build/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/build/why-aevion", changeFrequency: "weekly", priority: 0.7 },
  { path: "/build/referrals", changeFrequency: "daily", priority: 0.5 },
  { path: "/build/leaderboard", changeFrequency: "daily", priority: 0.6 },
  { path: "/build/help", changeFrequency: "weekly", priority: 0.5 },
  { path: "/build/salary", changeFrequency: "hourly", priority: 0.75 },
  { path: "/build/interviews", changeFrequency: "daily", priority: 0.6 },
  { path: "/build/ai-match", changeFrequency: "weekly", priority: 0.65 },
  { path: "/keys", changeFrequency: "monthly", priority: 0.6 },
  // HealthAI standalone pages
  { path: "/healthai", changeFrequency: "weekly", priority: 0.8 },
  { path: "/healthai/screener", changeFrequency: "monthly", priority: 0.6 },
  { path: "/healthai/plan", changeFrequency: "weekly", priority: 0.65 },
  { path: "/healthai/cycle", changeFrequency: "daily", priority: 0.6 },
  // QCoreAI
  { path: "/qcoreai/budget", changeFrequency: "monthly", priority: 0.55 },
  { path: "/qcoreai/api-keys", changeFrequency: "monthly", priority: 0.5 },
  { path: "/qcoreai/orgs", changeFrequency: "weekly", priority: 0.55 },
  // QPayNet
  { path: "/qpaynet", changeFrequency: "weekly", priority: 0.8 },
  { path: "/qpaynet/merchant", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qpaynet/transactions", changeFrequency: "daily", priority: 0.6 },
  { path: "/qpaynet/request", changeFrequency: "weekly", priority: 0.65 },
  { path: "/qpaynet/requests", changeFrequency: "weekly", priority: 0.55 },
  // QContract
  { path: "/qcontract", changeFrequency: "weekly", priority: 0.75 },
  { path: "/qcontract/create", changeFrequency: "weekly", priority: 0.6 },
  // DevHub — AI developer platform
  { path: "/devhub", changeFrequency: "weekly", priority: 0.8 },
  // Smeta Trainer
  { path: "/smeta-trainer", changeFrequency: "weekly", priority: 0.75 },
  // QTradeOffline
  { path: "/qtradeoffline", changeFrequency: "weekly", priority: 0.6 },
  // Planning / Idea landings
  { path: "/qfusionai", changeFrequency: "monthly", priority: 0.55 },
  { path: "/veilnetx", changeFrequency: "monthly", priority: 0.5 },
  { path: "/qmaskcard", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qpersona", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qlife", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qgood", changeFrequency: "monthly", priority: 0.5 },
  { path: "/voice-of-earth", changeFrequency: "monthly", priority: 0.45 },
  { path: "/kids-ai-content", changeFrequency: "monthly", priority: 0.5 },
  { path: "/startup-exchange", changeFrequency: "monthly", priority: 0.5 },
  { path: "/shadownet", changeFrequency: "monthly", priority: 0.4 },
  { path: "/deepsan", changeFrequency: "monthly", priority: 0.45 },
  { path: "/psyapp-deps", changeFrequency: "monthly", priority: 0.45 },
  { path: "/mapreality", changeFrequency: "monthly", priority: 0.4 },
  { path: "/z-tide", changeFrequency: "monthly", priority: 0.35 },
  { path: "/lifebox", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qchaingov", changeFrequency: "monthly", priority: 0.4 },
  // Fintech ecosystem
  { path: "/fintech", changeFrequency: "weekly", priority: 0.7 },
  { path: "/fintech/catalog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/fintech/modules", changeFrequency: "weekly", priority: 0.65 },
  { path: "/fintech/status", changeFrequency: "hourly", priority: 0.55 },
  { path: "/fintech/dashboard", changeFrequency: "weekly", priority: 0.5 },
  { path: "/fintech/whitepaper", changeFrequency: "monthly", priority: 0.5 },
  { path: "/fintech/compare", changeFrequency: "monthly", priority: 0.45 },
  { path: "/fintech/analytics", changeFrequency: "hourly", priority: 0.6 },
  { path: "/fintech/integrations", changeFrequency: "monthly", priority: 0.6 },
  { path: "/fintech/changelog", changeFrequency: "weekly", priority: 0.5 },
  { path: "/developers/fintech", changeFrequency: "weekly", priority: 0.7 },
  { path: "/developers/fintech/quickstart", changeFrequency: "monthly", priority: 0.65 },
  { path: "/developers/fintech/sdk", changeFrequency: "monthly", priority: 0.6 },
  { path: "/developers/fintech/webhooks", changeFrequency: "monthly", priority: 0.6 },
  { path: "/developers/fintech/errors", changeFrequency: "monthly", priority: 0.55 },
  { path: "/developers/fintech/examples", changeFrequency: "monthly", priority: 0.6 },
  { path: "/developers/fintech/migration", changeFrequency: "monthly", priority: 0.5 },
  { path: "/developers/fintech/rate-limits", changeFrequency: "monthly", priority: 0.5 },
  // QVenture — AI Investment Analyst
  { path: "/qventure", changeFrequency: "daily", priority: 0.85 },
  { path: "/qventure/gallery", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qventure/watchlist", changeFrequency: "weekly", priority: 0.5 },
  { path: "/qventure/a/demo-neurodx", changeFrequency: "monthly", priority: 0.6 },
  // Launch status
  { path: "/launch-status", changeFrequency: "hourly", priority: 0.5 },
  // Посадочные запуска. Замер 19.08.2026: на обе НЕ ВЕЛА ни одна ссылка — ни из
  // карты сайта, ни с какой-либо страницы. Единственные упоминания в коде были в
  // собственном тесте и в комментарии, то есть страницы собирали адреса, попасть
  // на которые было нельзя. Модули пока не запущены и цены у них нет, поэтому
  // приоритет умеренный, а частота — недельная.
  // Посадочные запуска — все четыре, и вот ЗАЧЕМ, потому что первая версия этого
  // комментария врала («карта собирается списком, а не обходом»).
  //
  // Обход каталогов ниже рекурсивный и берёт КАЖДУЮ page.tsx, поэтому в обычной
  // сборке страница попадает в карту и без записи здесь. Запись даёт две вещи,
  // которых обход не даёт:
  //   1. осознанный приоритет вместо DEFAULT_PRIORITY — шахматы и бюро выходят
  //      раньше остальных (30.08 и 06.09), им 0.7, а не общий уровень;
  //   2. запас на случай, когда обход файловой системы вернул ПУСТО (edge-рантайм,
  //      песочница — см. комментарий у overrideMap). Тогда в карте остаётся ровно
  //      этот список, и незанесённая посадочная исчезает целиком.
  // Второе и охраняет sitemapCoversLaunchPages: он читает ЭТОТ файл текстом.
  { path: "/cyberchess/launch", changeFrequency: "weekly", priority: 0.7 },
  { path: "/bureau/launch", changeFrequency: "weekly", priority: 0.7 },
  { path: "/devhub/launch", changeFrequency: "weekly", priority: 0.6 },
  { path: "/multichat-engine/launch", changeFrequency: "weekly", priority: 0.6 },
  // Constitution module
  { path: "/constitution",             changeFrequency: "daily",   priority: 0.9 },
  { path: "/constitution/leaderboard", changeFrequency: "hourly",  priority: 0.8 },
  { path: "/constitution/stats",       changeFrequency: "daily",   priority: 0.7 },
  { path: "/constitution/api",         changeFrequency: "monthly", priority: 0.65 },
  { path: "/constitution/learn",       changeFrequency: "monthly", priority: 0.75 },
  { path: "/constitution/embed",       changeFrequency: "monthly", priority: 0.45 },
  { path: "/constitution/blog",        changeFrequency: "weekly",  priority: 0.7 },
  { path: "/constitution/blog/why-norway-90-rule-of-law",   changeFrequency: "monthly", priority: 0.65 },
  { path: "/constitution/blog/magna-carta-to-open-access",  changeFrequency: "monthly", priority: 0.65 },
  { path: "/constitution/blog/growing-pie-is-everything",   changeFrequency: "monthly", priority: 0.65 },
  { path: "/constitution/pricing",     changeFrequency: "weekly",  priority: 0.8 },
  { path: "/constitution/welcome",     changeFrequency: "monthly", priority: 0.4 },
  { path: "/constitution/showcase",    changeFrequency: "weekly",  priority: 0.85 },
  { path: "/constitution/status",      changeFrequency: "hourly",  priority: 0.6 },
];

const DEFAULT_CHANGE_FREQ: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly";
const DEFAULT_PRIORITY = 0.6;

/**
 * Walk `frontend/src/app/**` at build time and pick up every `page.tsx` so we
 * don't have to hand-maintain a route list (and forget routes like
 * `/cyberchess/studio` did historically). Returns route paths relative to the
 * app root (e.g. `/qcoreai/playground`, or `/` for the root page).
 *
 * Excludes:
 *  - Dynamic segments (`[id]`, `[slug]`, `[...rest]`) — those routes are
 *    generated separately via `fetchIds()` against real data.
 *  - Route groups `(group)` — they don't appear in URLs but are folder-only.
 *  - Private folders starting with `_` (e.g. `_components`).
 *  - The `api/` tree — server routes, not crawlable pages.
 *
 * Runtime-safe: only invoked when `fs` is actually available (Node runtime
 * during build). On edge/runtime where the FS isn't reachable, the caller
 * falls back to the manual `TOP_LEVEL_ROUTES` list.
 */
async function scanAppRoutes(): Promise<string[]> {
  // Dynamic imports so the module graph doesn't drag node:fs into edge bundles.
  // Wrapped in try/catch so any failure (sandboxed runtime, missing dir,
  // permissions) just degrades to an empty array.
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // `process.cwd()` is the project root during `next build` (usually the
    // `frontend/` directory). The Next.js convention is `src/app/**`.
    const appDir = path.join(process.cwd(), "src", "app");

    // Quick sanity check — if the dir isn't there, we're probably running in
    // a serverless/edge context. Bail.
    try {
      const stat = await fs.stat(appDir);
      if (!stat.isDirectory()) return [];
    } catch {
      return [];
    }

    const routes: string[] = [];

    /** Объявлен ли `index: false` у страницы или у любого её макета. */
    async function isNoIndex(
      fsMod: typeof import("node:fs/promises"),
      pathMod: typeof import("node:path"),
      root: string,
      segments: string[],
    ): Promise<boolean> {
      const declares = async (file: string) => {
        try {
          return /index:\s*false/.test(await fsMod.readFile(file, "utf8"));
        } catch {
          // Файла нет или не читается — это НЕ «разрешено»: молча пропустить
          // страницу в карту здесь безопаснее, чем молча выбросить. Ошибка
          // чтения не должна убирать адрес из выдачи.
          return false;
        }
      };
      if (await declares(pathMod.join(root, ...segments, "page.tsx"))) return true;
      for (let i = segments.length; i >= 0; i--) {
        if (await declares(pathMod.join(root, ...segments.slice(0, i), "layout.tsx"))) return true;
      }
      return false;
    }

    const noIndex = new Set<string>();
    async function walk(dir: string, segments: string[]): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const name = entry.name;

        if (entry.isDirectory()) {
          // Skip dynamic segments (handled by fetchIds elsewhere).
          if (name.startsWith("[")) continue;
          // Skip private folders, route groups, and node_modules-ish stuff.
          if (name.startsWith("_")) continue;
          if (name.startsWith("(") && name.endsWith(")")) continue;
          // Skip the API tree — those aren't browseable URLs.
          if (segments.length === 0 && name === "api") continue;

          await walk(path.join(dir, name), [...segments, name]);
          continue;
        }

        if (!entry.isFile()) continue;
        if (name !== "page.tsx" && name !== "page.ts" && name !== "page.jsx" && name !== "page.js") continue;

        // Build the route path from the segments we walked into.
        const route = segments.length === 0 ? "/" : "/" + segments.join("/");

        // Страница, помеченная `robots: { index: false }`, в карту попадать не
        // должна: карта говорит Google «индексируй», а страница — «не
        // индексируй». Два наших источника противоречат друг другу.
        //
        // Замер 28.08.2026: таких было 23 — /acquire, весь личный кабинет
        // /bank (audit-log, income, settings, statement...), /pitch/print,
        // /pricing/affiliate-dashboard и другие. Решение по ним уже принято
        // тем, кто написал `index: false`; карта просто про это не знала.
        //
        // Смотрим и саму страницу, и МАКЕТЫ вверх по дереву: у /bank директива
        // стоит именно в макете раздела и распространяется на все его страницы.
        if (await isNoIndex(fs, path, appDir, segments)) noIndex.add(route);

        routes.push(route);
      }
    }

    await walk(appDir, []);
    // Возвращаем и найденные адреса, и те из них, что помечены noindex:
    // отбор нужен НЕ только здесь. Часть адресов приходит статическим списком
    // TOP_LEVEL_ROUTES, и первая версия фильтра их не накрывала — сквозной
    // сторож поймал ровно это (/constitution/embed, /constitution/welcome).
    scannedNoIndex = noIndex;
    return routes;
  } catch {
    return [];
  }
}

async function fetchIds(path: string, idField: string = "id"): Promise<string[]> {
  try {
    const res = await fetch(`${getApiBase()}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const j = await res.json();
    return (j?.data?.items ?? [])
      .map((r: Record<string, unknown>) => r[idField] as string | undefined)
      .filter((v: string | undefined): v is string => !!v);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pull employer IDs from the leaderboard endpoint — that's a public,
  // already-curated list of brand-name profiles worth indexing. Capped
  // server-side at 20+20, so cheap to fetch.
  const origin = BASE_URL;
  const [projectIds, vacancyIds, employerLeaderboard, popularSkills, scannedRoutes] = await Promise.all([
    fetchIds("/api/build/projects?limit=500&status=OPEN"),
    fetchIds("/api/build/vacancies?limit=1000&status=OPEN"),
    fetch(`${getApiBase()}/api/build/stats/leaderboard`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : { data: { employers: [] } }))
      .catch(() => ({ data: { employers: [] } })),
    fetch(`${getApiBase()}/api/build/vacancies/skills/popular`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : { data: { items: [] } }))
      .catch(() => ({ data: { items: [] } })),
    scanAppRoutes(),
  ]);

  const employerIds: string[] = ((employerLeaderboard?.data?.employers ?? []) as { userId: string }[])
    .map((e) => e.userId)
    .filter(Boolean);

  const skillSlugs: string[] = ((popularSkills?.data?.items ?? []) as { skill: string }[])
    .map((s) => s.skill?.trim())
    .filter((s): s is string => !!s)
    .slice(0, 50)
    // encodeURIComponent обязателен: у навыка может быть слэш в названии,
    // и тогда адрес разваливается на ДВА сегмента, а маршрут [slug] —
    // односегментный. Замер 20.08.2026: из двух популярных навыков один
    // назывался "mig/mag welding", и карта сайта вела на 404.
    // Проверено пробой на проде, а не рассуждением:
    //   /build/skill/mig%2Fmag-welding -> 200
    //   /build/skill/mig/mag-welding   -> 404
    // Страница разбирает адрес через decodeURIComponent, так что
    // процентная запись доходит до неё в исходном виде.
    .map((s) => encodeURIComponent(s.toLowerCase().replace(/\s+/g, "-")));

  // Merge strategy:
  // 1. Every route in TOP_LEVEL_ROUTES keeps its hand-tuned changeFreq + priority
  //    (SEO-sensitive — hourly leaderboards, daily landings, etc.).
  // 2. Any route found on disk that ISN'T in TOP_LEVEL_ROUTES gets defaults.
  // 3. If the FS scan returned nothing (edge runtime, sandbox, etc.), we still
  //    have the full TOP_LEVEL_ROUTES list as a baseline.
  const overrideMap = new Map(TOP_LEVEL_ROUTES.map((r) => [r.path, r]));
  const allPaths = new Set<string>(TOP_LEVEL_ROUTES.map((r) => r.path));
  for (const p of scannedRoutes) allPaths.add(p);

  // Отбор ПОСЛЕ объединения: адреса приходят из двух источников — обхода диска
  // и статического TOP_LEVEL_ROUTES, — и noindex-страница может прийти любым.
  // Фильтр только в обходе пропускал вторые.
  for (const p of scannedNoIndex) allPaths.delete(p);

  const today = new Date();
  const staticRoutes: MetadataRoute.Sitemap = Array.from(allPaths).map((p) => {
    const override = overrideMap.get(p);
    return {
      url: `${origin}${p}`,
      lastModified: today,
      changeFrequency: override?.changeFrequency ?? DEFAULT_CHANGE_FREQ,
      priority: override?.priority ?? DEFAULT_PRIORITY,
    };
  });

  const projectRoutes: MetadataRoute.Sitemap = projectIds.map((id) => ({
    url: `${origin}/build/project/${id}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const vacancyRoutes: MetadataRoute.Sitemap = vacancyIds.map((id) => ({
    url: `${origin}/build/vacancy/${id}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const employerRoutes: MetadataRoute.Sitemap = employerIds.map((id) => ({
    url: `${origin}/build/employer/${id}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const skillRoutes: MetadataRoute.Sitemap = skillSlugs.map((slug) => ({
    url: `${origin}/build/skill/${slug}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Cap total at 5000 so the sitemap stays valid (Google limit is 50k but
  // we prefer multiple smaller files long-term — single sitemap is enough
  // for now).
  const all = [...staticRoutes, ...skillRoutes, ...vacancyRoutes, ...projectRoutes, ...employerRoutes];

  // Не звать поисковика туда, куда сами его не пускаем.
  //
  // Список берём из robots.ts, а не переписываем: два списка неизбежно
  // разъедутся. Замер 21.08.2026 до этого фильтра: карта отдавала 782 адреса,
  // и 19 из них robots.txt запрещает — /admin/* (9), /qpaynet/admin/* (8),
  // /account и /constitution/admin. Обход каталогов их честно находил, просто
  // ничего не знал про запреты. Google на противоречие отвечает тем, что
  // показывает адрес в выдаче БЕЗ описания, — то есть ссылка на админку видна.
  const crawlable = all.filter((e) => !isBlockedForCrawlers(String(e.url)));

  return crawlable.slice(0, 5000);
}
