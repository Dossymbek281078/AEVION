import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * LIMIT в SQL подставляется плейсхолдером, а не значением из шаблона.
 *
 * 🔴 ЗАЧЕМ. Замер 08.09.2026 на живом проде: GET /api/pipeline/certificates.csv
 * отвечал 500 при ЛЮБЫХ параметрах — экспорт реестра сертификатов не работал
 * НИКОГДА с момента переноса. Причина в одном символе: `LIMIT ${params.length}`
 * вместо `LIMIT $${params.length}`. Без доллара в текст запроса уходит ЧИСЛО
 * параметров, сам параметр остаётся непривязанным, и Postgres отбивает запрос.
 *
 * Класс тихий вдвойне: SQL для TypeScript — обычная строка, поэтому ни типы,
 * ни сборка ошибку не видят; а ответ 500 из общего catch выглядит как
 * временный сбой базы, а не как то, что ручка мертва с рождения.
 *
 * ⚠️ РАСШИРЕН 08.09.2026 ПО ЧУЖОЙ НАХОДКЕ, и обе границы были настоящими.
 * Соседнее окно разобрало первую редакцию и назвало две слабости:
 *
 *   ФОРМА:  ловилась ДОСЛОВНАЯ строка `LIMIT ${params.length}` — ровно тот
 *           случай, что случился. `LIMIT ${paramCount}`, `${idx}`, `${n}`
 *           прошли бы мимо: сторож стерёг ОДИН случай, а не класс.
 *   ОХВАТ:  `readdirSync` без рекурсии по src/routes — 125 файлов из 380,
 *           то есть 33%. Подпапки не читались вовсе, а живой пример лежит
 *           именно там: routes/build/vacancies.ts.
 *
 * Обе закрыты: обход рекурсивный по всему src, а форма стала двухслойной.
 *
 * КАК УСТРОЕНА ЗАЩИТА ТЕПЕРЬ — два слоя, и это не педантизм.
 *
 * 1. ЖЁСТКОЕ ПРАВИЛО. `LIMIT ${…length}` — всегда опечатка независимо от
 *    имени переменной: количество элементов массива бессмысленно в роли
 *    лимита, а рядом всегда стоит правильный вид `$${…length}`.
 *
 * 2. ХРАПОВИК С ПОСЧИТАННЫМ ДОЛГОМ. Остальные `LIMIT ${…}` текстом не
 *    различимы: `${limParam}` безопасен (там номер параметра `$3`), а
 *    `${paramCount}` — дефект, и по буквам они одинаковы. Значит правило
 *    здесь невозможно, а список — возможен. Шесть нынешних мест проверены
 *    поимённо и записаны; новое место обязано быть разобрано человеком и
 *    добавлено сюда с объяснением.
 *
 * Почему не «запретить любой `LIMIT ${…}`»: первая попытка обобщить так и
 * покраснела на исправном коде (`LIMIT ${ROW_CAP}` — законная константа), а
 * сторож, краснеющий на здоровом коде, отключают в первый же день.
 *
 * ЧЕГО СТОРОЖ НЕ ВИДИТ И ПОСЛЕ РАСШИРЕНИЯ: той же ошибки у OFFSET, у
 * сравнений и у запроса, собранного из кусков в разных функциях. Он читает
 * текст, а не понимает SQL.
 */
const SRC = join(__dirname, "..", "src");

/** Все .ts под src, включая подпапки. Первая редакция читала один уровень. */
function vseFajly(dir: string, out: string[] = []): string[] {
  for (const imya of readdirSync(dir)) {
    const put = join(dir, imya);
    if (statSync(put).isDirectory()) vseFajly(put, out);
    else if (imya.endsWith(".ts")) out.push(put);
  }
  return out;
}

/**
 * Места с ОДИНАРНЫМ долларом: `LIMIT ${…}`.
 *
 * Правильная форма `LIMIT $${…}` сюда не попадает сама собой — после «LIMIT »
 * там стоит доллар, а не скобка. Проверено контролем ниже: правильных форм в
 * коде 65, и ни одна не считается находкой.
 */
function mestaSOdinarnymDollarom(src: string): string[] {
  const out: string[] = [];
  const igla = "LIMIT ${";
  let i = 0;
  for (;;) {
    const at = src.indexOf(igla, i);
    if (at < 0) break;
    const konec = src.indexOf("}", at);
    out.push(src.slice(at + igla.length, konec < 0 ? at + igla.length : konec).trim());
    i = at + igla.length;
  }
  return out;
}

