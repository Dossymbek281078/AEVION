import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Мастер публикации НАЗЫВАЕТ запасной путь.
 *
 * Свойство перенесено из ветки окна касс при сведении 30.08.2026: там его
 * стерёг сторож формы `ideaFormNeverClaimsSavedWhenItIsNot`, а сама форма при
 * переработке биржи была заменена. Свойство важнее файла — поэтому сторож
 * переписан под новую витрину, а не удалён вместе со старой.
 *
 * Дефект, ради которого: сервер отвечает storage "memory", когда база
 * недоступна и сработал запасной путь — заявка не переживёт перезапуск.
 * Мастер поле игнорировал и говорил «опубликована» одинаково в обоих случаях.
 * Молчаливый отказ выглядит успехом, и это опаснее пустоты.
 */
const W = readFileSync(
  join(process.cwd(), "src/app/startup-exchange/components/ListingWizard.tsx"),
  "utf8",
);
const LIB = readFileSync(
  join(process.cwd(), "src/app/startup-exchange/lib.ts"),
  "utf8",
);

describe("мастер публикации не выдаёт память за сохранение", () => {
  test("клиент вообще получает поле хранилища", () => {
    expect(LIB, "тип ответа publish не содержит storage — читать нечего")
      .toContain("storage?:");
  });

  test("мастер читает его и запоминает хрупкость", () => {
    expect(W, "мастер не смотрит на storage").toContain("r.storage");
    expect(W, "решение принимается не по значению db").toContain('!== "db"');
  });

  test("и показывает это человеку, а не только помнит", () => {
    expect(W, "признак есть, но на экран не выводится").toContain("{fragile &&");
    expect(W, "нет текста о временном хранилище").toContain("временное хранилище");
  });
});
