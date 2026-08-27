import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Файл, отброшенный при выкатке, называется вслух.
 *
 * `deployViaWrangler` раскладывает файлы проекта во временную папку и отдаёт
 * её wrangler'у. Путь приходит из проекта пользователя, поэтому сегменты `..`
 * отбрасываются — иначе запись ушла бы за пределы папки сборки. Это верно и
 * остаётся.
 *
 * Неверным было МОЛЧАНИЕ: до 28.08.2026 стоял голый `continue`. Файл исчезал
 * из выкатки, wrangler отчитывался успехом, страница на сайте не появлялась —
 * и следа не оставалось нигде: ни в журнале сборки, ни в ответе, ни в Sentry.
 * Ровно тот класс, из-за которого правило и записано: молчать можно при
 * провале УБОРКИ, а не осмысленного действия.
 *
 * Проверяется поведением: и запись на диск, и запуск wrangler подменены, а
 * считается то, что ФАКТИЧЕСКИ дошло до записи.
 */

const written: string[] = [];

vi.mock("fs/promises", () => ({
  mkdtemp: vi.fn(async (p: string) => `${p}test`),
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async (full: string) => { written.push(full); }),
  rm: vi.fn(async () => undefined),
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const handlers: Record<string, (...a: any[]) => void> = {};
    const proc: any = {
      stdout: { on: (_e: string, cb: (b: Buffer) => void) => cb(Buffer.from("https://demo.pages.dev\n")) },
      stderr: { on: () => undefined },
      on: (e: string, cb: (...a: any[]) => void) => { handlers[e] = cb; if (e === "close") setTimeout(() => cb(0), 0); },
      kill: () => undefined,
    };
    return proc;
  }),
}));

const { deployViaWrangler } = await import("../src/lib/wranglerPagesDeploy");

const OPTS = { accountId: "acc", apiToken: "tok" };

describe("выкатка: отброшенные файлы видны", () => {
  beforeEach(() => { written.length = 0; });

  test("прибор работает: обычный файл доходит до записи", async () => {
    // Без этого «ничего не записано» читалось бы как «защита сработала»,
    // хотя на деле не работал бы весь путь.
    const r = await deployViaWrangler([{ path: "index.html", content: "<h1>ok</h1>" }], "proj", OPTS);
    expect(r.ok, "подменённый wrangler должен отдавать успех").toBe(true);
    expect(written.length, "обычный файл не дошёл до записи — тест меряет не то").toBe(1);
    expect(written[0]).toContain("index.html");
  });

  test("путь с .. не пишется на диск", async () => {
    await deployViaWrangler(
      [{ path: "../../evil.js", content: "x" }, { path: "app/page.tsx", content: "y" }],
      "proj",
      OPTS,
    );
    expect(written.some((w) => w.includes("evil.js")), "файл с .. дошёл до записи").toBe(false);
    expect(written.some((w) => w.includes("page.tsx")), "обычный файл потерялся вместе с ним").toBe(true);
  });

  test("и он НАЗВАН в списке пропущенного", async () => {
    const r = await deployViaWrangler(
      [{ path: "../../evil.js", content: "x" }, { path: "ok.txt", content: "y" }],
      "proj",
      OPTS,
    );
    expect(r.skipped, "пропуск снова молчаливый").toEqual(["../../evil.js"]);
  });

  test("обратный слэш тоже считается попыткой выйти", async () => {
    // Слэш собирается кодом символа НАМЕРЕННО: написанный литералом, он
    // теряется по дороге в файл, строка превращается в "....evil.js" — без
    // единого разделителя, — и тест начинает проверять совсем другой случай.
    const BS = String.fromCharCode(92);
    const p = `..${BS}..${BS}evil.js`;
    expect(p.includes(BS), "разделитель не доехал — тест мерил бы не то").toBe(true);
    const r = await deployViaWrangler([{ path: p, content: "x" }], "proj", OPTS);
    expect(r.skipped).toEqual([p]);
    expect(written.length).toBe(0);
  });

  test("когда пропускать нечего — список пуст, а не отсутствует", async () => {
    // Отсутствующее поле заставило бы вызывающего писать `?.length`, и первая
    // же забытая проверка вернула бы молчание.
    const r = await deployViaWrangler([{ path: "a.txt", content: "x" }], "proj", OPTS);
    expect(Array.isArray(r.skipped)).toBe(true);
    expect(r.skipped).toEqual([]);
  });
});
