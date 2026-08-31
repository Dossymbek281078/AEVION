import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Сайт не должен звать адрес, которого сервер не отдаёт.
 *
 * Два самых дорогих дефекта ночи 27-28.08.2026 были одного класса, и оба
 * нашлись глазами, а не проверкой:
 *
 *   кнопка «поделиться» в QCoreAI отдавала ссылку на страницу, которой нет
 *     (прод отвечал 404, а кнопка при этом показывала «Link copied!»);
 *   кнопка «Быстрый отклик» и три возможности модуля build зовут адреса,
 *     которых на сервере нет — пути разошлись на дефис: `video-rooms` против
 *     `video/rooms`, `safety` против `safety-briefing`, `workers` против
 *     `availability`.
 *
 * Снаружи такое выглядит исправным: кнопка отрисована, запрос уходит. Ломается
 * не код, а обещание, и приходит с этим не автор, а пользователь.
 *
 * ПОЧЕМУ СТОРОЖ ЗДЕСЬ, А НЕ ВО ФРОНТЕ. Ему нужны обе стороны: адреса из
 * `frontend/src` и маршруты из `src/`. Backend-набор видит и то и другое.
 *
 * ЧЕСТНАЯ ГРАНИЦА. Адрес, собранный из переменной (`/api/${moduleId}/status`),
 * склеенный (`catalog${q}`) или с подставленным расширением (`export.${fmt}`),
 * статически не раскрывается. Такие перечислены в BASELINE с причиной. Делать
 * вид, что они проверены, вреднее, чем сказать прямо.
 */

const BACKEND = path.join(__dirname, "..", "src");
const FRONTEND = path.join(__dirname, "..", "..", "frontend", "src");

/**
 * Известные несовпадения на 28.08.2026. Список обязан только сокращаться.
 *
 * Первые семь — НАСТОЯЩИЕ дефекты модуля build: клиент и сервер писались по
 * разным договорам и не встретились. Правит владелец модуля; разбор лежит в
 * `15-Аудиты-и-сводки/BUILD-кнопка-и-страницы-зовут-несуществующее-28-08.md`.
 * Молча переставить путь нельзя — потеряются реферал, навыки и город.
 *
 * Остальные — предел прибора, а не дефекты.
 */
const BASELINE: Record<string, string> = {
  "/api/build/quick-apply": "ДЕФЕКТ: ручки нет вовсе; кнопка «Быстрый отклик» на карточке вакансии",
  "/api/build/workers/my-availability": "ДЕФЕКТ: сервер отдаёт /api/build/availability/me",
  "/api/build/workers/availability": "ДЕФЕКТ: сервер отдаёт /api/build/availability",
  "/api/build/safety/template": "ДЕФЕКТ: сервер отдаёт /api/build/safety-briefing/template",
  "/api/build/shifts/:p/safety-briefing": "ДЕФЕКТ: сервер отдаёт POST /api/build/safety-briefing",
  "/api/build/video-rooms": "ДЕФЕКТ: сервер отдаёт /api/build/video/rooms",
  "/api/build/video-rooms/:p/invite": "ДЕФЕКТ: сервер отдаёт /api/build/video/rooms/:id/invite",

  "/api/startupx:p": "предел прибора: витрина биржи собирает адрес шаблоном `/api/startupx${path}` в одном помощнике (lib.ts). Проверено 30.08.2026 при сведении: единственный литеральный путь /assess на сервере ЕСТЬ, монтирование /api/startupx совпадает с тем, что зовёт сайт. Это не пропавшая ручка, а неразвёрнутый шаблон",
  "/api": "предел прибора: apiBase собирает префикс, это не адрес",
  "/api/:p/:p": "предел прибора: оба сегмента — переменные",
  "/api/:p/concept-stats": "предел прибора: первый сегмент — идентификатор модуля",
  "/api/:p/eta": "предел прибора: первый сегмент — идентификатор модуля",
  "/api/:p/status": "предел прибора: первый сегмент — идентификатор модуля",
  "/api/:p/waitlist": "предел прибора: первый сегмент — идентификатор модуля",
  "/api/aevion/catalog:p": "предел прибора: строка склеена, а не сегмент",
  "/api/bank/test-webhook/:p": "предел прибора: сегмент собирается из переменной",
  "/api/build/bookmarks:p": "предел прибора: строка склеена",
  "/api/bureau/admin/verifications:p": "предел прибора: строка склеена",
  "/api/constitution/scenarios":
    "НЕ дефект и НЕ вызов: строка из таблицы документации на странице /constitution/api. " +
    "Ручка существует — прод отвечает 200 (контроль: выдуманный сосед даёт 404), но резолвер " +
    "её объявления не находит. Оставлено с причиной, а не выдано за находку.",
  "/api/multichat/conversations/:p/export.:p": "предел прибора: расширение подставляется",
  "/api/qcoreai": "предел прибора: базовый префикс, дописывается дальше",
  "/api/qcoreai/runs/:p/messages": "проверить отдельно: возможна разница в методе",
  "/api/qpaynet/admin/kyc/:p/:p": "предел прибора: действие — переменный сегмент",
  "/api/qpaynet/admin/wallets/:p/:p": "предел прибора: действие — переменный сегмент",
};

