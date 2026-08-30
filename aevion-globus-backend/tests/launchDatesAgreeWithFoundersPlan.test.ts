import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Даты запуска живут в ДВУХ списках разных файлов, и оба уходят человеку:
 * `constitutionBrevo.ts` — письмо подписчику, `launchAnnounce.ts` — анонс.
 * Два источника одного факта расходятся молча: ничего не падает, письмо
 * просто называет не тот день.
 *
 * Замер 30.08.2026: расходились ЧЕТЫРЕ строки из пяти. Письмо обещало шахматы
 * 30 августа (перенесено на 30 сентября), DevHub 13 сентября и мультичат
 * 20 сентября — при плане основателя на 10 сентября. Часть сентябрьских дат
 * прежняя сессия честно пометила как выдуманные: каждая опиралась на файлы,
 * написанные ею же в тот день.
 *
 * Сторож проверяет ДВА разных утверждения, и это не одно и то же:
 *   1) списки согласны между собой;
 *   2) они согласны с решением основателя.
 * Второе важнее: два списка могут дружно врать.
 */

const SRC = join(__dirname, "..", "src", "lib");
const brevo = readFileSync(join(SRC, "constitutionBrevo.ts"), "utf8");
const announce = readFileSync(join(SRC, "launchAnnounce.ts"), "utf8");

/** Даты из плана основателя от 30.08.2026. Менять только вместе с планом. */
const PLAN: Record<string, string> = {
  cyberchess: "30 сентября",
  bureau: "10 сентября",
  qright: "10 сентября",
  devhub: "10 сентября",
  multichat: "10 сентября",
};

function planDates(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/prefix: "([a-z]+)"[^}]*?plan: "([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

describe("даты запуска не расходятся между письмом, анонсом и планом основателя", () => {
  it("письмо подписчику называет даты из плана", () => {
    const got = planDates(brevo);
    // Контроль охвата: разбор обязан НАЙТИ все модули, иначе пустой результат
    // прошёл бы как «расхождений нет» — самый частый вид ложного зелёного.
    expect(Object.keys(got).sort()).toEqual(Object.keys(PLAN).sort());
    for (const [prefix, date] of Object.entries(PLAN)) {
      expect(got[prefix], `модуль ${prefix} в письме`).toBe(date);
    }
  });

  it("реестр анонсов согласен с планом там, где дата у него задана", () => {
    const dated = [...announce.matchAll(/(\w+): \{\s*name: "[^"]*",\s*date: "([^"]+)"/g)];
    expect(dated.length, "хотя бы у одного модуля дата должна быть задана").toBeGreaterThan(0);
    for (const m of dated) {
      const [, slug, date] = m;
      if (PLAN[slug]) expect(date, `модуль ${slug} в анонсе`).toBe(PLAN[slug]);
    }
  });

  it("старая дата 30 августа не осталась ни в одном из двух списков", () => {
    for (const [name, src] of [["письмо", brevo], ["анонс", announce]] as const) {
      const inList = [...src.matchAll(/(?:plan|date): "30 августа"/g)];
      expect(inList.length, `${name}: старая дата запуска`).toBe(0);
    }
  });

  it("у заданной даты в анонсе названо ПРОИСХОЖДЕНИЕ, а не пустая строка", () => {
    // Поле dateSource завела прежняя сессия после того, как обнаружила у себя
    // круговое доказательство: даты ссылались на её же файлы того же дня.
    for (const m of announce.matchAll(/date: "([^"]+)",\s*dateSource: "([^"]*)"/g)) {
      expect(m[2].length, `дата ${m[1]} без указания источника`).toBeGreaterThan(10);
    }
  });
});
