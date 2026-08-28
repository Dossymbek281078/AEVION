import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Контрольная точка не выдаётся за сохранённую, когда легла в память.
 *
 * `createCheckpoint` проглатывала отказ записи в память и возвращала только id.
 * Вызывающий не мог отличить сохранённую точку от живущей до перезапуска — а
 * человек видит кнопку «отменить правки ИИ» и жмёт её назавтра.
 *
 * Отдельно опасен способ починки. Меняя возврат на объект, легко оставить его
 * уходящим в ответ как есть: тогда клиент получит `{id, storage}` там, где
 * ждёт строку, и откат сломается МОЛЧА. Типы этого не ловят — тело ответа не
 * типизировано. Поэтому сторож проверяет обе стороны: признак есть, и в ответ
 * уходит именно id.
 */

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "routes", "devhub.ts"),
  "utf8",
);

describe("контрольная точка честна о своём хранилище", () => {
  test("прибор исправен: функция и её вызовы найдены", () => {
    expect(SRC.includes("async function createCheckpoint")).toBe(true);
    const calls = SRC.split("await createCheckpoint(").length - 1;
    expect(calls, "вызовы не найдены — сторож смотрит не туда").toBeGreaterThanOrEqual(4);
  });

  test("отказ записи помечается, а не проглатывается", () => {
    expect(
      SRC.includes('memCheckpoints.set(checkpoint.id, checkpoint); storage = "memory";'),
      "отказ снова уходит в память молча",
    ).toBe(true);
  });

  test("возврат несёт признак вместе с id", () => {
    expect(SRC).toContain('return { id: checkpoint.id, storage };');
  });

  test("у КАЖДОГО вызова результат разбирается через .id", () => {
    // Первая версия проверки искала одну конкретную форму ошибки
    // (`const checkpointId = await createCheckpoint(`) — и мутация её пережила:
    // приведение типа проходило свободно. Проверять надо СВОЙСТВО, а не запись:
    // сколько вызовов, столько и извлечений id.
    const calls = SRC.split("await createCheckpoint(").length - 1;
    const extracted = SRC.split("?.id ?? null").length - 1;
    expect(
      extracted,
      `вызовов ${calls}, а извлечений id ${extracted} — где-то в ответ уходит объект`,
    ).toBeGreaterThanOrEqual(calls);
  });

  test("отказ точки влияет на общий признак генерации", () => {
    // Файлы и точка — части одного обещания. Если точка легла в память, ответ
    // не должен говорить «сохранено в базу».
    expect(SRC).toContain('if (cpRes?.storage === "memory") storage = "memory";');
  });

  test("откат тоже сообщает, куда лёг", () => {
    // Файлы «восстановлены» в памяти исчезнут при перезапуске, а человеку
    // сказано «восстановлено N файлов». Третья часть того же обещания.
    expect(SRC).toContain('return { paths: revertedFiles, storage };');
    expect(SRC).toContain('storage: revert.storage');
    expect(SRC).toContain('if (step.storage === "memory") revertStorage = "memory";');
  });

  test("результат отката не уходит в ответ целиком", () => {
    // Тот же капкан, что у контрольной точки: tsc молчит, потому что тело
    // ответа не типизировано. Здесь он молчал ВТОРОЙ раз за один заход.
    const calls = SRC.split("await applyCheckpointRevert(").length - 1;
    const unpacked = SRC.split(".paths").length - 1;
    expect(unpacked, `вызовов ${calls}, разборов .paths ${unpacked}`).toBeGreaterThanOrEqual(calls);
  });
});