/**
 * Разобранные вручную безопасные места: файл → выражения внутри скобок.
 *
 * Каждое проверено чтением кода 08.09.2026, четыре — соседним окном, два
 * (CONNECTION LIMIT) — этим. Список намеренно поимённый: он обязан заставить
 * разобрать новое место, а не молча его пропустить.
 */
const RAZOBRANO: Record<string, string[]> = {
  // CONNECTION_LIMIT = Number(process.env…) || 5 — число, и это DDL при
  // заведении роли, а не параметризуемый запрос.
  "lib/devhubDbProvision.ts": ["CONNECTION_LIMIT", "CONNECTION_LIMIT"],
  // const limit = 60 — зашитая константа; пользовательский предел в этом же
  // файле проверяется через vNumber и уходит параметром (строка 205).
  "routes/build/vacancies.ts": ["limit"],
  // ROW_CAP = 5000 — константа.
  "routes/constitutionWaitlist.ts": ["ROW_CAP"],
  // limParam = `$3` / `$2` — это НОМЕР ПАРАМЕТРА, то есть правильная форма,
  // просто собранная в переменной. Текстом от дефекта не отличается — ровно
  // поэтому здесь список, а не правило.
  "services/qcoreai/store.ts": ["limParam", "limParam"],
};

describe("LIMIT в запросах — плейсхолдер, а не подставленное число", () => {
  const fajly = vseFajly(SRC);

  it("прибор видит предмет: обход добрался до подпапок", () => {
    // Контроль охвата в ОБЕ стороны. Первая редакция читала 125 файлов из 380
    // и была зелёной — то есть «находок нет» означало «смотрю на треть кода».
    expect(fajly.length, "файлов найдено подозрительно мало — обход сломан").toBeGreaterThan(300);
    expect(
      fajly.some((f) => f.includes(join("routes", "build"))),
      "подпапки src/routes снова не читаются — вернулась прежняя слепота",
    ).toBe(true);
  });

  it("прибор различает формы: правильных LIMIT $${…} в коде много, и они не находки", () => {
    // Без этого контроля «находок 0» было бы неотличимо от «шаблон ничего не
    // находит». Правильная форма обязана встречаться и обязана НЕ считаться.
    let pravilnyh = 0;
    for (const put of fajly) {
      const src = readFileSync(put, "utf8");
      pravilnyh += src.split("LIMIT $${").length - 1;
    }
    expect(pravilnyh, "правильной формы не найдено вовсе — прибор смотрит не туда").toBeGreaterThan(30);
  });

  it("нигде нет LIMIT с ДЛИНОЙ массива в шаблоне — это всегда опечатка", () => {
    const nahodki: string[] = [];
    for (const put of fajly) {
      const src = stripComments(readFileSync(put, "utf8"));
      for (const vyrazhenie of mestaSOdinarnymDollarom(src)) {
        if (/\.length\s*$/.test(vyrazhenie)) {
          nahodki.push(`${put.slice(SRC.length + 1)}: LIMIT $\{${vyrazhenie}} — забыт доллар перед скобкой`);
        }
      }
    }
    expect(
      nahodki,
      "LIMIT подставляет ЧИСЛО ПАРАМЕТРОВ в текст запроса — параметр останется непривязанным, ручка отвечает 500 всегда",
    ).toEqual([]);
  });

  it("новых мест с одинарным долларом не появилось (храповик)", () => {
    const seichas: Record<string, string[]> = {};
    for (const put of fajly) {
      const src = stripComments(readFileSync(put, "utf8"));
      const mesta = mestaSOdinarnymDollarom(src);
      if (mesta.length) seichas[put.slice(SRC.length + 1).split("\\").join("/")] = mesta;
    }
    const novye: string[] = [];
    for (const [fajl, vyrazheniya] of Object.entries(seichas)) {
      const izvestnye = RAZOBRANO[fajl] ?? [];
      for (const v of vyrazheniya) {
        const i = izvestnye.indexOf(v);
        if (i < 0) novye.push(`${fajl}: LIMIT $\{${v}}`);
        else izvestnye.splice(i, 1);
      }
    }
    expect(
      novye,
      "Появился новый LIMIT со значением из шаблона. Текстом безопасное от дефекта " +
        "не отличается, поэтому разберите руками: если внутри НОМЕР параметра ($3) или " +
        "константа — впишите место в RAZOBRANO с объяснением; если там число параметров " +
        "или значение из запроса — это тот самый дефект, добавьте доллар.",
    ).toEqual([]);
  });
});
