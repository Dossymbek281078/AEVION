import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Защита, объявленная и НИГДЕ не применяемая, — это обещание, а не защита.
 *
 * ПОВОД (29.08.2026). Отчёт «продаём против закрытого» говорил, что модуль
 * constitution открыт всем. Разбор показал: гейт для него НАПИСАН —
 * `requirePro` в `lib/constitutionGate.ts`, экспортирован, с типами
 * middleware. И не применяется ни в одном маршруте: единственное упоминание
 * в `constitutionPro.ts` оказалось КОММЕНТАРИЕМ, а не вызовом.
 *
 * Снаружи такое неотличимо от работающей защиты: файл на месте, функция
 * есть, имя говорит само за себя. Читающий код решит, что закрыто.
 *
 * ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ СПЯЩЕГО ПЕЙВОЛЛА. `requireModule()` из planGate
 * тоже ничего не закрывает по умолчанию — но он ПРИМЕНЁН к маршрутам и
 * бездействует осознанно, пока модуль не внесён в env PAYWALL_MODULES. Это
 * переключатель, и он задокументирован. Здесь же провода просто не
 * подсоединены, и об этом нигде не сказано.
 *
 * ГРАНИЦА. Сторож смотрит на ПРИМЕНЕНИЕ, а не на включённость: он не может
 * сказать, закрывает ли гейт кого-то на самом деле — это зависит от
 * переменных окружения, которых в коде нет. Он ловит ровно один случай:
 * функцию-защиту, которую не зовёт никто.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Почему каждое исключение здесь, а не почему «пока некогда». */
const OZHIDAYUT = new Map<string, string>([
  [
    "lib/constitutionGate.ts -> requirePro",
    "гейт написан, но подключение к маршрутам — продуктовое решение " +
      "основателя: включить его значит начать закрывать доступ",
  ],
]);

function vseFajly(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) vseFajly(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

type Fajl = { rel: string; src: string };

function zagruzit(): Fajl[] {
  return vseFajly(SRC).map((f) => ({
    rel: f.slice(SRC.length + 1).split(sep).join("/"),
    src: readFileSync(f, "utf8"),
  }));
}

/** Зовут ли имя ХОТЬ ГДЕ-ТО, кроме файла объявления. */
function zovut(vse: Fajl[], krome: string, name: string): boolean {
  const re = new RegExp("(^|[^A-Za-z0-9_])" + name + "\s*[(,)]");
  return vse.some((o) => o.rel !== krome && re.test(o.src));
}

function neprimenennye(): string[] {
  const vse = zagruzit();
  const bad: string[] = [];
  for (const { rel, src } of vse) {
    if (!/Gate|guard|paywall|access/i.test(rel)) continue;
    for (const line of src.split("\n")) {
      const m = line.match(/^export function ([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (!m) continue;
      const name = m[1];
      if (!/^(require|ensure|assert|gate|enforce)/.test(name)) continue;
      if (!zovut(vse, rel, name)) bad.push(`${rel} -> ${name}`);
    }
  }
  return bad;
}

describe("объявленные защиты действительно применяются", () => {
  it("сканер видит исходники, а не пустоту", () => {
    // Без этого переименование каталога сделало бы проверку зелёной молча.
    expect(zagruzit().length).toBeGreaterThan(200);
  });

  it("ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: применяемый гейт НЕ считается брошенным", () => {
    // requireModule() применён в index.ts к маршрутам. Если сканер назовёт
    // и его неприменяемым, значит он не умеет находить применения вообще,
    // и его «одна находка» ничего не стоит.
    const vse = zagruzit();
    expect(zovut(vse, "lib/planGate.ts", "requireModule")).toBe(true);
    expect(neprimenennye()).not.toContain("lib/planGate.ts -> requireModule");
  });

  it("новых брошенных защит не появилось", () => {
    const novye = neprimenennye().filter((x) => !OZHIDAYUT.has(x));
    expect(
      novye.join("\n"),
      "Функция-защита объявлена и не вызывается нигде. Снаружи это " +
        "неотличимо от работающей защиты: имя говорит, что закрыто, а " +
        "провода не подсоединены. Подключите её или уберите.",
    ).toBe("");
  });

  it("список исключений не протух: каждое всё ещё не применяется", () => {
    const est = new Set(neprimenennye());
    const podklyuchennye = [...OZHIDAYUT.keys()].filter((x) => !est.has(x));
    expect(
      podklyuchennye.join("\n"),
      "Эти защиты уже применяются — вычеркните их из OZHIDAYUT.",
    ).toBe("");
  });
});
