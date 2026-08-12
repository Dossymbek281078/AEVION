import { describe, test, expect, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Сторож: имена ключа входа, которые никто не пишет.
//
// Замер 12.08.2026 — пара списков, потому что один список ничего не доказывает:
//
//   пишет  "aevion_token"        0 строк
//   читают "aevion_token"       93 строки в 66 файлах  (qcoreai 25, qpaynet 21 — деньги)
//   читают "aevion_auth_token"   9 строк                (legacy)
//
// Вход кладёт единственное имя — `aevion_auth_token_v1` (см. src/lib/auth.ts).
// Значит все эти чтения возвращают null у ВОШЕДШЕГО человека: кнопки «войдите»
// не исчезают, личные списки пустые, запросы уходят без подписи. Про legacy-имя
// есть `migrateAuthToken()` с описанием «вызывать один раз при запуске» — он не
// вызывается нигде, так что перенос не происходит.
//
// Класс записан в память 28.07.2026 (тогда 68 файлов). Через две недели — 66.
// То есть знание сохранилось, а действие не последовало, и ничто не мешало
// добавлять новые чтения. Этот сторож закрывает именно вторую половину: сам он
// ничего не чинит, но РОСТ останавливает и держит число на виду при каждом
// прогоне, а не раз в две недели.
//
// Починка (одна механическая замена на 13 модулей) задевает чужие зоны почти
// всех живых вкладок, поэтому она — решение основателя, а не этой вкладки.
// Формула: `localStorage.getItem("aevion_token")` → `getAuthToken()` из
// `@/lib/auth`.
//
// Обход дерева внутри теста: при полном параллельном прогоне это выходит за
// дефолтные 5с (замером уже поймано на abVariantDeps.guard).
vi.setConfig({ testTimeout: 30_000 });

const SRC = join(__dirname, "..", "..");

/** Единственное имя, которое действительно пишут. */
const CANONICAL = "aevion_auth_token_v1";

/**
 * Мёртвые имена и разрешённое число чтений. Только вниз.
 *
 * Числа — ВХОЖДЕНИЯ имени в кавычках любого вида, а не строки: в документе
 * основателя стоит «93 строки в 66 файлах» — это подсчёт `grep -n` по двойным
 * кавычкам. Здесь 124, потому что считаются и одинарные кавычки с бэктиками, и
 * несколько вхождений в одной строке. Обе цифры верны, они про разные единицы;
 * путать их нельзя — сравнивать надо с той, которой мерили.
 */
const BASELINE: Record<string, number> = {
  aevion_token: 124,
  aevion_auth_token: 10,
};

/**
 * Файлы, которые сторож не смотрит, и почему:
 *  - сам себя: имена ключей перечислены здесь в коде, иначе проверка ловит
 *    собственного наблюдателя и всегда красная;
 *  - lib/auth.ts: единственное законное место, где эти имена объявлены —
 *    канонический ключ и удаление legacy.
 */
const SKIP = ["app/__tests__/authTokenKey.guard.test.ts", "lib/auth.ts"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function rel(p: string): string {
  return relative(SRC, p).split(sep).join("/");
}

const FILES = walk(SRC).filter((p) => !SKIP.includes(rel(p)));

/**
 * Чтения мёртвого имени. Ищем имя в кавычках, но НЕ считаем канонический ключ:
 * `aevion_auth_token` — префикс `aevion_auth_token_v1`, и без этого условия
 * каждое правильное употребление считалось бы нарушением.
 */
function readsOf(src: string, key: string): number {
  const re = new RegExp(`["'\`]${key}["'\`]`, "g");
  let n = 0;
  for (const m of src.matchAll(re)) {
    if (m[0].slice(1, -1) === key) n++;
  }
  return n;
}

const counts = new Map<string, Array<{ file: string; n: number }>>();
for (const key of Object.keys(BASELINE)) {
  const hits: Array<{ file: string; n: number }> = [];
  for (const p of FILES) {
    const n = readsOf(readFileSync(p, "utf8"), key);
    if (n > 0) hits.push({ file: rel(p), n });
  }
  counts.set(key, hits);
}

const total = (key: string) => (counts.get(key) ?? []).reduce((s, x) => s + x.n, 0);

describe("ключ входа — одно имя на запись и на чтение", () => {
  test("скан действительно прошёл по дереву", () => {
    // Сторож, молча совпавший с нулём файлов, хуже отсутствующего.
    expect(FILES.length).toBeGreaterThan(200);
    // И канонический ключ на месте — иначе имена переехали и базу надо пересобрать.
    const authTs = readFileSync(join(SRC, "lib", "auth.ts"), "utf8");
    expect(authTs).toContain(CANONICAL);
  });

  for (const key of Object.keys(BASELINE)) {
    test(`чтений «${key}» не стало больше`, () => {
      const now = total(key);
      const worst = (counts.get(key) ?? [])
        .sort((a, b) => b.n - a.n)
        .slice(0, 5)
        .map((x) => `${x.file}: ${x.n}`);
      expect(
        now,
        `\nПоявилось новое чтение имени, которое никто не пишет: было ${BASELINE[key]}, стало ${now}.\n` +
          `Берите токен через getAuthToken() из @/lib/auth — иначе страница не увидит вошедшего.\n` +
          `Больше всего сейчас:\n${worst.join("\n")}\n`,
      ).toBeLessThanOrEqual(BASELINE[key]);
    });

    test(`база по «${key}» не устарела до нуля`, () => {
      // Дошло до нуля — сторож сделал своё дело, строку из BASELINE убрать
      // (а когда опустеет весь список — удалить файл), иначе он превратится в
      // вечное исключение «так и должно быть».
      expect(
        total(key),
        `\nЧтений «${key}» больше нет — уберите его из BASELINE этого файла.\n`,
      ).toBeGreaterThan(0);
    });
  }
});
