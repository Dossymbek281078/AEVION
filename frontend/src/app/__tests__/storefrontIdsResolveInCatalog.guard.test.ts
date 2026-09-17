import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_PRODUCTS } from "@/lib/products";
import { STANDALONE_APPS } from "@/lib/termPricing";

/**
 * Идентификаторы витрины сходятся с каталогом цен — и расхождение не растёт.
 *
 * Витрина `/apps` и каталог `/api/pricing` — два независимых списка, которые
 * ведут разные люди. Сверить их машинно НЕЛЬЗЯ, пока идентификаторы разные:
 * замер 02.09.2026 — пять из одиннадцати позиций витрины в каталоге не
 * находятся (`smeta` против `smeta-trainer`, `qpaynet` против
 * `qpaynet-embedded`, `bureau` против `aevion-ip-bureau`), а `tiktok-publisher`
 * отсутствует вовсе.
 *
 * ⚠️ DevHub в этом списке БЫЛ и убран 02.09: он есть в каталоге с 31.08
 * (коммит c1604075d) с намеренно нулевой ценой — положительная сделала бы его
 * выбираемым в кассе, а доступ выдаётся по другой таблице. На проде этого
 * ещё нет: прод собран 30.08. Я измерил прод и сказал про КОД — поправка
 * лежит в документах основателя.
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
  "qpaynet",           // в каталоге: qpaynet-embedded
  "smeta",             // в каталоге: smeta-trainer
  "tiktok-publisher",  // в каталоге НЕТ вовсе
];

/**
 * Цена товара на витрине: id -> priceUsd.
 *
 * 15.09.2026: цены отдельных приложений в каталоге больше не литералы — они
 * вычисляются из лестницы сроков (appBase("…")). Разбор исходника регуляркой
 * стал бы слепым (нашёл бы только гайды), поэтому берём настоящие объекты.
 */
function ceniVitriny(): Record<string, number> {
  // Товар кладётся под ОБОИМИ именами — id витрины и appId. У витрины «bureau»
  // и «multichat», у каталога бэкенда «aevion-ip-bureau» и «multichat-engine»:
  // по одному лишь id витрины сравнимыми оказывались ДВА товара из пяти, охват
  // падал молча. А по одному лишь appId схлопывались гайды (у трёх гайдов один
  // appId «qrenew», у трёх книг — «gratitude-book»), и уже контроль «цены
  // витрины разобраны» мерил не то. Оба ключа ведут к одной цене, поэтому
  // расхождения такая запись создать не может.
  const out: Record<string, number> = {};
  for (const p of ALL_PRODUCTS) {
    out[p.id] = p.priceUsd;
    if (p.appId) out[p.appId] = p.priceUsd;
  }
  return out;
}

/**
 * Цена модуля в каталоге бэкенда: id -> addonMonthly.
 *
 * addonMonthly бывает литералом или `appBase("<moduleId>")` — ссылкой на
 * STANDALONE_APPS бэкенда. Их фронтовая копия сверяется с бэкендом сторожем
 * termPricingMatchesBackend, поэтому разрешаем ссылку через неё: иначе все пять
 * приложений выпали бы из сверки молча, а знаменатель ниже упал бы до нуля.
 */
function ceniKataloga(): Record<string, number> {
  const src = readFileSync(KATALOG, "utf8");
  const out: Record<string, number> = {};
  // Граница — закрывающая скобка объекта, а не число знаков: с окном в 120
  // знаков каталог терял cyberchess и занижал охват сверки.
  const re = /id:\s*"([a-z0-9-]+)",[^}]*?addonMonthly:\s*(?:([0-9.]+)|appBase\("([a-z0-9-]+)"\))/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[2]) out[m[1]] = Number(m[2]);
    else {
      const app = STANDALONE_APPS.find((a) => a.moduleId === m![3]);
      if (app) out[m[1]] = app.baseMonthly;
    }
  }
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
    // Границей служит КОНЕЦ ОБЪЕКТА, а не 400 знаков. Расстояние — догадка о
    // вёрстке чужого файла: добавят поле или комментарий, и модуль тихо выпадет
    // из выборки. Сегодня я на этом ошибся дважды в соседних сторожах.
    const konec = src.indexOf("}", j);
    const okno = src.slice(j, konec < 0 ? src.length : konec);
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
    // 15.09.2026: у снятых с отдельной продажи модулей addonMonthly стал null,
    // поэтому порог «больше 20» описывал прежний прайс. Теперь контроль другой:
    // приложения лестницы, у которых цена в каталоге ЕСТЬ, обязаны совпадать с
    // ней до цента, и таких должно быть не меньше трёх.
    //
    // Почему не «все пять»: у DevHub addonMonthly намеренно null — по решению
    // основателя 14.09.2026 цену надстройки к коротким срокам он не назначал,
    // и касса считает его через buildQuote. Требовать здесь число значило бы
    // краснеть на осознанном решении.
    const сцены = STANDALONE_APPS.filter((a) => a.moduleId in k);
    for (const app of сцены) {
      expect(k[app.moduleId], `цена ${app.moduleId} расходится с лестницей сроков`).toBe(app.baseMonthly);
    }
    // ЗНАМЕНАТЕЛЬ: сколько приложений вообще удалось сверить. Молча упавший
    // охват оставил бы зелёный цвет при исчезнувшей защите.
    expect(
      сцены.length,
      `сверено приложений: ${сцены.map((a) => a.moduleId).join(", ") || "ни одного"} — сверка ослабла`,
    ).toBeGreaterThanOrEqual(3);

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
