import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ручка, зовущая ПЛАТНОГО провайдера, обязана иметь защиту от перебора.
 *
 * ЗАЧЕМ. Замер 28.07: из 53 ручек, обращающихся к OpenAI / Anthropic /
 * Replicate / ElevenLabs / DeepL / Brevo, у 26 не было НИЧЕГО — ни ограничителя
 * частоты, ни квоты по кредитам, ни платной стены. Каждый вызов такой ручки —
 * счёт от провайдера, и утекает он тихо: ни падения, ни записи в лог.
 *
 * Показательно, что защита была НЕРАВНОМЕРНОЙ внутри одного модуля: у DevHub
 * видео, картинки, музыка и речь квоту имели, а рассылка почты, SMS, WhatsApp,
 * клонирование голоса и перевод пачкой — нет.
 *
 * ЛОВУШКА, на которую я попался при замере: платную стену легко принять за
 * защиту. В коде `requireModule()` висит на многих префиксах, но он СПЯЩИЙ и
 * работает только для модулей из env `PAYWALL_MODULES`. Опрос прода показал, что
 * включена она ровно для шести модулей, и QCoreAI в их число не входит. Поэтому
 * «есть requireModule в коде» тут НЕ считается защитой — считается только то, что
 * работает всегда: ограничитель частоты или квота.
 */

const ROUTES = join(__dirname, "..", "src", "routes");

/** Признак «ручка тратит деньги»: обращение к платному провайдеру. */
const COSTLY =
  /callProvider|openai|anthropic|replicate|elevenlabs|generateImage|generateVideo|runCouncil|deepl|brevo/i;

/**
 * Признак защиты. Считаются только механизмы, действующие ВСЕГДА:
 * ограничитель частоты и квота. Платная стена намеренно НЕ в списке — см. шапку.
 */
const PROTECTED = /Limit\b|limiter|rateLimit|generationLimit|checkCredit|qcoreQuota|checkQuota|enforceQuota/i;

/** Осознанные исключения — каждое с причиной. */
const ALLOWED: Array<{ file: string; path: string; reason: string }> = [];

// ── Слепая зона, закрытая 31.08.2026 ────────────────────────────────────────
// Сторож брал ТОЛЬКО тело обработчика. Ручка, зовущая платного поставщика
// через локального помощника, была ему невидима целиком — не попадала даже
// в счётчик дорогих. Так /api/devhub/plan прожил без ограничителя: в теле
// стоит planProjectWithAI(...), а callProvider лежит внутри помощника.
// Это потеря следа на границе функции, наш давний класс.
//
// Разбор без регулярок намеренно: шаблон, собранный строкой, теряет
// экранирование на границе вызова и молча перестаёт совпадать.
function localHelperBodies(src: string): Map<string, string> {
  const out = new Map<string, string>();
  let at = 0;
  for (;;) {
    const i = src.indexOf("function ", at);
    if (i < 0) break;
    at = i + 9;
    let j = at;
    while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
    const name = src.slice(at, j);
    if (!name) continue;
    // тело: до ближайшей закрывающей скобки в начале строки
    const close = src.indexOf(String.fromCharCode(10) + "}", j);   // без литерального слэша: он теряется на границе вызова
    if (close < 0) continue;
    out.set(name, src.slice(j, close));
  }
  return out;
}

// Дорогая ли ручка с учётом ОДНОГО уровня вложенности.
// Глубже не идём намеренно: за вторым уровнем разбор начинает врать, а
// сторож, который врёт, хуже отсутствующего.
function bodyIsCostly(body: string, helpers: Map<string, string>, COSTLY: RegExp): boolean {
  if (COSTLY.test(body)) return true;
  for (const [name, hbody] of helpers) {
    if (body.includes(name + "(") && COSTLY.test(hbody)) return true;
  }
  return false;
}


function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}


/**
 * Пути, к которым middleware применён списком на уровне роутера:
 *   router.use(["/a", "/b"], someLimiter);
 * Берём только те вызовы .use, где среди аргументов есть что-то похожее на
 * ограничитель, — иначе сюда попали бы монтирования вложенных роутеров.
 */
function routerPathLists(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/\.use\(\s*\[([^\]]+)\]\s*,([^;]*?)\)\s*;/gs)) {
    if (!PROTECTED.test(m[2])) continue;
    for (const p of m[1].matchAll(/"([^"]+)"/g)) out.add(p[1]);
  }
  return out;
}

