import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Материальный баланс в CyberChess показывается через ТРИ независимые таблицы
 * ценностей фигур в page.tsx: `PV` (число «Белые +N»), `PIECE_VAL` и `PV2`
 * (соседние расчёты материала). На 07.09.2026 они байт-в-байт идентичны, но это
 * три ОТДЕЛЬНЫХ литерала — классический риск дрейфа (§0.3, второй источник
 * правды): правка одной (напр. слон 3→3.25) молча рассинхронизирует показатели,
 * и «два наших ответа об одном» начнут спорить. Тест держит их равными И
 * стандартными. Тот же класс, что знак оценки в трёх местах (см.
 * project_cyberchess_nnue_deep_analysis).
 *
 * Сорс-уровень намеренно: таблицы объявлены внутри компонента (function-local),
 * снаружи их не импортировать — как economyIsHonest.test.ts.
 */

const SRC = path.join(__dirname, "..", "page.tsx");
const src = () => fs.readFileSync(SRC, "utf-8");

/** Достаёт объект-литерал глифовой таблицы ценностей по имени переменной.
 *  Возвращает нормализованную строку {glyph:val,...} или null, если не найдена. */
function extractGlyphTable(source: string, name: string): string | null {
  const anchor = `const ${name}:Record<string,number>=`;
  const at = source.indexOf(anchor);
  if (at < 0) return null;
  const open = source.indexOf("{", at);
  const close = source.indexOf("}", open);
  if (open < 0 || close < 0) return null;
  // Только глифовые таблицы (♕…); буквенная PV (Q/R/B/N) — иного назначения.
  const body = source.slice(open, close + 1);
  return /[♔-♟]/.test(body) ? body.replace(/\s+/g, "") : null;
}

/** Имена всех глифовых таблиц ценностей, объявленных в page.tsx. */
function найтиТаблицы(source: string): string[] {
  const re = /const\s+([A-Za-z_0-9]+)\s*:\s*Record<string,\s*number>\s*=\s*\{([^}]*)\}/g;
  const имена: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (/[♔-♟]/.test(m[2])) имена.push(m[1]);
  }
  return имена;
}

describe("материальные таблицы ценностей не расходятся молча", () => {
  // 🔴 ПЕРЕНАЦЕЛЕНО 01.10.2026. Имена таблиц были перечислены списком из
  // трёх: PV, PIECE_VAL, PV2. Таблица PV жила ВНУТРИ левого инфо-рейла, а его
  // убрали по слову основателя — и сторож покраснел на правке, которая его же
  // цель приближает: копий источника правды стало меньше, а не больше.
  //
  // Поэтому список больше не зашит. Таблицы ищутся по объявлению, и правило
  // звучит так, как и задумывалось: СКОЛЬКО БЫ их ни было, все одинаковы и
  // стандартны. Теперь удаление дубля проходит, а появление нового —
  // проверяется само, без правки теста.
  const NAMES = найтиТаблицы(src());

  it("таблицы вообще найдены — иначе проверка пуста", () => {
    // Знаменатель назван: без этого «все одинаковы» было бы зелёным и для
    // нуля таблиц. Замер 01.10: их две (PIECE_VAL и PV2).
    expect(NAMES.length, "глифовых таблиц ценностей не найдено — тест смотрит не туда").toBeGreaterThan(0);
  });

  it("все найденные глифовые таблицы существуют", () => {
    const s = src();
    for (const n of NAMES) {
      expect(extractGlyphTable(s, n), `таблица ${n} пропала — расчёт материала переписан, проверку обновить`).not.toBeNull();
    }
  });

  it("все три таблицы идентичны (иначе показатели материала спорят)", () => {
    const s = src();
    const tables = NAMES.map((n) => extractGlyphTable(s, n));
    // Все непусты (проверено выше) и равны первой.
    for (let i = 1; i < tables.length; i++) {
      expect(tables[i], `${NAMES[i]} разошлась с ${NAMES[0]}`).toBe(tables[0]);
    }
  });

  it("значения стандартные (Q9 R5 B3 N3 P1, короля нет)", () => {
    // Проверялась именно PV — таблица, которая жила в удалённом рейле.
    // Берём ПЕРВУЮ найденную: выше уже доказано, что все они одинаковы,
    // значит достаточно любой, и список имён больше нигде не зашит.
    const s = src();
    const t = extractGlyphTable(s, NAMES[0])!;
    expect(t).toContain('"♕":9'); // ♕ ферзь
    expect(t).toContain('"♖":5'); // ♖ ладья
    expect(t).toContain('"♗":3'); // ♗ слон
    expect(t).toContain('"♘":3'); // ♘ конь
    expect(t).toContain('"♙":1'); // ♙ пешка
    expect(t).not.toMatch(/♔/);   // ♔ короля в ценностях быть не должно
  });
});
