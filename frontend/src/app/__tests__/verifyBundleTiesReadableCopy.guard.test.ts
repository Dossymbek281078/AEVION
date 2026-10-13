/**
 * Сторож: проверяльщик из набора покупателя обязан ловить порчу ЧИТАЕМОЙ копии.
 *
 * Повод (13.10.2026). В записи манифеста данные лежат дважды: `payload` —
 * объект, который покупатель читает глазами, и `payloadCanonical` — строка,
 * которая на самом деле подписана. Проверялась только вторая, поэтому порча
 * первой не меняла ничего, и проверяльщик отвечал «checked 5, failed 0».
 *
 * Чем это опасно: вдумчивый покупатель делает ровно такой опыт — меняет байт в
 * том, что видит, и ждёт жалобы. Не получив её, он заключает «подпись не
 * покрывает данные». Он ошибается, но нам об этом не напишет.
 *
 * 🔴 Почему сторож ЗАПУСКАЕТ файл, а не импортирует его. Импорт `.mjs` с
 * шебангом ломает преобразование vite («Invalid Character `!`»), но причина
 * глубже удобства: покупатель получает КОМАНДУ, и проверять надо то же, что
 * получает он, — вывод и код выхода настоящего файла из набора.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const КОРЕНЬ = join(process.cwd(), "tools", "verify-bundle");
const ПРОВЕРЯЛЬЩИК = join(КОРЕНЬ, "src", "verify-aevion.mjs");
const ОБРАЗЕЦ = join(КОРЕНЬ, "src", "manifest-sample.json");
const врем = mkdtempSync(join(tmpdir(), "aevion-verify-guard-"));

type Запись = { record: Record<string, unknown> };
type Манифест = { records: Запись[] };

function образец(): Манифест {
  return JSON.parse(readFileSync(ОБРАЗЕЦ, "utf8")) as Манифест;
}

/** Запускает проверяльщик как его запускает покупатель. Код выхода — без конвейера. */
function прогон(манифест: Манифест, имя: string): { код: number; вывод: string } {
  const путь = join(врем, имя);
  writeFileSync(путь, JSON.stringify(манифест));
  try {
    const вывод = execFileSync(process.execPath, [ПРОВЕРЯЛЬЩИК, путь], { encoding: "utf8" });
    return { код: 0, вывод };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { код: err.status ?? 2, вывод: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

describe("набор проверяльщика привязывает читаемую копию к подписанной", () => {
  it("целый образец проходит — иначе сторож ловил бы что угодно", () => {
    const { код, вывод } = прогон(образец(), "celyy.json");
    expect(вывод).toContain("checked 5, failed 0");
    expect(код).toBe(0);
  });

  it("порча читаемого payload роняет проверку (носитель признака)", () => {
    const m = образец();
    (m.records[0].record.payload as Record<string, unknown>).idem = "tesa";
    const { код, вывод } = прогон(m, "payload-isporchen.json");
    expect(вывод).toContain("payload does not match the signed payloadCanonical");
    expect(вывод).toContain("checked 5, failed 1");
    expect(код).toBe(1);
  });

  it("лишнее поле в читаемой копии тоже ловится", () => {
    const m = образец();
    (m.records[0].record.payload as Record<string, unknown>).lishnee = 1;
    const { код, вывод } = прогон(m, "payload-lishnee.json");
    expect(вывод).toContain("does not match the signed");
    expect(код).toBe(1);
  });

  it("запись БЕЗ читаемой копии остаётся годной — старые манифесты не ломаем", () => {
    const m = образец();
    delete (m.records[0].record as Record<string, unknown>).payload;
    const { код, вывод } = прогон(m, "bez-payload.json");
    expect(вывод).toContain("checked 5, failed 0");
    expect(код).toBe(0);
  });

  it("порча подписанной строки по-прежнему ловится хешем и подписью", () => {
    const m = образец();
    const c = String(m.records[0].record.payloadCanonical);
    m.records[0].record.payloadCanonical = c.replace('"n":1', '"n":2');
    const { код, вывод } = прогон(m, "canonical-isporchen.json");
    expect(вывод).toContain("payloadHash does not match");
    expect(вывод).toContain("Ed25519 signature does NOT verify");
    expect(код).toBe(1);
  });

  it("архив у покупателя собран ИЗ ЭТИХ исходников (иначе они разъехались)", () => {
    const вывод = execFileSync(process.execPath, [join(КОРЕНЬ, "build.mjs"), "--check"], { encoding: "utf8" });
    expect(вывод).toContain("СОВПАДАЕТ");
    expect(вывод).toContain("файлов в src: 8");
  });
});