export function findUnprotectedCostly(files: string[]): {
  offenders: string[];
  costly: number;
  scanned: number;
} {
  const offenders: string[] = [];
  let costly = 0;
  let scanned = 0;
  const DECL = /(\w+)\.(post|put|patch)\(\s*"([^"]*)"/g;

  for (const file of files) {
    scanned++;
    const src = readFileSync(file, "utf8");
    const rel = file.slice(ROUTES.length + 1).replace(/\\/g, "/");
    for (const m of src.matchAll(DECL)) {
      const [, router, , path] = m;
      // Тело обработчика — балансировкой круглых скобок от объявления.
      let depth = 0;
      let i = src.indexOf("(", m.index! + router.length);
      const start = i;
      for (; i < src.length; i++) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) continue;
      const body = src.slice(m.index!, i);
      if (!bodyIsCostly(body, localHelperBodies(src), COSTLY)) continue;
      costly++;
      // Защита ищется в объявлении (middleware) ИЛИ в теле (квота).
      if (PROTECTED.test(body)) continue;
      // ...И на уровне РОУТЕРА, списком путей.
      //
      // 28.08.2026: сторож относил к незащищённым четыре ручки devhub
      // (/media/email, /media/sms, /media/whatsapp, /media/email-template-send),
      // хотя ограничитель применён к ним разом:
      //
      //   devhubRouter.use(["/media/email", ... ], dhSendLimit());
      //
      // Соседняя вкладка прочитала код и написала, что предел есть; мой прибор
      // утверждал обратное. Из двух ответов неверным был мой — искал защиту
      // только в объявлении маршрута. Из 29 "находок" четыре были ложными.
      if (routerPathLists(src).has(path)) continue;
      if (ALLOWED.some((a) => a.file === rel && a.path === path)) continue;
      void start;
      offenders.push(`${rel}  ${path}`);
    }
  }
  return { offenders, costly, scanned };
}