/** Известные расхождения по МЕТОДУ на 28.08.2026. Только сокращать. */
const VERB_BASELINE: Record<string, string> = {
  "POST /api/build/shifts/:p/checkin": "ДЕФЕКТ: сервер ждёт PATCH — работник не может начать смену",
  "POST /api/build/shifts/:p/checkout": "ДЕФЕКТ: сервер ждёт PATCH — не может закончить смену",
  "GET /api/build/payment-calendar": "ДЕФЕКТ: сервер отдаёт GET /payment-calendar/my",
};

function walk(dir: string, ok: (f: string) => boolean, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ok, acc);
    else if (ok(name)) acc.push(p.split(path.sep).join("/"));
  }
  return acc;
}

const lastIdent = (s: string): string | null => /([A-Za-z_]\w*)\s*$/.exec(s.trim())?.[1] ?? null;

/** Все маршруты, которые сервер (или сам Next) действительно отдаёт. */
const VERBS = new Map<string, Set<string>>();

function allRoutes(): string[] {
  VERBS.clear();
  const files = walk(BACKEND, (n) => n.endsWith(".ts"));
  const src = new Map<string, string>();
  for (const f of files) src.set(f, readFileSync(f, "utf8"));
  const idx = [...src.keys()].find((f) => f.endsWith("/src/index.ts"))!;

  const resolve = (from: string, rel: string): string | null => {
    const base = path.dirname(from);
    const p = path.join(base, rel).split(path.sep).join("/");
    for (const cand of [p + ".ts", p + "/index.ts"]) if (src.has(cand)) return cand;
    return null;
  };

  // Что означает имя внутри файла: своё объявление или импорт из другого файла.
  const targets = new Map<string, Map<string, string>>(); // file -> name -> "file::name"
  for (const [f, s] of src) {
    const t = new Map<string, string>();
    for (const m of s.matchAll(/^(?:export )?const ([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:express\.)?Router\(/gm)) {
      t.set(m[1], `${f}::${m[1]}`);
    }
    for (const m of s.matchAll(/^import\s+([A-Za-z_]\w*)\s+from\s+"([./][^"]+)"/gm)) {
      const tf = resolve(f, m[2]);
      if (!tf) continue;
      const d = /^export default ([A-Za-z_]\w*)\s*;?\s*$/m.exec(src.get(tf)!);
      if (d) t.set(m[1], `${tf}::${d[1]}`);
    }
    for (const m of s.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"([./][^"]+)"/gm)) {
      const tf = resolve(f, m[2]);
      if (!tf) continue;
      for (const raw of m[1].split(",")) {
        const parts = raw.trim().split(" as ");
        const local = parts[parts.length - 1].trim();
        const orig = parts[0].trim();
        if (local && !t.has(local)) t.set(local, `${tf}::${orig}`);
      }
    }
    targets.set(f, t);
  }

  const prefixes = new Map<string, Set<string>>();
  const add = (key: string, p: string) => {
    if (!prefixes.has(key)) prefixes.set(key, new Set());
    prefixes.get(key)!.add(p);
  };

  for (const m of src.get(idx)!.matchAll(/app\.use\(\s*"(\/api[a-zA-Z0-9\-/]*)"\s*,([\s\S]*?)\)\s*;/g)) {
    const c = lastIdent(m[2]);
    const key = c ? targets.get(idx)!.get(c) : undefined;
    if (key) add(key, m[1]);
  }
  for (const [f, s] of src) {
    for (const m of s.matchAll(/path:\s*"(\/api[a-zA-Z0-9\-/]*)"\s*,\s*router:\s*([A-Za-z_]\w*)/g)) {
      const key = targets.get(f)!.get(m[2]);
      if (key) add(key, m[1]);
    }
  }

  const edges: Array<[string, string, string]> = [];
  for (const [f, s] of src) {
    for (const m of s.matchAll(/([a-zA-Z_]\w*)\.use\(\s*"([^"]*)"\s*,([\s\S]*?)\)\s*;/g)) {
      const parent = targets.get(f)!.get(m[1]);
      const c = lastIdent(m[3]);
      const child = c ? targets.get(f)!.get(c) : undefined;
      if (parent && child) edges.push([parent, m[2], child]);
    }
  }
  for (let i = 0; i < 10; i++) {
    let grew = false;
    for (const [parent, p, child] of edges) {
      for (const pre of [...(prefixes.get(parent) ?? [])]) {
        const np = (pre.replace(/\/$/, "") + "/" + p.replace(/^\/|\/$/g, "")).replace(/\/$/, "");
        if (!prefixes.get(child)?.has(np)) { add(child, np); grew = true; }
      }
    }
    if (!grew) break;
  }

  const routes = new Set<string>();
  for (const [f, s] of src) {
    if (!f.includes("/routes/")) continue;
    const own = new Set(
      [...s.matchAll(/^(?:export )?const ([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:express\.)?Router\(/gm)].map((m) => m[1]),
    );
    for (const m of s.matchAll(/^([a-zA-Z_]\w*)\.(get|post|put|patch|delete)\(\s*[`"']([^`"']*)[`"']/gm)) {
      if (!own.has(m[1])) continue;
      for (const pre of prefixes.get(`${f}::${m[1]}`) ?? []) {
        const full = (pre.replace(/\/$/, "") + "/" + m[3].replace(/^\//, "")).replace(/\/$/, "") || "/";
        routes.add(full);
        VERBS.set(full, (VERBS.get(full) ?? new Set<string>()).add(m[2].toUpperCase()));
      }
    }
  }
  // Маршруты, объявленные прямо на app — их легко забыть, и один такой
  // (/api/globus/projects) уже попадал в «мёртвые», отвечая на проде 200.
  for (const m of src.get(idx)!.matchAll(/^app\.(get|post|put|patch|delete)\(\s*[`"']([/][^`"']*)[`"']/gm)) {
    const full = m[2].replace(/\/$/, "") || "/";
    routes.add(full);
    VERBS.set(full, (VERBS.get(full) ?? new Set<string>()).add(m[1].toUpperCase()));
  }
  // Собственные ручки Next: часть /api/* обслуживает сам сайт.
  for (const f of walk(path.join(FRONTEND, "app", "api"), (n) => n.startsWith("route."))) {
    const rel = f.slice(f.indexOf("/app/api") + 4);
    const full =
      rel.replace(/\/route\.[tj]sx?$/, "").replace(/\[\.\.\.[^\]]+\]/g, "*").replace(/\[[^\]]+\]/g, ":p") || "/";
    routes.add(full);
    // Методы Next-ручки — её экспорты. Без них POST /api/metrics выглядел бы
    // расхождением, и я почти записал это «долгом прибора с ненайденной
    // причиной». Причина была одна: в шаблоне ниже стояла граница слова,
    // записанная слэшем с буквой b. На границе вызова она превратилась в
    // ЛИТЕРАЛЬНЫЙ управляющий символ backspace: регулярка стала требовать
    // невозможного и молча перестала находить что-либо. Границу слова убрал —
    // перечисление глаголов и так однозначно.
    const body = readFileSync(f, "utf8");
    for (const vm of body.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g)) {
      VERBS.set(full, (VERBS.get(full) ?? new Set<string>()).add(vm[1]));
    }
  }
  return [...routes];
}

/** Адреса, стоящие АРГУМЕНТОМ у вызова: строка в тексте страницы — не вызов. */
function clientCalls(): Map<string, string> {
  const out = new Map<string, string>();
  const files = walk(
    FRONTEND,
    (n) => (n.endsWith(".ts") || n.endsWith(".tsx")) && !n.includes(".test."),
  ).filter((f) => !f.includes("__tests__"));
  // Список обёрток. Модуль со СВОЕЙ обёрткой под другим именем сторож
  // пропускал целиком: smeta-trainer зовёт через api(...), и его вызовы были
  // невидимы. Замер после расширения: 933 видимых адреса вместо 917 и НОЛЬ
  // новых расхождений — слепота сужала охват, но дефектов не прятала.
  //
  // Граница, которая остаётся: адрес, собранный в переменную заранее
  // (const url = ...; fetch(url)), сюда не попадёт. Это названо, а не скрыто.
  const CALLER = /(?:fetch|apiUrl|api|call|req|request|apiFetch|authFetch|get|post|put|patch|del)\s*(?:<[^>]*>)?\s*\(/g;
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(CALLER)) {
      const win = s.slice(m.index! + m[0].length, m.index! + m[0].length + 200);
      const sm = /["`'](?:\/api-backend)?(\/api\/[^"`'\s]*)["`']/.exec(win);
      if (!sm) continue;
      const p = (sm[1].split("?")[0].replace(/\$\{[^}]*\}/g, ":p").replace(/\/$/, "") || "/");
      if (p.includes("${")) continue;
      if (!out.has(p)) out.set(p, f.slice(f.indexOf("/frontend/") + 1));
    }
  }
  return out;
}

function toRe(route: string): RegExp {
  const body = route
    .split("/")
    .map((p) => (p.startsWith(":") ? "[^/]+" : p === "*" ? ".*" : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp("^" + body + "$");
}

/**
 * Вызовы, у которых метод указан ЯВНО: `call("POST", "/api/...")` или
 * `fetch("/api/...", { method: "PATCH" })`. Совпадения пути мало — express
 * отвечает 404 и когда путь есть, а глагол другой, и снаружи это неотличимо
 * от отсутствующего адреса.
 */
function callsWithVerb(): Array<{ verb: string; path: string; where: string }> {
  const out: Array<{ verb: string; path: string; where: string }> = [];
  const seen = new Set<string>();
  const files = walk(FRONTEND, (n) => (n.endsWith(".ts") || n.endsWith(".tsx")) && !n.includes(".test."))
    .filter((f) => !f.includes("__tests__"));
  const norm = (raw: string) =>
    (raw.split("?")[0].replace(/[$]{[^}]*}/g, ":p").replace(/\$/, "") || "/");
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const where = f.slice(f.indexOf("/frontend/") + 1);
    const push = (verb: string, raw: string) => {
      const path = norm(raw);
      if (path.includes("${")) return;
      const key = verb + " " + path;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ verb, path, where });
    };
    for (const m of src.matchAll(
      /\b(?:call|req|request)\s*(?:<[^>]*>)?\s*\(\s*["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*["`'](?:\/api-backend)?(\/api\/[^"`'\s]*)["`']/g,
    )) push(m[1], m[2]);
    for (const m of src.matchAll(
      /fetch\s*\(\s*["`'](?:\/api-backend)?(\/api\/[^"`'\s]*)["`'][^)]{0,300}?method:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/gs,
    )) push(m[2], m[1]);
  }
  return out;
}

// Сканирование файлов делается ОДИН раз на файл, а не в каждом тесте.
//
// Было: четыре теста, и каждый заново обходил бэкенд и фронт (allRoutes() +
// clientCalls()). В одиночку файл проходил, а в общем прогоне под нагрузкой
// последний тест падал по таймауту 30 с — 28.08.2026 это дважды выглядело как
// провал правки, которая тут ни при чём, и один раз обесценило мутационную
// проверку (на красной базе она всегда отвечает «поймана»).
//
// Наращивать таймаут НЕ стал намеренно: в правилах записано, что это ложный
// путь. Причина была в четырёхкратной работе, её и убрал.
const ROUTES = allRoutes();
const PATS = ROUTES.map(toRe);
const CALLS = clientCalls();

describe("сайт не зовёт адресов, которых сервер не отдаёт", () => {
  test("контроль прибора: обе стороны собраны", () => {
    // Пустая любая сторона дала бы зелёный на любом состоянии кода.
    const routes = ROUTES;
    expect(routes.length, "маршруты сервера не собрались").toBeGreaterThan(1000);
    expect(CALLS.size, "вызовы сайта не собрались").toBeGreaterThan(500);
    // Заведомо существующий адрес обязан находиться, заведомо выдуманный — нет.
    const pats = PATS;
    const hit = (c: string) => pats.some((rx) => rx.test(c));
    expect(hit("/api/build/vacancies"), "не видит заведомо живого адреса").toBe(true);
    expect(hit("/api/build/vydumannyi-xyz-zzz"), "признал выдуманный адрес").toBe(false);
  });

  test("список несовпадений не пополнился", () => {
    const pats = PATS;
    const fresh: string[] = [];
    for (const [c, where] of CALLS) {
      if (c.startsWith("/api-backend")) continue;
      if (/\.\.\.|\{|\[|\]/.test(c)) continue;
      if (BASELINE[c]) continue;
      if (pats.some((rx) => rx.test(c.replace(/:p/g, "__X__")))) continue;
      fresh.push(`${c}  <- ${where}`);
    }
    expect(
      fresh,
      "сайт зовёт адрес, которого сервер не отдаёт. Снаружи это выглядит " +
        "исправной кнопкой: запрос уходит, ошибку видит пользователь, а не " +
        "автор. Либо поправьте путь, либо заведите маршрут; если адрес " +
        "собирается из переменной и статически не раскрывается — внесите в " +
        "BASELINE с причиной.",
    ).toEqual([]);
  });

  test("метод вызова совпадает с методом маршрута", () => {
    // Путь совпал, а глагол нет — express отвечает тем же 404, и отличить это
    // от отсутствующего адреса снаружи нельзя. Так в модуле build работник не
    // мог ни начать смену, ни закончить её: клиент шлёт POST, сервер ждёт PATCH.
    const paths = ROUTES;
    const pats = paths.map((p) => [p, toRe(p)] as const);
    const bad: string[] = [];
    for (const { verb, path, where } of callsWithVerb()) {
      const probe = path.replace(/:p/g, "__X__");
      const hits = pats.filter(([, rx]) => rx.test(probe)).map(([p]) => p);
      if (hits.length === 0) continue; // путь не найден — это другой класс, он выше
      const allowed = new Set<string>();
      for (const h of hits) for (const v of VERBS.get(h) ?? []) allowed.add(v);
      if (allowed.size === 0) continue; // метод маршрута не распознан — не выдумываем
      if (allowed.has(verb)) continue;
      const key = `${verb} ${path}`;
      if (VERB_BASELINE[key]) continue;
      bad.push(`${key}  сервер: ${[...allowed].sort().join(",")}  <- ${where}`);
    }
    expect(
      bad,
      "клиент шлёт не тот глагол. Снаружи это неотличимо от несуществующего " +
        "адреса: express отвечает 404, и жаловаться придёт пользователь.",
    ).toEqual([]);
  });

  test("починенное вычеркнуто из списка", () => {
    const pats = PATS;
    const calls = CALLS;
    const stale = Object.keys(BASELINE).filter(
      (c) => !calls.has(c) || pats.some((rx) => rx.test(c.replace(/:p/g, "__X__"))),
    );
    expect(
      stale,
      "эти адреса уже сходятся или больше не зовутся — вычеркните их из BASELINE",
    ).toEqual([]);

    // Линия по МЕТОДАМ протухает так же и молча: сервер начнёт принимать
    // нужный глагол, а строка останется и однажды прикроет настоящий дефект.
    const paths = ROUTES;
    const live = new Map<string, Set<string>>();
    for (const { verb, path: p } of callsWithVerb()) {
      live.set(p, (live.get(p) ?? new Set<string>()).add(verb));
    }
    const staleVerbs = Object.keys(VERB_BASELINE).filter((key) => {
      const [verb, p] = key.split(" ");
      if (!live.get(p)?.has(verb)) return true; // так больше не зовут
      const hits = paths.filter((r) => toRe(r).test(p.replace(/:p/g, "__X__")));
      const allowed = new Set<string>();
      for (const h of hits) for (const v of VERBS.get(h) ?? []) allowed.add(v);
      return allowed.size > 0 && allowed.has(verb); // сервер уже принимает
    });
    expect(
      staleVerbs,
      "эти расхождения по методу уже сошлись — вычеркните их из VERB_BASELINE",
    ).toEqual([]);
  });
});
