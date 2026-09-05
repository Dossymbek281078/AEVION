import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Опубликованные типы пакета `@aevion-io/catalog-client` обязаны совпадать
 * с его исходником.
 *
 * Повод (04.09.2026): `dist/index.d.ts` отстал от `src/index.ts` на три
 * месяца и публиковал интеграторам форму, которой сервер не отдаёт —
 * `status` и `lastCheckedAt` у поставщика multichat. Автор правки от 12.08
 * написал прямо: этих полей в ответе не было НИКОГДА. Человек писал
 * `if (p.status === "online")`, получал undefined и ветку, которая не
 * выполняется, а компилятор молчал — типы это разрешали.
 *
 * Почему этого никто не видел. `dist/` закрыт общим .gitignore, но для
 * этого пакета сделано ИСКЛЮЧЕНИЕ («нужен закоммиченным для сборки фронта
 * в CI»). Исключение объясняет, зачем файл в git, и тем самым снимает
 * вопрос, свежий ли он. Сравнение имён экспорта тоже молчит: интерфейс не
 * переименовали, поменяли ПОЛЯ внутри него.
 *
 * Поэтому сверяются именно поля. Компилятор здесь не запускается
 * намеренно: у пакета в CI не установлены зависимости, и проверка со
 * сборкой не выполнялась бы вовсе — то есть выглядела бы зелёной, ничего
 * не проверив.
 */

const PAKET = path.join(__dirname, "..", "..", "..", "..", "packages", "aevion-catalog-client");
const ISHODNIK = path.join(PAKET, "src", "index.ts");
const SBORKA = path.join(PAKET, "dist", "index.d.ts");

/** Имена полей одного интерфейса: тело берётся сопоставлением скобок, а не
 *  «сколько-то строк ниже» — расстояние врёт при первом же переносе. */
function polyaInterfeysa(tekst: string, imya: string): string[] | null {
  // Позиционный поиск, а НЕ new RegExp из строки: в JS-литерале "\s"
  // становится буквой s, шаблон превратился бы в «interface Имяs*{» и не
  // находил бы ничего — проверка стала бы зелёной, не сравнив ни поля.
  const klyuch = "interface " + imya;
  let poz = -1;
  for (let k = tekst.indexOf(klyuch); k !== -1; k = tekst.indexOf(klyuch, k + 1)) {
    // `extends` допускается: без этого интерфейс-наследник не имеет `{`
    // сразу после имени, выпадает из сверки МОЛЧА, и контроль охвата
    // (сверено > 60) потери одного не заметит. Сегодня таких в исходнике
    // нет — закрываю пробел заранее, пока он пустой.
    const sled = tekst.slice(k + klyuch.length).match(/^(?:\s+extends[^{]*)?\s*\{/);
    if (sled) {
      poz = k + klyuch.length + sled[0].length;
      break;
    }
  }
  if (poz === -1) return null;
  let gl = 1;
  let i = poz;
  const nachalo = i;
  while (gl > 0 && i < tekst.length) {
    if (tekst[i] === "{") gl += 1;
    else if (tekst[i] === "}") gl -= 1;
    i += 1;
  }
  const telo = tekst.slice(nachalo, i - 1);
  // Поля ВЕРХНЕГО уровня, по глубине скобок, а не по отступу. Компилятор
  // переформатирует вложенные объекты: в исходнике они на 4 пробелах, в
  // сборке на 8. Отбор по отступу давал ложные расхождения — первый прогон
  // насчитал их у трёх интерфейсов, и все три были моей ошибкой, не дефектом.
  const polya = new Set<string>();
  let gl2 = 0;
  let kusok = "";
  const zakryt = () => {
    const m2 = /^([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(kusok.trim());
    if (m2) polya.add(m2[1]);
    kusok = "";
  };
  for (const ch of telo) {
    if (ch === "{" || ch === "(" || ch === "[") gl2 += 1;
    else if (ch === "}" || ch === ")" || ch === "]") gl2 -= 1;
    if (gl2 === 0 && (ch === ";" || ch === String.fromCharCode(10))) zakryt();
    else kusok += ch;
  }
  zakryt();
  return [...polya].sort();
}

function imenaInterfeysov(tekst: string): string[] {
  return [...new Set([...tekst.matchAll(/interface ([A-Za-z_][A-Za-z0-9_]*)(?:\s+extends[^{]*)?\s*\{/g)].map((m) => m[1]))];
}

describe("опубликованные типы каталог-клиента", () => {
  it("совпадают с исходником по полям каждого интерфейса", () => {
    // Пакет могли удалить или перестать коммитить сборку — это не поломка.
    if (!existsSync(ISHODNIK) || !existsSync(SBORKA)) return;

    const ishodnik = readFileSync(ISHODNIK, "utf8");
    const sborka = readFileSync(SBORKA, "utf8");

    const imena = imenaInterfeysov(ishodnik);
    // Контроль охвата: если разбор перестал находить интерфейсы, проверка
    // станет зелёной, не сравнив ничего. Замер 04.09.2026 — 88.
    expect(imena.length, "разбор не нашёл интерфейсов в исходнике").toBeGreaterThan(60);

    const rashozhdeniya: string[] = [];
    let svereno = 0;
    for (const imya of imena) {
      const a = polyaInterfeysa(ishodnik, imya);
      const b = polyaInterfeysa(sborka, imya);
      if (!a || !b) continue;
      svereno += 1;
      if (a.join(",") !== b.join(",")) {
        rashozhdeniya.push(imya + ": исходник [" + a.join(", ") + "] против сборки [" + b.join(", ") + "]");
      }
    }
    expect(svereno, "не сверился ни один интерфейс — проверка пуста").toBeGreaterThan(60);

    expect(
      rashozhdeniya,
      "dist/index.d.ts разошёлся с src/index.ts. Пакет отдают интеграторам, и они видят СБОРКУ, " +
        "а не исходник. Починка: cd packages/aevion-catalog-client && npm ci && npm run build",
    ).toEqual([]);
  });
});
