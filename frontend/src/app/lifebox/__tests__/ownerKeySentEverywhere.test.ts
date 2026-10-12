/*
 * Страница LifeBox шлёт ключ владельца во ВСЕ запросы к капсулам и показывает
 * его один раз (бэкенд: lib/lifeboxOwnerKey.ts, 12.10.2026). Забытый заголовок
 * в одном запросе = владелец получает 403 на своей же капсуле.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"), "utf8");

describe("LifeBox: ключ владельца на странице", () => {
  it("каждый запрос к /capsules несёт заголовок ключа", () => {
    const вызовы = SRC.match(/fetch\(\s*`\$\{API\}\/capsules[\s\S]*?\)\s*[,;]/g) ?? [];
    expect(вызовы.length, "не нашёл запросов к /capsules — сторож ослеп").toBeGreaterThanOrEqual(4);
    for (const в of вызовы) expect(в, в.slice(0, 80)).toMatch(/заголовкиКлюча\(/);
  });

  it("выданный ключ запоминается и показывается", () => {
    expect(SRC).toMatch(/запомнитьКлюч\(payload\.alias, j\.ownerKey\)/);
    expect(SRC).toContain('data-testid="lifebox-new-key"');
    expect(SRC).toContain('data-testid="lifebox-need-key"');
  });
});
