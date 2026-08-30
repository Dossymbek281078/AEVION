import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Панель DevHub объявляла 14 возможностей рабочими, а настоящих проб к
 * поставщикам было ПЯТЬ. Основанием для «работает» служило наличие переменной
 * окружения — тот же класс, что проявился у домена: ключи заданы, зона не
 * делегирована, и каждый выданный адрес не разрешался.
 *
 * Этот сторож требует не «все возможности проверены» (у части поставщика нет
 * вовсе), а проверяемого минимума: у возможности, ЗАВИСЯЩЕЙ от внешнего
 * поставщика, должна быть проба, спрашивающая этого поставщика.
 *
 * Храповик: сегодняшние исключения перечислены и объяснены. Новая возможность
 * с внешним ключом и без пробы уронит проверку.
 */

const SRC = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");

/** Объяснённые исключения — не «забыли», а решено. */
const NO_PROBE_BY_DESIGN: Record<string, string> = {
  code: "редактор в браузере, внешнего поставщика нет",
  // ⚠️ Это ДОЛГ, а не отсутствие: у записи есть условие исчезновения.
  // Появится возможность — проба обязана появиться вместе с ней, иначе
  // витрина снова начнёт обещать непроверенное. Остальные две записи
  // настоящие: у них условия исчезновения нет.
  railway: "ДОЛГ: в описании «пока недоступно» — убрать вместе с включением возможности",
  github: "обращения считает общий ограничитель темпа; цена пробы выше пользы",
};

function capabilityEnvs(): Map<string, string[]> {
  const i = SRC.indexOf('devhubRouter.get("/studio/capabilities"');
  expect(i, "ручка возможностей не найдена — сторож смотрит не туда").toBeGreaterThan(0);
  // Граница по ЯКОРЮ, не по длине: длина — догадка о том, где кончается
  // предмет, и она устаревает при первой вставке соседнего кода.
  const end = SRC.indexOf("devhubRouter.", i + 10);
  expect(end, "граница списка возможностей не найдена").toBeGreaterThan(i);
  const block = SRC.slice(i, end);
  const out = new Map<string, string[]>();
  const re = /\{\s*id:\s*"([a-z_]+)"([\s\S]*?)\},\s*(?=\{\s*id:|\];)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    out.set(m[1], [...m[2].matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((x) => x[1]));
  }
  return out;
}

function probedEnvs(): string[] {
  const i = SRC.indexOf('devhubRouter.get("/providers/health"');
  expect(i, "ручка проб не найдена").toBeGreaterThan(0);
  // ГРАНИЦА ОБЯЗАТЕЛЬНА: ручка возможностей идёт СРАЗУ следом, и окно
  // «плюс N символов» захватывало её целиком — тогда любая переменная
  // выглядела «пробуемой», и сторож не мог покраснеть никогда.
  // Поймано мутацией: удаление пробы deepl проверку не роняло.
  const end = SRC.indexOf('devhubRouter.get("/studio/capabilities"', i);
  expect(end, "граница блока проб не найдена").toBeGreaterThan(i);
  const block = SRC.slice(i, end);
  return [...block.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((x) => x[1]);
}

describe("что объявлено рабочим, то и проверяется", () => {
  it("контроль: обе ручки разобраны и непусты", () => {
    expect(capabilityEnvs().size, "возможности не разобраны").toBeGreaterThan(10);
    expect(probedEnvs().length, "пробы не разобраны").toBeGreaterThan(5);
  });

  it("у каждой возможности с внешним ключом есть проба этого поставщика", () => {
    const probed = new Set(probedEnvs());
    const missing: string[] = [];
    for (const [id, envs] of capabilityEnvs()) {
      if (id in NO_PROBE_BY_DESIGN) continue;
      if (!envs.length) continue; // без внешнего ключа проверять нечего
      // ДВА способа доказать, что поставщика спрашивают:
      //  1) его переменная упомянута в блоке проб (прежний, позиционный);
      //  2) есть отметка noteProviderSuccess("<id>") где угодно в файле.
      //
      // Второй добавлен 30.08.2026: первый проверяет, ГДЕ написано, а не ЧТО
      // происходит. Отметка выдачи базы стоит в своём маршруте — это и есть
      // правильное место, там поставщик используется, — и позиционный критерий
      // объявлял её отсутствующей.
      const marked = SRC.includes(`noteProviderSuccess("${id}")`);
      if (!marked && !envs.some((e) => probed.has(e))) missing.push(`${id} (${envs.join(", ")})`);
    }
    expect(
      missing,
      "объявлены рабочими, но ни одна проба не спрашивает их поставщика:\n  ",
    ).toEqual([]);
  });

  it("исключения объяснены, а не просто перечислены", () => {
    for (const [id, why] of Object.entries(NO_PROBE_BY_DESIGN)) {
      expect(why.length, `${id}: причина не названа`).toBeGreaterThan(20);
    }
  });
});