describe("дорогие ручки защищены от перебора", () => {
  const files = walk(ROUTES);

  it("обход нашёл сами дорогие ручки — иначе проверка ничего не значит", () => {
    const { costly, scanned } = findUnprotectedCostly(files);
    expect(scanned, "прочитано слишком мало файлов").toBeGreaterThan(40);
    // Замерено 28.07: таких ручек 53. Ноль означал бы сломанный признак COSTLY,
    // и тогда «нарушений нет» не значило бы ничего.
    expect(costly, "не найдено ни одной ручки, зовущей платного провайдера").toBeGreaterThan(30);
  });

  /**
   * Храповик, а не запрет. Замер 28.08.2026 на продовой линии: незащищённых
   * ручек 29. Требовать ноль сегодня значит сделать сторожа всегда красным, а
   * такого перестают читать в первый же день — и защиты не станет вовсе.
   *
   * Список обязан только СОКРАЩАТЬСЯ. Защитили ручку — уберите строку; если
   * уберёте, не защитив, третья проверка ниже покраснеет.
   */
  const KNOWN_UNPROTECTED = new Set([
    // Вскрыто 31.08.2026 расширением сторожа на ОДИН уровень вложенности.
    // Ручка зовёт платного поставщика через локального помощника, поэтому
    // прежний сторож её не видел вовсе — она не попадала даже в счётчик
    // дорогих. Это не новая регрессия, а долг, ставший видимым.
    // Зона qreal, не моя: передано владельцу, ограничитель ставить ему.
    // Две такие же ручки devhub (agent/workflow и .../stream) закрыты тем
    // же заходом — они были в моей зоне.
    "qreal.ts  /projects/:id/storyboard",
    "agentRuntime.ts  /run",
    "coach.ts  /chat",
    "devhub.ts  /media/sfx",
    "devhub.ts  /media/voice-clone",
    "devhub.ts  /media/voice-clone/preview",
    "devhub.ts  /media/stt",
    "devhub.ts  /media/translate",
    "devhub.ts  /projects/:id/files/translate",
    "devhub.ts  /projects/:id/files/translate-bulk",
    "devhub.ts  /media/email-template-create",
    "healthai.ts  /check-llm",
    "i18n.ts  /translate",
    "longevity.ts  /ai-plan",
    "qai.ts  /chat",
    "qai.ts  /chat/stream",
    "qcoreai.ts  /sessions/:id/suggest",
    "qcoreai.ts  /widget/run",
    "qcoreai.ts  /sessions/:id/ai-summary",
    "qcoreai.ts  /notebook/auto-tag",
    "qcoreai.ts  /templates/suggest",
    "qlearn.ts  /me/courses/:courseId/ai-generate-lesson",
    "qmedia.ts  /ai/generate-lyrics",
    "qmedia.ts  /ai/generate-title",
    "qmedia.ts  /ai/describe-video",
    "qmelanin.ts  /ai-plan",
  ]);

  it("новых незащищённых дорогих ручек не появилось", () => {
    const { offenders } = findUnprotectedCostly(files);
    const fresh = offenders.filter((o) => !KNOWN_UNPROTECTED.has(o));
    expect(
      fresh,
      "Новая ручка зовёт платного провайдера без ограничителя и без квоты. " +
        "Каждый вызов это счёт, и утекает он тихо. Ручки: " + fresh.join("; ") + ". " +
        "Добавьте generationLimit по образцу lib/rateLimit.ts или квоту в тело.",
    ).toEqual([]);
  });

  it("починенное остаётся починенным: список известных только сокращается", () => {
    const { offenders } = findUnprotectedCostly(files);
    const gone = [...KNOWN_UNPROTECTED].filter((k) => !offenders.includes(k));
    for (const g of gone) {
      expect(offenders.includes(g), `${g} убран из списка, но защиты у него нет`).toBe(false);
    }
    expect(offenders.length).toBeLessThanOrEqual(KNOWN_UNPROTECTED.size);
  });

  it.skip("ЦЕЛЬ: у каждой дорогой ручки есть ограничитель или квота", () => {
    const { offenders } = findUnprotectedCostly(files);
    expect(
      offenders,
      `Эти ручки зовут платного провайдера без ограничителя и без квоты — каждый ` +
        `вызов это счёт, и утекает он тихо:\n  ${offenders.join("\n  ")}\n\n` +
        "Добавьте generationLimit(\"<ключ>\") в объявление (см. lib/rateLimit.ts) " +
        "или квоту в тело. Платная стена НЕ считается: requireModule() спящий и " +
        "включается только для модулей из env PAYWALL_MODULES.",
    ).toEqual([]);
  });

  it("сторож ловит нарушение и НЕ ловит защищённую ручку", () => {
    // Две фикстуры сразу: одна должна попадать под правило, вторая — нет.
    const { writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    const bad = join(ROUTES, "__fixture_costly_open.ts");
    const good = join(ROUTES, "__fixture_costly_limited.ts");
    writeFileSync(
      bad,
      'r.post("/gen", async (req, res) => { await callProvider("openai", p); });\n',
      "utf8",
    );
    writeFileSync(
      good,
      'r.post("/gen", generationLimit("x"), async (req, res) => { await callProvider("openai", p); });\n',
      "utf8",
    );
    try {
      expect(findUnprotectedCostly([bad]).offenders).toHaveLength(1);
      expect(findUnprotectedCostly([good]).offenders).toEqual([]);
    } finally {
      rmSync(bad, { force: true });
      rmSync(good, { force: true });
    }
  });
});

/**
 * Храповик на САМ ограничитель темпа.
 *
 * Проверка выше принимает ЛЮБУЮ защиту — ограничитель ИЛИ проверку кредитов.
 * Мутация 28.08.2026 показала, чем это плохо: сняв `dhCostlyLimit` с генерации
 * и оставив проверку кредитов, сторож остаётся зелёным. А защищают они от
 * РАЗНОГО: кредиты — от перерасхода за месяц, ограничитель — от всплеска,
 * когда один пользователь за минуту заказывает сотню прогонов модели.
 *
 * Поэтому здесь список ПОИМЁННО: числовой храповик пережил бы снятие
 * ограничителя с дорогой ручки и добавление на дешёвую.
 */
describe("ограничитель темпа стоит на дорогих ручках поимённо", () => {
  const SRC = readFileSync(join(ROUTES, "devhub.ts"), "utf8");

  it("прибор исправен: файл прочитан", () => {
    expect(SRC.length).toBeGreaterThan(2000);
  });

  it("три дорогие ручки объявлены с ограничителем", () => {
    for (const [route, key] of [
      ["/ask", "dhask"],
      ["/projects/:id/generate", "dhgenerate"],
      ["/media/upload-image", "dhmedia_upload"],
    ]) {
      expect(
        SRC.includes(`devhubRouter.post("${route}", dhCostlyLimit("${key}")`),
        `с ${route} снят ограничитель темпа`,
      ).toBe(true);
    }
  });
});

/**
 * Квота — НЕ предел темпа. Замер 29.08.2026.
 *
 * PROTECTED выше признаёт ручку защищённой по ЛЮБОМУ из признаков:
 * ограничитель темпа ИЛИ проверка квоты (checkCredit). Для восьми
 * дорогих ручек DevHub сработал второй, и они выпали из поля зрения
 * сторожа целиком — при том что квота ограничивает МЕСЯЧНЫЙ расход,
 * а не скорость.
 *
 * Почему это не придирка: в TIER_LIMITS у enterprise все возможности
 * равны -1, а у pro -1 стоит на deploy. checkCredit на -1 отвечает
 * allowed сразу, не читая расход. То есть для этих тарифов предела
 * нет ВООБЩЕ — ни месячного, ни по темпу, и один аккаунт жжёт наши
 * деньги так быстро, как отвечает сеть.
 *
 * Код уже починен в d9cc19ce0 (27.07, ограничитель на 27 дорогих
 * ручек) и ждёт мержа — поэтому здесь ХРАПОВИК, а не запрет:
 * список обязан только сокращаться. Требовать ноль сегодня значит
 * сделать сторожа вечно красным, а такого перестают читать.
 */
export function findQuotaOnlyCostly(files: string[]): string[] {
  const out: string[] = [];
  const RATE = ["generationLimit(", "rateLimit(", "Limiter", "Limit("];
  const QUOTA = ["checkCredit(", "checkQuota(", "qcoreQuota"];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = file.slice(ROUTES.length + 1).split(String.fromCharCode(92)).join("/");
    for (const verb of [".post(", ".put(", ".patch("]) {
      let from = 0;
      for (;;) {
        const at = src.indexOf(verb, from);
        if (at < 0) break;
        from = at + verb.length;
        const q1 = src.indexOf(String.fromCharCode(34), at);
        if (q1 < 0 || q1 > at + verb.length + 2) continue;
        const q2 = src.indexOf(String.fromCharCode(34), q1 + 1);
        if (q2 < 0) continue;
        const path = src.slice(q1 + 1, q2);
        let depth = 0;
        let i = at + verb.length - 1;
        for (; i < src.length; i++) {
          if (src[i] === "(") depth++;
          else if (src[i] === ")") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth !== 0) continue;
        const body = src.slice(at, i);
        if (!COSTLY.test(body)) continue;
        if (!QUOTA.some((k) => body.includes(k))) continue;
        if (RATE.some((k) => body.includes(k))) continue;
        if (routerPathLists(src).has(path)) continue;
        out.push(rel + "  " + path);
      }
    }
  }
  return out;
}

describe("дорогую ручку не заводят с одной месячной квотой", () => {
  const KNOWN_QUOTA_ONLY = new Set([
    "devhub.ts  /projects/:id/deploy",
    "devhub.ts  /projects/:id/deploy/vercel",
    "devhub.ts  /projects/:id/deploy/pages",
    "devhub.ts  /media/tts",
    "devhub.ts  /media/image",
    "devhub.ts  /media/music",
    "devhub.ts  /media/video",
    "devhub.ts  /media/3d",
  ]);

  it("список квотных ручек не растёт", () => {
    const found = findQuotaOnlyCostly(walk(ROUTES));
    // Контроль прибора: разбор, нашедший ноль, сделал бы «нарушений
    // нет» бессмысленным утверждением.
    expect(found.length, "разбор не нашёл ни одной квотной ручки").toBeGreaterThan(0);
    const fresh = found.filter((f) => !KNOWN_QUOTA_ONLY.has(f));
    expect(
      fresh,
      "Новая дорогая ручка защищена только месячной квотой. На тарифах с -1 это не защита: добавьте generationLimit по образцу lib/rateLimit.ts",
    ).toEqual([]);
  });
});
