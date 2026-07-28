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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
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
      if (!COSTLY.test(body)) continue;
      costly++;
      // Защита ищется в объявлении (middleware) ИЛИ в теле (квота).
      if (PROTECTED.test(body)) continue;
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

  it("у каждой дорогой ручки есть ограничитель или квота", () => {
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
