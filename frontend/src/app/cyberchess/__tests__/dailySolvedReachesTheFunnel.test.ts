import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Решил задачу дня — это должно быть ВИДНО в воронке. 05.10.2026.
//
// До этого дня событие daily_solved не слал никто. Серверная половина имя уже
// принимала — проверено на проде запросом, а не чтением кода:
//   POST /api/pricing/events {"type":"daily_solved"}        → 204
//   POST /api/pricing/events {"type":"<выдуманное имя>"}    → 400 invalid_type
// То есть отрицательный контроль есть: 204 означал «принято», а не «ручка
// отвечает 204 на что угодно». А фронт молчал, и воронка возврата обрывалась
// на daily_open: «открыл задачу дня» было, «решил» — нет.
//
// Почему сторож устроен так, а не грепом по одной странице. Мест, которые шлют
// решение на сервер, ДВА (доска и отдельная страница задачи дня). Сторож,
// проверяющий одно, зеленел бы при слепом втором. Поэтому он сам находит все
// места вызова и печатает ЗНАМЕНАТЕЛЬ: появится третий вход — сторож покраснеет,
// а не промолчит.

const CHESS = path.join(__dirname, "..");

/** Все файлы страниц шахмат, которые шлют решение задачи дня на сервер. */
function mestaOtpravkiResheniya(): string[] {
  const найдено: string[] = [];
  const обойти = (каталог: string) => {
    for (const имя of fs.readdirSync(каталог)) {
      const полный = path.join(каталог, имя);
      const это = fs.statSync(полный);
      if (это.isDirectory()) {
        if (имя === "__tests__" || имя === "node_modules") continue;
        обойти(полный);
      } else if (имя.endsWith(".tsx") || имя.endsWith(".ts")) {
        if (fs.readFileSync(полный, "utf-8").includes("cyberchess-daily/solve")) найдено.push(полный);
      }
    }
  };
  обойти(CHESS);
  return найдено.sort();
}

describe("засчитанное решение задачи дня доходит до воронки", () => {
  test("каждое место отправки решения шлёт daily_solved", () => {
    const места = mestaOtpravkiResheniya();

    // Знаменатель в самом утверждении: если мест стало меньше, чем мы знаем,
    // значит сторож ослеп, а не код похорошел.
    expect(места.length, `мест отправки решения найдено ${места.length}, ожидалось не меньше 2`).toBeGreaterThanOrEqual(2);

    const молчуны = места.filter((f) => !stripComments(fs.readFileSync(f, "utf-8")).includes("daily_solved"));
    expect(
      молчуны,
      `проверено мест: ${места.length}; не шлют daily_solved: ${молчуны.map((f) => path.relative(CHESS, f)).join(", ")}`
    ).toEqual([]);
  });

  test("шлём только то, что засчитал сервер", () => {
    // Отправка ДО ответа сервера считала бы и отвергнутые решения (wrong_day
    // после UTC-полуночи, 429, 5xx) — число в воронке разошлось бы с таблицей
    // лидеров, и разошлось бы молча.
    for (const f of mestaOtpravkiResheniya()) {
      const s = stripComments(fs.readFileSync(f, "utf-8"));
      const послеЗапроса = s.split("cyberchess-daily/solve")[1] ?? "";
      const доОтвета = послеЗапроса.split(/r\.ok|!r\.ok/)[0] ?? "";
      expect(доОтвета, `${path.relative(CHESS, f)}: daily_solved отправляется до проверки ответа сервера`).not.toContain("daily_solved");
    }
  });
});

describe("имя события доезжает до сети, а не теряется по дороге", () => {
  const прежнийBeacon = globalThis.navigator?.sendBeacon;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (globalThis.navigator) (globalThis.navigator as Navigator).sendBeacon = прежнийBeacon as Navigator["sendBeacon"];
    vi.unstubAllGlobals();
  });

  test("track отправляет daily_solved настоящим телом запроса", async () => {
    // Берём НАСТОЯЩИЙ модуль track, а не свою копию правила: проверяем то, что
    // работает в проде, а не то, что мы про него думаем.
    // sendBeacon получает Blob, а не строку: String(тело) даёт «[object Blob]»
    // и проверка прошла бы мимо содержимого. Поэтому тело читаем, а не приводим.
    const отправленное: Array<BodyInit | null | undefined> = [];
    vi.stubGlobal("navigator", {
      ...(globalThis.navigator ?? {}),
      sendBeacon: (_url: string, тело?: BodyInit | null) => {
        отправленное.push(тело);
        return true;
      },
    });
    vi.stubGlobal("fetch", async (_u: string, init?: RequestInit) => {
      отправленное.push(init?.body ?? "");
      return { ok: true, status: 204 } as Response;
    });

    const прочитать = async (т: BodyInit | null | undefined): Promise<string> =>
      т && typeof (т as Blob).text === "function" ? await (т as Blob).text() : String(т ?? "");

    const { track } = await import("@/lib/track");
    track({ type: "daily_solved", source: "cyberchess/board", meta: { surface: "board" } });
    await new Promise((r) => setTimeout(r, 0));

    expect(отправленное.length, "track не отправил ни одного запроса").toBeGreaterThan(0);
    const тело = (await Promise.all(отправленное.map(прочитать))).join(" ");
    expect(тело).toContain("daily_solved");

    // Контроль прибора: проверка обязана КРАСНЕТЬ на чужом имени, иначе она
    // подтверждает лишь то, что хоть что-то отправлено.
    expect(тело).not.toContain("daily_open");
  });
});
