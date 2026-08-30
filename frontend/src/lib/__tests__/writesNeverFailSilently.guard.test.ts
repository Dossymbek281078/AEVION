import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Отправка, которая упала, не имеет права выглядеть как ничего не случившееся.
 *
 * 29.08.2026 свип дал 26 мест с пустым `catch` вокруг сетевого вызова. Из них
 * ЗАПИСЬ была ровно одна — удаление переменной окружения проекта в DevHub, —
 * и она молчала: человек считал переменную удалённой, а для секрета это
 * дороже обычного, его продолжают считать отозванным. Соседняя функция
 * сохранения при этом об отказе говорила: один автор, одно место, разное
 * поведение.
 *
 * ЧЕМ ЭТОТ СТОРОЖ ОТЛИЧАЕТСЯ ОТ ПРИДИРКИ. Он не запрещает молчание вообще:
 * при провале ЧТЕНИЯ молчать допустимо — это устаревшие данные, а не
 * потерянное действие. Красным становится только пустой `catch` вокруг
 * POST/PUT/PATCH/DELETE.
 *
 * Регулярок с обратными слэшами тут нет намеренно: они теряются на границе
 * вызова, и файл молча перестаёт разбираться («no tests» вместо красного).
 */

const NL = String.fromCharCode(10);
const HERE = dirname(fileURLToPath(import.meta.url));
const FRONT = join(HERE, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== "__tests__" && e !== "node_modules") walk(p, out);
    } else if (e.endsWith(".tsx") || e.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Пустой catch вокруг вызова: возвращаем места и признак «это запись». */
function silentCatches(): { reads: number; writes: string[] } {
  let reads = 0;
  const writes: string[] = [];
  for (const f of walk(FRONT)) {
    const s = readFileSync(f, "utf8");
    let at = 0;
    for (;;) {
      const i = s.indexOf("catch {}", at);
      if (i < 0) break;
      at = i + 1;
      const start = s.lastIndexOf("try", i);
      if (start < 0) continue;
      const body = s.slice(start, i);
      // окно ограничено: длинный try почти наверняка про другое
      if (body.length >= 600 || !body.includes("fetch(")) continue;
      const isWrite =
        body.includes('method: "POST"') || body.includes("method: 'POST'") ||
        body.includes('method: "PUT"') || body.includes("method: 'PUT'") ||
        body.includes('method: "PATCH"') || body.includes("method: 'PATCH'") ||
        body.includes('method: "DELETE"') || body.includes("method: 'DELETE'");
      if (isWrite) {
        writes.push(
          relative(FRONT, f).split(sep).join("/") + ":" + s.slice(0, i).split(NL).length,
        );
      } else {
        reads += 1;
      }
    }
  }
  return { reads, writes };
}

describe("упавшая отправка не выглядит как ничего не случившееся", () => {
  const { reads, writes } = silentCatches();

  // Контроль ОХВАТА: если обход каталогов сломается, сторож ответит
  // «нарушений нет» на пустом множестве и станет вечнозелёным. Читающих
  // молчунов заведомо больше десяти — на них и проверяем, что поиск живой.
  it("контроль прибора: молчаливые обработчики вообще находятся", () => {
    expect(reads, "поиск ничего не нашёл — сломался обход или шаблон")
      .toBeGreaterThanOrEqual(10);
  });

  it("ни одна ЗАПИСЬ не проваливается молча", () => {
    expect(
      writes,
      `пустой catch вокруг записи — отказ не увидит никто: ${writes.join(", ")}`,
    ).toEqual([]);
  });
});
