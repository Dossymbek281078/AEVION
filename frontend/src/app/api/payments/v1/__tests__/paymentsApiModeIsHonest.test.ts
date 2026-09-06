import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PAYMENTS_API_MODE } from "../_lib";

/**
 * Пока это API не ходит в настоящую кассу — оно обязано называть себя demo.
 *
 * ЗАЧЕМ. Возврат здесь создаётся со статусом succeeded, и по ответу его не
 * отличить от настоящего возврата денег. Страницы о демонстрационном режиме
 * говорят честно, а ответы API молчали. Читают их машины, а не страницу.
 *
 * КАК УСТРОЕН. Сторож самогаснущий: он ищет в дереве обращение к настоящей
 * кассе. Нет обращения — режим обязан быть `demo`. Появилось — сторож краснеет
 * и требует изменить значение. То есть он не запрещает развитие, а не даёт
 * развитию пройти молча.
 *
 * КОММЕНТАРИИ ВЫРЕЗАЮТСЯ, и это не мелочь: соседний файл в комментарии
 * перечисляет как раз имена касс, объясняя, когда менять режим. Без вырезания
 * сторож краснел бы на объяснении самого себя.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/** Признаки настоящего обращения к кассе — импорт модуля или её адрес. */
const ПРИЗНАКИ = [
  /from\s+["'][^"']*lib\/payment/,
  /api\.paypal\.com/,
  /api\.lemonsqueezy\.com/,
  /securepay\.paybox/,
  /api\.paybox/,
  /gumroad\.com\/api/,
];

function безКомментариев(s: string): string {
  return s
    .split(String.fromCharCode(10))
    .map((l) => (l.trim().startsWith("*") || l.trim().startsWith("//") ? "" : l))
    .join(String.fromCharCode(10));
}

function исходники(dir: string, out: { путь: string; код: string }[] = []) {
  for (const n of readdirSync(dir)) {
    if (n === "__tests__" || n === "node_modules") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) исходники(p, out);
    else if (n.endsWith(".ts")) out.push({ путь: p, код: безКомментариев(readFileSync(p, "utf8")) });
  }
  return out;
}

describe("режим платёжного API назван честно", () => {
  const файлы = исходники(ROOT);

  test("контроль: дерево прочитано и непусто", () => {
    // Иначе «настоящей кассы нет» означало бы «я ничего не читал».
    expect(файлы.length, "не найдено ни одного исходника").toBeGreaterThanOrEqual(5);
    expect(файлы.some((f) => f.код.includes("refund")), "не вижу заведомо существующего слова").toBe(true);
  });

  test("контроль: комментарии действительно вырезаны", () => {
    // В _lib.ts имена касс перечислены в комментарии. Если вырезание сломается,
    // сторож покраснеет на объяснении самого себя — и это ложная тревога.
    const lib = файлы.find((f) => f.путь.endsWith("_lib.ts"));
    expect(lib, "_lib.ts не прочитан").toBeTruthy();
    expect(lib!.код, "комментарий не вырезан").not.toContain("КОГДА МЕНЯТЬ");
  });

  test("контроль: признак умеет срабатывать", () => {
    const проба = 'import { pay } from "@/lib/payment/payboxProvider";';
    expect(ПРИЗНАКИ.some((r) => r.test(проба)), "признак слеп к настоящему вызову").toBe(true);
  });

  test("пока настоящей кассы нет — режим demo", () => {
    const настоящие = файлы.filter((f) => ПРИЗНАКИ.some((r) => r.test(f.код))).map((f) => f.путь);
    if (настоящие.length === 0) {
      expect(
        PAYMENTS_API_MODE,
        "касса не подключена, а режим не назван демонстрационным",
      ).toBe("demo");
    } else {
      expect(
        PAYMENTS_API_MODE,
        "в API появилось обращение к настоящей кассе (" + настоящие.join(", ") +
          "), а режим всё ещё demo — ответы будут врать о том, двигаются ли деньги",
      ).not.toBe("demo");
    }
  });
});
