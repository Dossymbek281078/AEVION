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

const CALLS = ["checkPublicUrl(row.url)", "checkPublicUrl(target.url)", "checkPublicUrl(opts.url)"];

const strip = (s: string) =>
  s.split(NL).filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  }).join(NL);

/** Отправители: файл шлёт вебхук по адресу из данных. */
function senders(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  for (const f of walk(SRC)) {
    const s = strip(readFileSync(f, "utf8"));
    // адрес из данных: fetch(row.url / target.url / opts.url)
    if (!/fetch\((?:row|target|opts)\.url/.test(s)) continue;
    out.push({ rel: relative(SRC, f).split(sep).join("/"), src: s });
  }
  return out;
}

describe("отправители вебхуков проверяют адрес перед обращением", () => {
  const list = senders();

  // Контроль охвата: без него сломанный обход дал бы пустой список, и сторож
  // ответил бы «нарушений нет», не посмотрев ни на один файл.
  it("контроль прибора: отправители найдены", () => {
    expect(list.length, "не нашёл ни одного отправителя — сломан обход")
      .toBeGreaterThanOrEqual(4);
  });

  it("каждый зовёт проверку адреса", () => {
    // Ищем ВЫЗОВ на том же значении, которое уходит в fetch, а не имя:
    // строка "checkPublicUrl" остаётся в импорте даже после удаления вызова,
    // и сторож на имени переживал бы обезвреживание. Мутация это и показала.
    const naked = list
      .filter((f) => !CALLS.some((c) => f.src.includes(c)))
      .map((f) => f.rel);
    expect(
      naked,
      `отправитель идёт по адресу из данных без проверки: ${naked.join(", ")}`,
    ).toEqual([]);
  });

  it("проверка стоит ДО обращения, а не после", () => {
    const late = list
      .filter((f) => {
        const found = CALLS.map((c) => f.src.indexOf(c)).filter((i) => i >= 0);
        const check = found.length ? Math.min(...found) : -1;
        const send = ["fetch(row.url", "fetch(target.url", "fetch(opts.url"]
          .map((c) => f.src.indexOf(c)).filter((i) => i >= 0);
        const sendAt = send.length ? Math.min(...send) : -1;
        return check > 0 && sendAt > 0 && check > sendAt;
      })
      .map((f) => f.rel);
    expect(late, `проверка стоит ПОСЛЕ обращения — она бесполезна: ${late.join(", ")}`).toEqual([]);
  });
});
