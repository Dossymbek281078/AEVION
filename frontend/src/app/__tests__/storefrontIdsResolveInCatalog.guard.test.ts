import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Идентификаторы витрины сходятся с каталогом цен — и расхождение не растёт.
 *
 * Витрина `/apps` и каталог `/api/pricing` — два независимых списка, которые
 * ведут разные люди. Сверить их машинно НЕЛЬЗЯ, пока идентификаторы разные:
 * замер 02.09.2026 — пять из одиннадцати позиций витрины в каталоге не
 * находятся (`smeta` против `smeta-trainer`, `qpaynet` против
 * `qpaynet-embedded`, `bureau` против `aevion-ip-bureau`), а `devhub` и
 * `tiktok-publisher` отсутствуют вовсе.
 *
 * Цена расхождения не косметическая. Пока списки не сходятся, любая проверка
 * «а помечен ли этот модуль как бета» молча пропускает половину витрины —
 * именно поэтому три беты продавались как готовые, и никто не заметил.
 * DevHub при этом стоит $149/мес и в каталоге цен не встречается ни разу.
 *
 * ПОЧЕМУ ХРАПОВИК. Свести идентификаторы — правка на продающей странице и в
 * каталоге, то есть решение основателя о составе продукта. Сторож не требует
 * этого решения: он замораживает сегодняшние пять и краснеет на ШЕСТОМ.
 *
 * Список может только УМЕНЬШАТЬСЯ. Свели идентификатор — уберите строку.
 */

const TUT = dirname(fileURLToPath(import.meta.url));
const VITRINA = join(TUT, "..", "apps", "page.tsx");
const KATALOG = join(TUT, "..", "..", "..", "..", "aevion-globus-backend", "src", "data", "pricing.ts");

/**
 * Известные расхождения на 02.09.2026. Сверяется НА РАВЕНСТВО, а не «не больше»:
 * иначе исчезнувшее расхождение останется в списке навсегда и заморозит ровно
 * то, что должно было беречь.
 */
const IZVESTNYE = [
  "bureau",            // в каталоге: aevion-ip-bureau
  "devhub",            // в каталоге НЕТ вовсе, при цене $149/мес
  "qpaynet",           // в каталоге: qpaynet-embedded
  "smeta",             // в каталоге: smeta-trainer
  "tiktok-publisher",  // в каталоге НЕТ вовсе
];

const TOVARY = join(TUT, "..", "..", "lib", "products.ts");

/** Цена товара на витрине: id -> priceUsd. */
function ceniVitriny(): Record<string, number> {
  const src = readFileSync(TOVARY, "utf8");
  const out: Record<string, number> = {};
  // Окно в 400 знаков теряло два товара: у bureau и cyberchess цена стоит
  // дальше от идентификатора. Границей служит закрывающая скобка объекта,
  // а не выдуманное число знаков — иначе знаменатель молча занижается.
  const re = /id:\s*"([a-z0-9-]+)"[^}]*?priceUsd:\s*([0-9.]+)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out[m[1]] = Number(m[2]);
  return out;
}

/** Цена модуля в каталоге: id -> addonMonthly. */
function ceniKataloga(): Record<string, number> {
  const src = readFileSync(KATALOG, "utf8");
  const out: Record<string, number> = {};
  // Та же граница, что и у витрины: закрывающая скобка объекта. С окном в
  // 120 знаков каталог давал 33 модуля вместо 35 и терял cyberchess — то есть
  // ЗАНИЖАЛ охват сверки, а именно охват тут и есть предмет проверки.
  const re = /id:\s*"([a-z0-9-]+)",[^}]*?addonMonthly:\s*([0-9.]+)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out[m[1]] = Number(m[2]);
  return out;
}

function idsIzVitriny(): string[] {
  const src = readFileSync(VITRINA, "utf8");
  const out: string[] = [];
  const nachalo = 'id: "';
  let i = 0;
  for (;;) {
    i = src.indexOf(nachalo, i);
    if (i < 0) break;
    const s1 = i + nachalo.length;
    const j = src.indexOf(String.fromCharCode(34), s1);
    if (j < 0) break;
    out.push(src.slice(s1, j));
    i = j + 1;
  }
  return out;
}

/**
 * Из каталога берём только те id, у которых РЯДОМ стоит availability — это
 * отличает модуль от тарифа и от набора. Без этого условия в выборку попадут
 * `free`, `lite`, `pro`, и «сошлось» станет случайным.
 */
function idsIzKataloga(): string[] {
  const src = readFileSync(KATALOG, "utf8");
  const out: string[] = [];
  const nachalo = 'id: "';
  let i = 0;
  for (;;) {
    i = src.indexOf(nachalo, i);
    if (i < 0) break;
    const s1 = i + nachalo.length;
    const j = src.indexOf(String.fromCharCode(34), s1);
    if (j < 0) break;
    const id = src.slice(s1, j);
    const okno = src.slice(j, j + 400);
    if (okno.includes("availability")) out.push(id);
    i = j + 1;
  }
  return out;
}

describe("идентификаторы витрины сходятся с каталогом цен", () => {
  it("прибор исправен: оба списка прочитаны", () => {
    // Молчать при отсутствии файла нельзя: пропуск выглядел бы как «сошлось».
    expect(existsSync(VITRINA), "витрина не найдена: " + VITRINA).toBe(true);
    expect(existsSync(KATALOG), "каталог цен не найден: " + KATALOG).toBe(true);
    expect(idsIzVitriny().length, "витрина не разобрана").toBeGreaterThan(8);
    expect(idsIzKataloga().length, "каталог не разобран").toBeGreaterThan(30);
    // Контроль отбора: тариф не должен попасть в список модулей.
    expect(idsIzKataloga()).not.toContain("free");
  });

  it("расхождений ровно столько, сколько записано — ни одним больше", () => {
    const katalog = new Set(idsIzKataloga());
    const net = idsIzVitriny().filter((id) => !katalog.has(id)).sort();
    expect(
      net,
      "идентификатор витрины не находится в каталоге цен: сверка «помечен ли модуль как бета» будет молча его пропускать",
    ).toEqual([...IZVESTNYE].sort());
  });

  it("у сравнимых товаров цены совпадают — и сравнимых не стало меньше", () => {
    const v = ceniVitriny();
    const k = ceniKataloga();
    expect(Object.keys(v).length, "цены витрины не разобраны").toBeGreaterThan(10);
    expect(Object.keys(k).length, "цены каталога не разобраны").toBeGreaterThan(20);

    const obshie = Object.keys(v).filter((id) => id in k);
    const rashozhdeniya = obshie.filter((id) => Math.abs(v[id] - k[id]) > 0.01)
      .map((id) => id + ": витрина $" + v[id] + ", каталог $" + k[id]);
    expect(rashozhdeniya, "цена на витрине не совпадает с каталогом").toEqual([]);

    // ЗНАМЕНАТЕЛЬ. Ноль расхождений сам по себе не значит ничего: сверить
    // удаётся только те товары, чей id есть в обоих списках. Замер 02.09.2026 —
    // три из шестнадцати. Если охват МОЛЧА упадёт, зелёный цвет останется, а
    // защита исчезнет; поэтому число закреплено и может только расти.
    expect(obshie.length, "сравнимых товаров стало МЕНЬШЕ — проверка цен ослабла").toBeGreaterThanOrEqual(3);
  });
});
