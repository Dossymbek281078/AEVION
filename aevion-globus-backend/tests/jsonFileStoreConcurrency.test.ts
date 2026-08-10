// updateJsonFile — «прочитал → изменил → записал» под замком на файл.
//
// Зачем примитив вообще появился: атомарной в jsonFileStore была только сама
// запись (temp → rename), а пара read+write — нет. Два параллельных
// обработчика читают один и тот же массив и оба пишут свою версию, второй
// затирает первого. Отказа нет: оба запроса успешны, файл валиден, данных
// меньше, чем записали. Найдено живым прогоном мультичата 2026-08-10 —
// из трёх ответов агентов в ленте оседал один.
//
// Тест сравнивает ОБА пути на одной и той же нагрузке: наивная пара
// read+write должна потерять записи, updateJsonFile — нет. Так проверка
// доказывает не «код не падает», а что защита действительно работает.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { readJsonFile, writeJsonFile, updateJsonFile } from "../src/lib/jsonFileStore";

let dataDir: string;
let prevDataDir: string | undefined;

beforeEach(() => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-jsonstore-"));
  process.env.AEVION_DATA_DIR = dataDir;
});

afterEach(() => {
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

const REL = "concurrency-probe.json";
const WRITERS = 25;

describe("updateJsonFile", () => {
  test("параллельные добавления не теряются", async () => {
    await Promise.all(
      Array.from({ length: WRITERS }, (_, i) =>
        updateJsonFile<{ items: number[] }>(REL, { items: [] }, (cur) => ({
          items: [...cur.items, i],
        })),
      ),
    );

    const out = await readJsonFile<{ items: number[] }>(REL, { items: [] });
    expect(out.items).toHaveLength(WRITERS);
    expect([...out.items].sort((a, b) => a - b)).toEqual(Array.from({ length: WRITERS }, (_, i) => i));
  });

  test("параллельная запись не падает на совпадении имени temp-файла", async () => {
    // Имя temp собиралось из pid и миллисекунды: два писателя в одну
    // миллисекунду брали один путь, и второй rename падал с ENOENT — файл
    // уже унесли. Отказ прилетал не в тот запрос, который его вызвал.
    const results = await Promise.allSettled(
      Array.from({ length: WRITERS }, (_, i) => writeJsonFile("tmp-collision.json", { v: i })),
    );
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
  });

  test("наивная пара read+write на той же нагрузке записи теряет", async () => {
    // Контрольный замер: без него зелёный тест выше ничего не доказывает —
    // он мог бы пройти и потому, что нагрузка не создаёт настоящей гонки.
    await Promise.all(
      Array.from({ length: WRITERS }, async (_, i) => {
        const cur = await readJsonFile<{ items: number[] }>(REL, { items: [] });
        await writeJsonFile(REL, { items: [...cur.items, i] });
      }),
    );

    const out = await readJsonFile<{ items: number[] }>(REL, { items: [] });
    expect(out.items.length).toBeLessThan(WRITERS);
  });

  test("ошибка в одном изменении не рвёт очередь для следующих", async () => {
    const results = await Promise.allSettled([
      updateJsonFile<{ items: number[] }>(REL, { items: [] }, (c) => ({ items: [...c.items, 1] })),
      updateJsonFile<{ items: number[] }>(REL, { items: [] }, () => {
        throw new Error("мутатор упал");
      }),
      updateJsonFile<{ items: number[] }>(REL, { items: [] }, (c) => ({ items: [...c.items, 3] })),
    ]);

    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    const out = await readJsonFile<{ items: number[] }>(REL, { items: [] });
    expect(out.items.sort()).toEqual([1, 3]);
  });

  test("замок держится на файл, а не на всё хранилище", async () => {
    // Разные файлы не должны выстраиваться в общую очередь: иначе один
    // медленный модуль тормозит все остальные.
    const order: string[] = [];
    await Promise.all([
      updateJsonFile<{ v: number }>("slow.json", { v: 0 }, async () => {
        await new Promise((r) => setTimeout(r, 40));
        order.push("slow");
        return { v: 1 };
      }),
      updateJsonFile<{ v: number }>("fast.json", { v: 0 }, () => {
        order.push("fast");
        return { v: 1 };
      }),
    ]);

    expect(order).toEqual(["fast", "slow"]);
  });

  test("возвращает записанное значение, чтобы не перечитывать файл", async () => {
    const out = await updateJsonFile<{ items: string[] }>(REL, { items: [] }, (c) => ({
      items: [...c.items, "a"],
    }));
    expect(out).toEqual({ items: ["a"] });
  });
});
