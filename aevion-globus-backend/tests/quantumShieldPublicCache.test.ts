import { describe, it, expect } from "vitest";
import { publicCacheControl } from "../src/routes/quantum-shield";

/**
 * Персонализированный ответ нельзя отдавать в публичный кеш.
 *
 * Найдено 28.07 при сплошном аудите публичных ручек. `GET
 * /api/quantum-shield/:id/public` отдаёт `ownerUserId` владельцу и скрывает его
 * от анонимных — это сделано правильно. Расходился ЗАГОЛОВОК: кеш выбирался по
 * `auditSnippet === null`, а не по тому, персонализирован ли ответ.
 *
 * Путь, на котором это ломалось: запрос журнала аудита обёрнут в `try/catch`,
 * потому что на старом развёртывании таблицы `QuantumShieldAudit` может не быть.
 * При его падении `auditSnippet` оставался `null` — как у анонима, — а в теле
 * при этом уходил `ownerUserId` владельца. Ответ получал
 * `Cache-Control: public, max-age=60`, и промежуточный кеш мог отдать его
 * анонимному запросу.
 *
 * Теперь и тело, и заголовок читают один признак `personalized`. Проверка здесь
 * на чистой функции: сама ручка ходит в Postgres, а расхождение было именно в
 * выборе заголовка, и его можно зафиксировать без базы.
 */

describe("кеш публичной проекции щита", () => {
  it("персонализированный ответ не кешируется вообще", () => {
    const h = publicCacheControl(true);
    expect(h).toContain("private");
    expect(h).toContain("no-store");
    // Главное: ни при каких условиях не «public» — иначе общий кеш подхватит
    // ответ с ownerUserId и отдаст его следующему, кто спросит.
    expect(h).not.toContain("public");
    expect(h).not.toMatch(/max-age=[1-9]/);
  });

  it("анонимный ответ кешируется публично и ненадолго", () => {
    const h = publicCacheControl(false);
    expect(h).toContain("public");
    expect(h).toMatch(/max-age=\d+/);
    expect(h).not.toContain("no-store");
  });

  it("решение зависит ТОЛЬКО от признака персонализации", () => {
    // Дискриминирующая сила: два значения обязаны давать разные заголовки.
    // Если помощник когда-нибудь начнёт возвращать одно и то же, проверки выше
    // по отдельности могут остаться зелёными — эта не останется.
    expect(publicCacheControl(true)).not.toBe(publicCacheControl(false));
  });
});
