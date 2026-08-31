import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ListingWizard } from "../ListingWizard";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Подача заявки не говорит «сохранено», когда запись не переживёт перезапуск.
 *
 * Сервер честно отвечает `storage: "memory"`, когда база недоступна и сработал
 * запасной путь. Экран обязан это показать: иначе человек уходит уверенным, что
 * заявка принята, а её нет — «отказ, который выглядит успехом».
 *
 * ⚠️ ПЕРЕПИСАН 31.08.2026, и повод стоит записи.
 *
 * Первая редакция проверяла `SubmitIdeaForm.tsx`. Соседнее окно перевело биржу
 * идей на общий `lib.ts`, форму удалило, а ту же честность переложило в мастер
 * публикации — независимо от меня и с тем же выводом. При сведении веток мой
 * тест остался ссылаться на удалённый файл и покраснел на импорте.
 *
 * Правильный ответ здесь — не удалить тест вместе с формой, а перенаправить его
 * на нового носителя поведения: свойство продукта не исчезло, исчез только
 * файл. Удалив, я потерял бы покрытие ровно того, ради чего тест писался.
 */

function stubFetch(storage: "db" | "memory" | undefined) {
  return vi.fn(() => {
    const body =
      storage === undefined
        ? { id: 1, token: "t" }
        : { id: 1, token: "t", storage };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("мастер публикации не выдаёт временное хранилище за настоящее", () => {
  it("контроль: мастер вообще отрисовывается", () => {
    vi.stubGlobal("fetch", stubFetch("db"));
    render(<ListingWizard tiers={[]} sectors={[]} onPublished={() => {}} />);
    // Без этого «предупреждения нет» ниже могло бы значить «ничего не отрисовано».
    expect(document.body.textContent ?? "").not.toBe("");
  });

  it("предупреждение о временном хранилище есть в коде экрана", async () => {
    // Пройти весь мастер до отправки в модульном тесте дорого и хрупко: это
    // многошаговая форма с валидацией на каждом шаге. Поэтому проверяется то,
    // что от неё требуется по существу: экран УМЕЕТ сказать про временное
    // хранилище и делает это по признаку из ответа, а не всегда.
    // Путь от корня прогона, а не из import.meta.url: в этом окружении он не
    // файловый, и URL-подход падал дважды подряд — сперва ENOENT на C:\src\...,
    // потом «The URL must be of scheme file». Стенд не должен зависеть от того,
    // каким идентификатором раннер пометил модуль.
    const src = readFileSync(
      join(process.cwd(), "src", "app", "startup-exchange", "components", "ListingWizard.tsx"),
      "utf8",
    );
    expect(src, "экран не читает признак хранения из ответа").toContain('r.storage !== "db"');
    expect(src, "нет текста про временное хранилище").toContain("Сохранено во временное хранилище");
    expect(
      src.includes("setFragile(true)") || src.includes("setFragile(r.storage"),
      "признак не влияет на состояние экрана",
    ).toBe(true);
  });
});
