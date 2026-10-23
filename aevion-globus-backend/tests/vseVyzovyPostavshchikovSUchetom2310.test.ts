import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * 23.10.2026: сводка бэка «[qcoreai] платные вызовы БЕЗ учёта за процесс: unknown=659» за 4 часа после
 * выкатки — расход денег вслепую: вызовы callProvider без meter не называют ни модуль, ни пользователя.
 * Сторож: в src/ нет ни одного вызова callProvider / callProviderResilient без meter (module или
 * идентификатор meter в аргументах). Сканер — scripts/scan-unmetered-calls.mjs (ESM), тот же, что
 * печатает список руками. Контроль: сканер ВИДИТ вызов без учёта на образце (иначе «0» = «не умею искать»).
 */
const require = createRequire(__filename);
const ROOT = path.join(__dirname, "..", "src");
const загрузить = () => import(/* @vite-ignore */ path.join(__dirname, "..", "scripts", "scan-unmetered-calls.mjs").replace(/\\/g, "/"));
void require;

describe("все платные вызовы поставщиков ИИ идут с учётом (meter)", () => {
  it("КОНТРОЛЬ: сканер находит вызов без учёта и не трогает вызов с module", async () => {
    const { findCalls } = await загрузить();
    const образец = `
      const a = await callProvider(p.id, msgs, "m", 0.2);
      const b = await callProvider(p.id, msgs, "m", 0.2, undefined, undefined, { module: "x" });
      const c = await callProviderResilient(p.id, msgs, "m", 0.2, meter);
      // callProvider() упомянут в комментарии
    `;
    const calls = findCalls(образец, "образец.ts");
    expect(calls.length, "вызовов в образце").toBe(3);
    expect(calls.filter((c: { metered: boolean }) => !c.metered).length, "без учёта в образце").toBe(1);
  });

  it("в src/ вызовов без учёта — 0 (знаменатель: все вызовы)", async () => {
    const { scanDir } = await загрузить();
    const all = scanDir(ROOT) as Array<{ file: string; line: number; fn: string; metered: boolean }>;
    expect(all.length, "знаменатель: вызовов callProvider* в src").toBeGreaterThan(30);
    const bad = all.filter((c) => !c.metered);
    expect(bad.map((c) => `${c.file}:${c.line}`), "вызовы без meter").toEqual([]);
  });

  it("DevHub-генерация и перевод i18n помечены своими модулями", async () => {
    const { scanDir } = await загрузить();
    const all = scanDir(ROOT) as Array<{ file: string; line: number; module: string | null }>;
    const devhub = all.filter((c) => /routes\/devhub\.ts$/.test(c.file));
    expect(devhub.length).toBeGreaterThanOrEqual(5);
    for (const c of devhub) expect(c.module, `${c.file}:${c.line}`).toBe("devhub-gen");
    const i18n = all.filter((c) => /routes\/i18n\.ts$/.test(c.file));
    expect(i18n.length).toBe(1);
    expect(i18n[0].module).toBe("i18n");
  });
});
