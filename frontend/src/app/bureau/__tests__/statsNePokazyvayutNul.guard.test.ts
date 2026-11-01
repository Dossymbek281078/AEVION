// Блок «Stats» на /bureau не показывает «0» в первом кадре и у роботов.
//
// Замер 1.11.2026: в HTML с сервера стояло «0 Certificates Issued» и «0 Total Verifications»,
// потому что состояние начиналось с { total: 0, ... }, а числа приходят уже в браузере.
// Решение Оркестратора 1.11.2026: до загрузки и при ошибке — «—»; карточка
// «Certificates Issued» — только от порога МИН_СЕРТИФИКАТОВ_ДЛЯ_ПОКАЗА.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("bureau Stats: нет нулей до загрузки", () => {
  it("начальное состояние stats не нулевое", () => {
    expect(src).not.toMatch(/useState\(\s*\{\s*total:\s*0/);
  });
  it("есть порог показа карточки сертификатов", () => {
    expect(src).toContain("МИН_СЕРТИФИКАТОВ_ДЛЯ_ПОКАЗА");
  });
  it("есть плейсхолдер «—»", () => {
    expect(src).toContain("\"—\"");
  });
});
