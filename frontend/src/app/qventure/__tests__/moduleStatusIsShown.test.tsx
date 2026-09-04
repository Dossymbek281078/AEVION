import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * ГОТОВНОСТЬ МОДУЛЯ ВИДНА ТАМ ЖЕ, ГДЕ ЦЕНА.
 *
 * В каталоге QVenture помечен `beta`, страница цен это показывает, а страница
 * модуля показывала только $39/мес. Две наши поверхности говорили о готовности
 * разное, и покупатель видел ту, где сказано меньше.
 *
 * Проверяются три исхода, и третий важнее первых двух: при отказе ручки НЕ
 * должно быть видно ничего. «Не знаю» не имеет права выглядеть как «готово» —
 * это тот же молчаливый отказ, только в сторону, выгодную нам.
 */

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

import ModuleStatusNote from "@/components/ModuleStatusNote";

function otvet(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("готовность модуля рядом с ценой", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("бета показана", async () => {
    vi.stubGlobal("fetch", otvet({ modules: [{ id: "qventure", availability: "beta" }] }));
    render(<ModuleStatusNote moduleId="qventure" />);
    await waitFor(() => expect(screen.getByTestId("module-status").textContent).toMatch(/Бета/));
  });

  test("готовый модуль ничего не показывает (положительный контроль)", async () => {
    // Без него первая проверка прошла бы и на компоненте, который показывает
    // пометку ВСЕГДА, — то есть врал бы про готовые модули.
    vi.stubGlobal("fetch", otvet({ modules: [{ id: "qventure", availability: "live" }] }));
    render(<ModuleStatusNote moduleId="qventure" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("module-status")).toBeNull();
  });

  test("ручка не ответила — не показываем ничего", async () => {
    vi.stubGlobal("fetch", otvet({ error: "boom" }, 503));
    render(<ModuleStatusNote moduleId="qventure" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(
      screen.queryByTestId("module-status"),
      "при отказе ручки показано состояние — значит оно выдумано",
    ).toBeNull();
  });

  test("связи нет — не показываем ничего", async () => {
    // Отдельно от случая 503: тот приходит УСПЕШНЫМ ответом с плохим кодом
    // и до обработчика ошибки не доходит. Обрыв связи — другая ветка, и
    // мутация «при отказе показать бету» проходила незамеченной именно
    // потому, что этой проверки не было.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("сеть недоступна"); }));
    render(<ModuleStatusNote moduleId="qventure" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(
      screen.queryByTestId("module-status"),
      "связи нет, а состояние показано — значит оно выдумано",
    ).toBeNull();
  });
});
