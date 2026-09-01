import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Каждый отправитель вебхуков обязан проверять адрес ПЕРЕД обращением.
 *
 * 28.08.2026 я закрыл этот класс в четырёх местах и решил, что их четыре.
 * 29.08 сплошной обход показал ещё ТРИ: `lib/modules/webhooks.ts`,
 * `lib/qshield/webhooks.ts`, `lib/qsignV2/webhooks.ts` — все три брали адрес из
 * базы (`row.url`, записанный пользователем) и шли по нему без единой проверки.
 *
 * Вывод «мест четыре» был сделан по тем модулям, которые я в тот день трогал,
 * а не по обходу. Этот сторож существует, чтобы восьмое место нашлось само.
 *
 * ПРАВИЛО, которое он держит: если файл делает `fetch` по адресу ИЗ ДАННЫХ
 * (переменная, а не литерал), он обязан звать `checkPublicUrl`, и звать ДО
 * обращения. Проверка после обращения бесполезна.
 */

const NL = String.fromCharCode(10);
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

const strip = (s: string) =>
  s.split(NL).filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  }).join(NL);

/**
 * Отправители, ИЗВЕСТНЫЕ на момент написания сторожа. Список нужен не для
 * поиска — поиск ниже идёт по признаку, — а как поимённый контроль: если обход
 * перестанет их находить, сторож обязан сказать об этом, а не позеленеть.
 */
const KNOWN_SENDERS = [
  "lib/modules/webhooks.ts",
  "lib/qshield/webhooks.ts",
  "lib/qsignV2/webhooks.ts",
  "lib/webhookDelivery.ts",
];

/**
 * Отправители: файл шлёт вебхук по адресу ИЗ ДАННЫХ.
 *
 * ⚠️ Первая версия искала три конкретных имени переменной — row, target, opts.
 * Это тот же дефект, который в тот же день нашёлся у сторожа воронки: свип,
 * перечисляющий известные случаи, НЕ ВИДИТ новый и молчит об этом. Отправитель,
 * написавший `fetch(sub.url)`, прошёл бы без проверки адреса, а контроль
 * «найдено не меньше четырёх» остался бы зелёным — четыре старых на месте.
 *
 * Теперь имя переменной любое, а требование привязано К НЕЙ ЖЕ: тот, чей `.url`
 * уходит в fetch, должен быть проверен `checkPublicUrl(<он же>.url)`.
 */
function senders(): { rel: string; src: string; vars: string[] }[] {
  const out: { rel: string; src: string; vars: string[] }[] = [];
  for (const f of walk(SRC)) {
    const s = strip(readFileSync(f, "utf8"));
    const vars = new Set<string>();
    const re = /fetch\(\s*([A-Za-z_][A-Za-z0-9_]*)\.url/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) vars.add(m[1]);
    if (vars.size === 0) continue;
    out.push({ rel: relative(SRC, f).split(sep).join("/"), src: s, vars: [...vars] });
  }
  return out;
}

/** Тело функции по имени — от объявления до следующего объявления. */
function bodyOf(src: string, name: string): string | null {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return null;
  const rest = src.slice(at + 10);
  const next = rest.search(/\n(export )?(async )?function |\nconst [A-Z]/);
  return next < 0 ? rest : rest.slice(0, next);
}

/**
 * Проверен ли адрес, лежащий в `<v>.url`, ПЕРЕД отправкой.
 *
 * Прямой вызов — не единственная законная форма. `routes/smeta-trainer.ts`
 * зовёт свою обёртку `webhookTargetAllowed(w.url)`, и внутри неё стоит
 * `checkPublicUrl`. Первая версия расширенного сторожа записала этот файл в
 * нарушители — то есть, расширив охват, я тут же завёл ложную тревогу.
 *
 * Ложная тревога на сторожe хуже пропуска: к красному, которое «всегда так»,
 * привыкают за день и перестают читать. Поэтому обёртка засчитывается — но
 * только та, внутри которой действительно есть проверка.
 */
function isChecked(src: string, v: string): boolean {
  if (src.includes(`checkPublicUrl(${v}.url)`)) return true;
  // Вторая законная форма, и она БЕЗОПАСНЕЕ первой: переменная сама и есть
  // результат проверки — `const verdict = await checkPublicUrl(url)`, а дальше
  // `fetch(verdict.url)`. Здесь в запрос уходит уже разобранный и одобренный
  // адрес, а не исходная строка, то есть подменить его между проверкой и
  // вызовом нельзя.
  //
  // Добавлено 31.08.2026 при сборке к запуску: сторож краснел на routes/devhub.ts,
  // где написано именно так. Ложная тревога на стороже дороже пропуска — к
  // красному, которое «всегда такое», привыкают за день и перестают читать, а
  // следующим шагом сторожа отключают. Поэтому шаблон приведён к СМЫСЛУ, а не
  // код к шаблону.
  if (src.includes(`${v} = await checkPublicUrl(`)) return true;
  const re = new RegExp(`([A-Za-z_][A-Za-z0-9_]*)\\(\\s*${v}\\.url`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const fn = m[1];
    if (fn === "fetch") continue;
    const body = bodyOf(src, fn);
    if (body && body.includes("checkPublicUrl")) return true;
  }
  return false;
}

describe("отправители вебхуков проверяют адрес перед обращением", () => {
  const list = senders();

  // Контроль охвата: без него сломанный обход дал бы пустой список, и сторож
  // ответил бы «нарушений нет», не посмотрев ни на один файл.
  it("контроль прибора: отправители найдены", () => {
    expect(list.length, "не нашёл ни одного отправителя — сломан обход")
      .toBeGreaterThanOrEqual(4);
  });

  it("контроль охвата ПОИМЁННО: все известные отправители в списке", () => {
    // Числа тут не годятся: «найдено не меньше четырёх» проходит и тогда, когда
    // обход потерял одного старого и подобрал одного нового. Число совпадает,
    // состав — нет, а отвечать надо на вопрос ЧЬИХ.
    const seen = new Set(list.map((f) => f.rel));
    const lost = KNOWN_SENDERS.filter((k) => !seen.has(k));
    expect(lost, `обход перестал видеть отправителя: ${lost.join(", ")}`).toEqual([]);
  });

  it("каждый зовёт проверку адреса", () => {
    // Ищем ВЫЗОВ на том же значении, которое уходит в fetch, а не имя:
    // строка "checkPublicUrl" остаётся в импорте даже после удаления вызова,
    // и сторож на имени переживал бы обезвреживание. Мутация это и показала.
    const naked = list
      .filter((f) => f.vars.some((v) => !isChecked(f.src, v)))
      .map((f) => f.rel);
    expect(
      naked,
      `отправитель идёт по адресу из данных без проверки: ${naked.join(", ")}`,
    ).toEqual([]);
  });

  it("проверка стоит ДО обращения, а не после", () => {
    const late = list
      .filter((f) =>
        f.vars.some((v) => {
          const check = f.src.indexOf(`checkPublicUrl(${v}.url)`);
          const sendAt = f.src.indexOf(`fetch(${v}.url`);
          return check > 0 && sendAt > 0 && check > sendAt;
        }),
      )
      .map((f) => f.rel);
    expect(late, `проверка стоит ПОСЛЕ обращения — она бесполезна: ${late.join(", ")}`).toEqual([]);
  });
});
