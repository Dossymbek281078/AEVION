/**
 * Сторож достижимости страничной стены.
 *
 * ЗАЧЕМ. Страница рисует `<PaywallScreen>` только если ручка, которую она САМА
 * опрашивает через `fetchOrPaywall`, вернула 402. А бэкендовый гейт
 * (`planGate.isExemptPath`) намеренно оставляет открытыми `/health`, `/status`,
 * `/providers`, `/me/plan`, `/me/entitlements` даже на закрытом модуле. Значит,
 * страница с пробой в `/health` НИКОГДА не покажет стену — сколько бы модулей ни
 * стояло в `PAYWALL_MODULES`.
 *
 * Проверено запуском 11.08.2026: с `PAYWALL_MODULES=healthai` API отдаёт 402, а
 * `/healthai` — 200 и обычный контент. При этом `<PaywallScreen>` в файле есть.
 * Именно поэтому греп по компоненту трижды ввёл меня в заблуждение: сначала
 * совпадение внутри комментария, потом «рендерит» при недостижимой ветке, потом
 * неверный подсчёт на глаз.
 *
 * ЧТО ЭТОТ ТЕСТ НЕ УТВЕРЖДАЕТ. Он НЕ требует, чтобы каждая страница закрывалась.
 * Лендинг модуля разумно оставить публичной витриной — отказ пользователь всё
 * равно увидит глобальной модалкой при первом платном действии. Требование одно:
 * если ветка со стеной недостижима, это должно быть ЗАПИСАНО здесь осознанно, а
 * не выглядеть защитой, которой нет.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "..");

/**
 * Открытые подпути читаются ИЗ `planGate.ts`, а не переписываются сюда.
 *
 * Скопированный список — это ровно тот дефект, против которого написан весь этот
 * файл: он молча разойдётся с оригиналом при первом же изменении гейта, и сторож
 * начнёт врать с уверенным видом. Поэтому парсим `isExemptPath()` и падаем, если
 * распарсить не вышло, — лучше явная поломка, чем тихо неверная проверка.
 */
const PLAN_GATE = path.resolve(
  APP_ROOT,
  "../../../aevion-globus-backend/src/lib/planGate.ts",
);

function exemptSuffixes(): string[] {
  const src = readFileSync(PLAN_GATE, "utf8");
  const start = src.indexOf("function isExemptPath");
  const end = src.indexOf("}", src.indexOf("return (", start));
  const body = src.slice(start, end);
  const found = [...body.matchAll(/p === "([^"]+)"/g)].map((m) => m[1]);
  if (found.length === 0) {
    throw new Error(
      `Не удалось прочитать открытые подпути из ${PLAN_GATE}. Если isExemptPath ` +
        "переписали — почини разбор здесь, но не подставляй список руками.",
    );
  }
  return found;
}

/**
 * Страницы, чья стена НЕДОСТИЖИМА, и это осознанно. Причина обязательна: без неё
 * запись — просто способ заглушить сторож.
 */
const DISARMED: Array<{ page: string; reason: string }> = [
  { page: "healthai/page.tsx", reason: "лендинг модуля — публичная витрина, отказ показывает глобальная модалка" },
  { page: "longevity/page.tsx", reason: "то же: витрина протокола, продаётся PDF, гейт не про эту страницу" },
  { page: "multichat-engine/page.tsx", reason: "лендинг модуля — публичная витрина" },
  { page: "qcoreai/page.tsx", reason: "лендинг модуля; закрытая часть — /qcoreai/playground, она стену показывает" },
  { page: "qmelanin/page.tsx", reason: "лендинг модуля — публичная витрина" },
  { page: "qmelanin/track/page.tsx", reason: "трекер поверх того же лендинга, проба в общий health" },
  { page: "qrenew/page.tsx", reason: "лендинг модуля — публичная витрина" },
  { page: "qrenew/report/page.tsx", reason: "отчёт поверх того же лендинга, проба в общий health" },
  { page: "qskyway/page.tsx", reason: "лендинг модуля — публичная витрина" },
  { page: "smeta-trainer/page.tsx", reason: "лендинг модуля — публичная витрина" },
];

