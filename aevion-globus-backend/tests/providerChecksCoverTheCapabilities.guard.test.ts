import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Проверки провайдеров покрывают возможности, а не «сколько-нибудь».
 *
 * Замер 28.08.2026: возможностей семнадцать, а настоящих проверок было ПЯТЬ.
 * Панель при этом говорит «настроено» по наличию переменной окружения — то
 * есть по-настоящему подтверждалась меньше трети того, что обещано человеку.
 *
 * Не проверялись DeepL, GitHub, Vercel и ElevenLabs: перевод, выгрузка в
 * репозиторий, публикация и ВСЯ озвучка (речь, музыка, звуки).
 *
 * Храповик, а не точное число: проверок станет больше, и сторож не должен
 * краснеть от чужой работы.
 */

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "routes", "devhub.ts"),
  "utf8",
);

function healthBlock(): string {
  const i = SRC.indexOf('devhubRouter.get("/providers/health"');
  expect(i, "ручка здоровья провайдеров не найдена").toBeGreaterThan(0);
  const j = SRC.indexOf("res.json({ checks", i);
  expect(j, "конец блока проверок не найден").toBeGreaterThan(i);
  return SRC.slice(i, j);
}

describe("проверки провайдеров покрывают обещанное", () => {
  test("прибор исправен: блок найден и не пуст", () => {
    expect(healthBlock().length).toBeGreaterThan(500);
  });

  test("проверок не меньше девяти", () => {
    const block = healthBlock();
    const n = block.split('probe("').length - 1;
    expect(n, "набор проверок усох").toBeGreaterThanOrEqual(9);
  });

  test("проверены именно те провайдеры, на которых держатся возможности", () => {
    const block = healthBlock();
    const missing = ["deepl", "github", "vercel", "elevenlabs", "brevo", "replicate", "openai"]
      .filter((n) => !block.includes(`probe("${n}"`));
    expect(missing, "возможность обещана, а провайдер не проверяется").toEqual([]);
  });

  test("каждая проверка отличает «ключа нет» от «ключ не подошёл»", () => {
    // Иначе отсутствие настройки и отвалившийся ключ выглядят одинаково, и
    // человек чинит не то. Признак: у каждой пробы есть ветка "not set".
    const block = healthBlock();
    const probes = block.split('probe("').length - 1;
    const notSet = block.split("not set").length - 1;
    expect(notSet, "не у всех проб есть ветка «ключа нет»").toBeGreaterThanOrEqual(probes - 1);
  });
});
