import { describe, test, expect, vi, beforeEach } from "vitest";

// Учёт расхода — «по возможности»: он не должен ронять операцию, ради которой
// его зовут. Направление верное. Но до 31.08.2026 отказ был ещё и НЕВИДИМ:
// catch без тела, и всё. Сводка расходов при сломанной записи выглядит ровно
// как при исправной — просто чисел меньше. Решение о деньгах принимали бы по
// числу, которое не знает, что оно неполное.
//
// Сторож закрепляет ровно два свойства: (1) отказ НЕ роняет вызывающего,
// (2) отказ НЕ молчит.

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: queryMock }) }));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("потерянная запись расхода не молчит", () => {
  // Модуль помнит, удалось ли подготовить таблицу (флаг ensured), и этот
  // флаг переживает смену подмены: без сброса второй случай меряет состояние,
  // оставшееся от первого. Поймано падением, а не рассуждением.
  beforeEach(() => { queryMock.mockReset(); vi.resetModules(); });

  test("сбой записи считается и не роняет вызывающего", async () => {
    const { insertSmartRun, droppedSmartRuns } = await import("../src/lib/smartRunLog");
    const before = droppedSmartRuns();
    queryMock.mockRejectedValue(new Error("база недоступна"));

    // Не должно бросить: учёт не ломает операцию, ради которой его зовут.
    expect(() =>
      insertSmartRun({ module: "devhub-anon", resolved: "single", costUsd: 0.01, savedUsd: 0 }),
    ).not.toThrow();

    await tick();
    await tick();

    // Считаем ПРИРОСТ, а не итог: счётчик общий на процесс, соседний тест мог
    // его уже двинуть. Проверка «больше нуля» прошла бы и без нашей записи.
    expect(droppedSmartRuns()).toBeGreaterThan(before);
  });

  test("путь «хранилище недоступно» считается ОТДЕЛЬНО", async () => {
    // Два пути потери, и мерить их надо порознь. Мутация «обнулить условие
    // ensureTable» первую редакцию НЕ ломала: отказ уходил во второй путь,
    // тоже считаемый, и сторож оставался зелёным. Мутация была не туда,
    // но она показала, что проверка не различает пути.
    //
    // Здесь падает ТОЛЬКО подготовка таблицы: первый запрос отбивается,
    // остальные проходят. Значит счётчик мог вырасти лишь на раннем выходе.
    const { insertSmartRun, droppedSmartRuns } = await import("../src/lib/smartRunLog");
    queryMock.mockRejectedValueOnce(new Error("SELECT 1 не прошёл"));
    queryMock.mockResolvedValue({ rows: [] });
    const before = droppedSmartRuns();
    insertSmartRun({ module: "devhub", resolved: "single", costUsd: 0.02, savedUsd: 0 });
    await tick();
    await tick();
    expect(droppedSmartRuns()).toBeGreaterThan(before);
  });

  test("путь «сбой вставки» считается ОТДЕЛЬНО", async () => {
    // Второй путь потери. Общий тест выше отбивает ВСЕ запросы, поэтому в нём
    // срабатывает ранний выход, и сбой самой вставки остаётся непроверенным:
    // покрытие выглядело полным, будучи половинным.
    //
    // Здесь подготовка таблицы проходит (три запроса), падает ЧЕТВЁРТЫЙ —
    // сама вставка.
    const { insertSmartRun, droppedSmartRuns } = await import("../src/lib/smartRunLog");
    queryMock
      .mockResolvedValueOnce({ rows: [] })   // SELECT 1
      .mockResolvedValueOnce({ rows: [] })   // CREATE TABLE
      .mockResolvedValueOnce({ rows: [] })   // CREATE INDEX
      .mockRejectedValue(new Error("INSERT не прошёл"));
    const before = droppedSmartRuns();
    insertSmartRun({ module: "devhub", resolved: "single", costUsd: 0.03, savedUsd: 0 });
    await tick();
    await tick();
    expect(droppedSmartRuns()).toBeGreaterThan(before);
  });

  test("успешная запись счётчик потерь НЕ двигает", async () => {
    const { insertSmartRun, droppedSmartRuns } = await import("../src/lib/smartRunLog");
    queryMock.mockResolvedValue({ rows: [] });
    const before = droppedSmartRuns();
    insertSmartRun({ module: "devhub", resolved: "single", costUsd: 0.01, savedUsd: 0 });
    await tick();
    await tick();
    // Контроль: без него счётчик, растущий ВСЕГДА, тоже прошёл бы первый тест.
    expect(droppedSmartRuns()).toBe(before);
  });
});
