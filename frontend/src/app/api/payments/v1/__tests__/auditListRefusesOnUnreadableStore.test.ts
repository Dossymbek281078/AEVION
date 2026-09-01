import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: не прочитали аудиторский след — отвечаем отказом, а не пустотой.
 *
 * ЗАЧЕМ. Пустой список неотличим от «записей не существует». Тот, кто
 * разбирает денежный спор, сделал бы вывод «следа нет», хотя недоступно
 * хранилище — и решение по спору принял бы на ложном основании.
 *
 * Довод и образец те же, что у споров и возвратов в этом каталоге: контракт
 * модуля приведён к ним, чтобы в одном месте не было двух образцов.
 */
vi.mock("../_persist", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, kvListChecked: vi.fn(async () => ({ ok: false })), kvPush: vi.fn(async () => undefined) };
});

vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

describe("аудиторский след не притворяется пустым", () => {
  it("при нечитаемом хранилище выдача отвечает 503", async () => {
    const { GET } = await import("../audit/route");
    const res = await GET(
      new Request("https://aevion.app/api/payments/v1/audit") as never,
    );
    expect(res.status, "выдача притворилась пустой при отказе хранилища").toBe(503);
    const тело = await res.json();
    expect(JSON.stringify(тело)).toContain("storage_unavailable");
  });
});