/** Страницы, где пробу не удаётся определить статически. */
const UNRESOLVED: Array<{ page: string; reason: string }> = [
  { page: "veilnetx/page.tsx", reason: "проба собирается не литералом; проверять запуском, а не разбором" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "__tests__") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

/** Код без комментариев — упоминание в комментарии не считается рендером. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

type Walled = { rel: string; probe: string | null };

let cache: Walled[] | null = null;

function walledPages(): Walled[] {
  if (cache) return cache;
  const out: Walled[] = [];
  for (const file of walk(APP_ROOT)) {
    const code = stripComments(readFileSync(file, "utf8"));
    if (!/<PaywallScreen/.test(code)) continue;
    const m =
      code.match(/fetchOrPaywall[^(]*\(\s*"([^"]+)"/) ??
      code.match(/apiUrl\(\s*"(\/api\/[^"]+)"/);
    out.push({
      rel: path.relative(APP_ROOT, file).replace(/\\/g, "/"),
      probe: m ? m[1] : null,
    });
  }
  cache = out;
  return out;
}

const isExempt = (probe: string) =>
  exemptSuffixes().some((suffix) => probe.split("?")[0].endsWith(suffix));

describe("страничная стена — либо достижима, либо признана недостижимой", () => {
  it("нет страниц с недостижимой стеной вне списка", () => {
    const surprises = walledPages()
      .filter((p) => p.probe !== null && isExempt(p.probe))
      .filter((p) => !DISARMED.some((d) => d.page === p.rel))
      .map((p) => `${p.rel}  проба: ${p.probe}`);

    expect(
      surprises,
      "Эти страницы рисуют <PaywallScreen>, но опрашивают ручку, которую гейт НЕ " +
        "закрывает (см. isExemptPath в planGate.ts) — значит, стена не покажется никогда:\n  " +
        surprises.join("\n  ") +
        "\n\nЛибо пробуй закрытую ручку (как /qcoreai/playground зовёт /api/qcoreai/chat), " +
        "либо впиши страницу в DISARMED С ПРИЧИНОЙ, если она должна остаться публичной.",
    ).toEqual([]);
  });

  it("нет страниц с неопределимой пробой вне списка", () => {
    const unknown = walledPages()
      .filter((p) => p.probe === null)
      .filter((p) => !UNRESOLVED.some((u) => u.page === p.rel))
      .map((p) => p.rel);
    expect(
      unknown,
      `У этих страниц не удалось определить пробу статически — впиши в UNRESOLVED ` +
        `с причиной либо приведи вызов к строковому литералу:\n  ${unknown.join("\n  ")}`,
    ).toEqual([]);
  });

  it("списки не протухли", () => {
    // Запись, которая больше ни на что не указывает, выглядит осознанным решением
    // и потому не перепроверяется. Это тихая дыра — ровно как в соседних сторожах.
    const present = new Set(walledPages().map((p) => p.rel));
    const stale = [...DISARMED, ...UNRESOLVED].filter((e) => !present.has(e.page)).map((e) => e.page);
    expect(
      stale,
      `Эти страницы больше не рисуют <PaywallScreen> — удали их из списков:\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });

  // ⚠️ ГРАНИЦА ЭТОГО УТВЕРЖДЕНИЯ, замерено мутацией 29.08.2026.
  // «Хотя бы одна» терпит потерю всех, кроме одной: сломал вызов
  // fetchOrPaywall на /healthai — проверка осталась зелёной, потому что
  // закрытыми оставались другие страницы. То есть она стережёт ИСЧЕЗНОВЕНИЕ
  // механизма целиком, а не пропажу стены на отдельной странице.
  // Это осознанный размен (иначе сторож краснел бы на каждой правке), но
  // знать о нём надо: зелёный цвет тут не значит «все стены на месте».
  it("хотя бы одна страница реально закрывается — иначе стена мертва во всём проекте", () => {
    // Если однажды ВСЕ страницы окажутся в DISARMED, компонент <PaywallScreen>
    // станет чистым украшением, и об этом надо узнать из теста, а не из продаж.
    const live = walledPages().filter((p) => p.probe !== null && !isExempt(p.probe));
    expect(
      live.length,
      "Ни одна страница не опрашивает закрытую ручку — <PaywallScreen> нигде не покажется.",
    ).toBeGreaterThan(0);
  });
});
