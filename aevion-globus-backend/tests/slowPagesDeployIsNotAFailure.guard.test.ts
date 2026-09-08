import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Медленно поднимающийся сайт — НЕ неудача.
 *
 * Замер 08.09.2026: за неделю пять выкаток и ноль успешных. Соседнее окно
 * открыло адреса четырёх «упавших» — все отвечают 200 (контроль: выдуманный
 * поддомен того же проекта даёт 404). Страницы гостей были опубликованы и живы,
 * а мы записали «не удалось» и так и сказали человеку.
 *
 * Причина: у гостя каждый проект — НОВЫЙ проект Cloudflare Pages, его домен
 * расходится по краю сети дольше, чем повторная выкатка. Окно проверки было
 * 25 секунд (5 попыток по 5), стало ~2 минуты.
 *
 * Сторож держит ОБЕ стороны: поздний успех признаётся успехом, а вечно мёртвый
 * адрес по-прежнему объявляется неудачей. Без второй половины «починка»
 * означала бы просто «ждать дольше и всё равно поверить».
 */
let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

describe("поздний ответ адреса — успех, а не отказ", () => {
  test("адрес поднялся с восьмой попытки — это УСПЕХ", async () => {
    const { verifyDeploymentServes } = await import("../src/routes/devhub");
    // Семь отказов, затем 200: прежнее окно (5 попыток) сдалось бы на пятой.
    for (let i = 0; i < 7; i++) fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await expect(verifyDeploymentServes("https://new.pages.dev", 1)).resolves.toBe(true);
    expect(fetchMock.mock.calls.length, "проверка сдалась раньше восьмой попытки").toBeGreaterThanOrEqual(8);
  });

  test("КОНТРОЛЬ: адрес, который не отвечает никогда, остаётся неудачей", async () => {
    const { verifyDeploymentServes } = await import("../src/routes/devhub");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(verifyDeploymentServes("https://dead.pages.dev", 1)).resolves.toBe(false);
  });

  test("окно по умолчанию заметно больше прежних 25 секунд", async () => {
    const { verifyDeploymentServes } = await import("../src/routes/devhub");
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await verifyDeploymentServes("https://slow.pages.dev", 1);
    // Прежнее поведение — ровно 5 обращений. Ждём кратно больше: иначе правка
    // была бы косметической и первая же медленная выкатка снова стала бы
    // «неудачей».
    expect(
      fetchMock.mock.calls.length,
      `попыток ${fetchMock.mock.calls.length} — окно почти не выросло`,
    ).toBeGreaterThanOrEqual(20);
  });
});
