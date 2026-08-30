import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Путь к хранилищу подписок вычисляется в ОДНОМ месте.
 *
 * Замер 30.08.2026. Записи платежей брали путь от каталога ПАКЕТА
 * (`join(__dirname, "..", "..")`), а ручка «моя подписка» в routes/pricing.ts
 * считала его сама — от `process.cwd()`. Совпадут они или нет, зависит от того,
 * откуда запущен процесс: запусти сервис из корня репозитория, и человек,
 * только что заплативший, спросит свою подписку и получит «нет».
 *
 * Ни одна сторона при этом не падает и ничего не пишет в журнал: обе честно
 * читают свой файл. Разницу видно только при сравнении — тот же класс, что
 * копия записи прав в вебхуке, найденная этой же ночью.
 *
 * `SUBSCRIPTIONS_FILE` перекрывает обе стороны и раньше, и теперь. Но полагаться
 * на переменную нельзя: без неё стороны расходились молча, а сторож должен
 * держать инвариант, а не надежду на настройку.
 *
 * Проверяется РАСКЛАД, а не текст: сколько мест вычисляют путь. Числа и имена
 * менять можно, второй источник завести — нет.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    try {
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith(".ts")) out.push(p);
    } catch {
      /* каталог исчез между обходом и чтением */
    }
  }
  return out;
}

/** Строки кода без комментариев: упоминание в пояснении — не вычисление. */
function codeOnly(text: string): string {
  return text
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

describe("хранилище подписок имеет один источник пути", () => {
  const files = walk(SRC);

  test("контроль: обход видит исходники", () => {
    expect(files.length, "обход пуст — проверки ниже ничего не значат").toBeGreaterThan(50);
  });

  test("контроль: тот, кто вычисляет путь, найден", () => {
    // Иначе «ровно один» могло бы означать «я не умею искать».
    const owner = files.filter((f) =>
      codeOnly(readFileSync(f, "utf8")).includes('export function subsFile'),
    );
    expect(owner.map((f) => f.split(/[\\/]/).pop()), "владелец пути не найден").toEqual([
      "provisioning.ts",
    ]);
  });

  test("никто больше не собирает путь сам", () => {
    // Признак вычисления: имя файла хранилища, склеенное с каталогом.
    const builders = files.filter((f) => {
      const code = codeOnly(readFileSync(f, "utf8"));
      if (!code.includes("subscriptions.jsonl")) return false;
      return code.includes("join(") || code.includes("process.cwd()");
    });
    expect(
      builders.map((f) => f.split(/[\\/]/).pop()),
      "второй источник пути к подпискам: записи и чтение разойдутся молча",
    ).toEqual(["provisioning.ts"]);
  });

  test("ручка «моя подписка» берёт путь у владельца", () => {
    const pricing = codeOnly(readFileSync(join(SRC, "routes", "pricing.ts"), "utf8"));
    expect(pricing, "ручка снова считает путь сама").toContain("subsFile()");
    expect(
      pricing.includes('join(process.cwd(), "data", "subscriptions.jsonl")'),
      "вернулось вычисление от рабочего каталога процесса",
    ).toBe(false);
  });
});
