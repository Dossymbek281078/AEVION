import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/*
 * 28.10.2026 (окно «Приложения-2»). Баннеры оплаты подписывались «Разблокировать PsyApp Pro», «LifeBox Pro — безлимитные
 * капсулы», «DeepSan Pro…» и т. д. Ни одного такого Pro в продаже нет: кнопка ведёт на подписку Планеты (замер на проде
 * 9a21fceb8, put-do-kassy.mjs psyapp-deps, 5 пар окон, «AEVION Планета — 12 месяцев»), а бэкенды psyapp, lifebox, qpersona,
 * qstore, shadownet, deepsan подписку не проверяют. Подпись по умолчанию — из UpgradeButton («Выбрать срок», ru/en/kk).
 * Контроль обратной стороны: qlearn закрыт стеной ПО ЗАМЫСЛУ (402 upgrade_required, см. qlearn/__tests__/paywallIsNotAFailure),
 * поэтому его «Открыть все курсы» — правда и остаётся.
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("кнопка оплаты не обещает несуществующий «X Pro»", () => {
  test("🔴 ни один баннер UpgradeButton в src/app не подписан «… Pro»", () => {
    const вывод = execSync('git grep -n -E "UpgradeButton[^>]*label=" -- src/app', { encoding: "utf8" });
    const строки = вывод.split("\n").filter(Boolean);
    expect(строки.length).toBeGreaterThan(0); // контроль прибора: верная подпись qlearn должна найтись
    expect(строки.filter((с) => /\bPro\b/.test(с))).toEqual([]);
  });

  test("контроль: qlearn с настоящей стеной сохраняет свою подпись", () => {
    expect(файл("src/app/qlearn/page.tsx")).toContain('<PaddleUpgradeButton variant="banner" appId="qlearn" label="Открыть все курсы" />');
  });

  test("🔴 deepsan: подпись не из словаря «upgrade» (там был «DeepSan Pro»)", () => {
    expect(файл("src/app/deepsan/page.tsx")).toContain('<PaddleUpgradeButton variant="banner" appId="deepsan" />');
    expect(файл("src/app/deepsan/i18n.ts")).not.toMatch(/DeepSan Pro/);
  });

  test("🔴 psyapp-deps: баннер без своей подписи", () => {
    expect(файл("src/app/psyapp-deps/page.tsx")).toContain('<PaddleUpgradeButton variant="banner" appId="psyapp-deps" />');
  });
});
