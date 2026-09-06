import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Публичная ручка, зовущая платного провайдера без ограничителя, — открытый счёт.
//
// Замер 21.08.2026: платных ручек 26, без ограничителя 17. Тринадцать из них
// закрывает кампания в ветке fix/build-closed-vacancy-feed (помощник
// generationLimit, 30 применений); четыре не закрывал никто, они закрыты здесь.
//
// ⚠️ ПРО ПРИБОР. Первая версия этого замера дала ДРУГИЕ четыре ручки — и все
// четыре на деле были защищены. Шаблон искал слово «limiter», а в коде
// встречается «Limit» (`aiLimit`, `globalLimit`), и ограничитель на ВЕСЬ
// роутер (`router.use(globalLimit)`) он не видел вовсе. Отсюда правило для
// этого файла: признаком считается любое имя с «Limit»/«Throttle», и
// отдельно проверяется router.use.
//
// ПОПРАВКА к коммиту 606ffa435. Там написано, что сторож нашёл две ручки,
// которых не нашёл мой свип. Это неверно: свип нашёл ВСЕ, а я посмотрел
// `head -12` из 19 строк отчёта и двух последних не увидел. Прибор был прав,
// ошиблось чтение его вывода — тот же класс, что и остальные ошибки этого дня,
// только на один шаг ближе к глазам.

const ROUTES = path.join(__dirname, "..", "src", "routes");
const LIMITER = /[Ll]imit|[Tt]hrottle|rateLimit\(/;

type Paid = { file: string; route: string; limited: boolean };

function scan(): Paid[] {
  const out: Paid[] = [];
  for (const f of readdirSync(ROUTES)) {
    if (!f.endsWith(".ts")) continue;
    const s = readFileSync(path.join(ROUTES, f), "utf8");
    if (!s.includes("callProvider")) continue;
    const routerWide = /Router\.use\(\s*\w*(?:[Ll]imit|[Tt]hrottle)\w*\s*\)/.test(s);
    const re = /(\w+Router)\.(post|put|patch|get)\(\s*\n?\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const open = s.indexOf("(", m.index + m[1].length);
      let d = 0, j = open;
      for (; j < s.length; j++) {
        if (s[j] === "(") d++;
        else if (s[j] === ")" && --d === 0) break;
      }
      const body = s.slice(open, j);
      if (!body.includes("callProvider")) continue;
      const head = s.slice(m.index + m[0].length, m.index + m[0].length + 120);
      out.push({ file: f, route: m[3], limited: routerWide || LIMITER.test(head) });
    }
  }
  return out;
}

// Ждут кампании в fix/build-closed-vacancy-feed. Строка живёт до её мержа:
// когда ручка получит ограничитель, проверка ниже потребует убрать её отсюда.
// 06.09.2026: двенадцать записей закрыты ограничителями (класс A свипа +
// qlearn) — храповик сам потребовал их убрать. Остался ОДИН осознанный:
// /widget/run — встраиваемый виджет с CORS *, ключ apiKey; IP-предел ломал
// бы легитимные всплески встраиваний, его расход виден счётчику неучтённых
// (providerMetering) — решение о его пределе отдельное.
const PENDING = new Set([
  "qcoreai.ts /widget/run",
]);

describe("платные ручки под ограничителем", () => {
  const paid = scan();
  const key = (p: Paid) => `${p.file} ${p.route}`;

  test("контроль прибора: платные ручки найдены и часть УЖЕ защищена", () => {
    // Пустой список дал бы зелёный ответ «по нулю ручек».
    expect(paid.length).toBeGreaterThan(10);
    // А если бы шаблон не видел ограничителей вовсе — не было бы защищённых.
    expect(paid.some((p) => p.limited)).toBe(true);
  });

  test("новых платных ручек без ограничителя не появилось", () => {
    const fresh = paid.filter((p) => !p.limited && !PENDING.has(key(p))).map(key);
    expect(fresh).toEqual([]);
  });

  test("список ожидающих не протух: каждая запись всё ещё без ограничителя", () => {
    const known = new Set(paid.map(key));
    const stale = [...PENDING].filter(
      (k) => !known.has(k) || paid.find((p) => key(p) === k)?.limited,
    );
    // Смержится кампания — записи станут защищёнными, и тест заставит их убрать.
    expect(stale).toEqual([]);
  });
});
