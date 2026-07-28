import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPARE_ROWS, NOT_COMPARED, type Txt } from "@/data/competitors";

/** Оба языка обязаны быть непустыми: демо на английском ведёт прямо сюда. */
const both = (x: Txt) => [x.ru, x.en];

/**
 * Страница сравнения с аналогами — самое соблазнительное место в проекте для
 * приукрашивания: её читают инвестор и покупатель, а проверять никто не идёт.
 * Сегодняшний день дал три случая, когда витрина обещала то, чего в коде нет
 * (ML-DSA на /investor, quadratic voting в qchaingov, Tor в veilnetx), — и все
 * три нашлись только чтением кода.
 *
 * Сторож держит правила, которые делают таблицу проверяемой:
 *  1. у КАЖДОЙ строки заполнено «где мы слабее» — сравнение, выигранное по всем
 *     пунктам, читается как реклама и доверия не прибавляет;
 *  2. у каждой строки сказано, ЧЕМ проверено;
 *  3. модуль существует в реестре — иначе сравниваем с тем, чего нет;
 *  4. цифры про чужой продукт подкреплены ссылкой.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = join(APP_DIR, "..", "..", "..", "aevion-globus-backend", "src", "data", "projects.ts");

const registryIds = new Set(
  [...readFileSync(REGISTRY, "utf8").matchAll(/^\s+id: "([a-z0-9-]+)",/gm)].map((m) => m[1]),
);

describe("таблица сравнения остаётся проверяемой", () => {
  it("реестр модулей вообще прочитался", () => {
    // контроль инструмента: без него все проверки ниже пройдут на пустом множестве
    expect(registryIds.size).toBeGreaterThan(20);
  });

  it("строк сравнения не меньше пяти", () => {
    expect(COMPARE_ROWS.length).toBeGreaterThanOrEqual(5);
  });

  for (const row of COMPARE_ROWS) {
    describe(row.module, () => {
      it("модуль есть в реестре проектов", () => {
        expect(registryIds.has(row.module), `${row.module} нет в projects.ts`).toBe(true);
      });

      it("заполнено «где мы слабее» — на обоих языках", () => {
        expect(row.weaknesses.length).toBeGreaterThan(0);
        for (const w of row.weaknesses) {
          for (const text of both(w)) expect(text.trim().length).toBeGreaterThan(15);
        }
      });

      it("ни одна строка не осталась без перевода", () => {
        const fields: Txt[] = [row.title, row.headline, row.measured, ...row.strengths, ...row.weaknesses, ...row.sources.map((s) => s.label)];
        for (const f of fields) {
          expect(f.ru.trim().length, `${row.module}: пустой русский`).toBeGreaterThan(0);
          expect(f.en.trim().length, `${row.module}: пустой английский`).toBeGreaterThan(0);
          // «перевод» копипастой ловим на длинных полях: одинаковый текст в
          // обоих языках почти всегда значит, что переводить забыли
          if (f.ru.length > 40) expect(f.en, `${row.module}: английский совпал с русским`).not.toBe(f.ru);
        }
      });

      it("заполнено «где мы сильнее» и названы конкуренты", () => {
        expect(row.strengths.length).toBeGreaterThan(0);
        expect(row.rivals.length).toBeGreaterThan(0);
      });

      it("сказано, чем проверено", () => {
        for (const text of both(row.measured)) expect(text.trim().length).toBeGreaterThan(30);
      });

      it("утверждения про аналог подкреплены ссылкой", () => {
        // Различить «цифра про них» и «цифра про нас» по тексту надёжно нельзя,
        // поэтому правило простое и явное: источник обязателен, а исключение
        // проставляется руками флагом `noRivalClaims` — то есть осознанно.
        if (row.noRivalClaims) {
          expect(row.sources.length, `${row.module}: флаг стоит, но ссылки всё же есть`).toBe(0);
          return;
        }
        expect(row.sources.length, `${row.module}: утверждение про аналог без источника`).toBeGreaterThan(0);
      });

      it("ссылки ведут по http(s)", () => {
        for (const s of row.sources) expect(s.url).toMatch(/^https?:\/\//);
      });
    });
  }

  it("список «ещё не сравнивали» ссылается на существующие модули", () => {
    for (const n of NOT_COMPARED) {
      expect(registryIds.has(n.module), `${n.module} нет в projects.ts`).toBe(true);
    }
  });

  it("модуль не может быть одновременно сравнённым и несравнённым", () => {
    const compared = new Set(COMPARE_ROWS.map((r) => r.module));
    for (const n of NOT_COMPARED) expect(compared.has(n.module)).toBe(false);
  });
});
