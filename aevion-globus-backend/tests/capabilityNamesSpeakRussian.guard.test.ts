import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Имена возможностей человек ЧИТАЕТ — значит они на его языке.
 *
 * Панель на витрине модуля выводит `c.name` в строке «Настроено: N из M» и в
 * перечислении отключённых. Замер 28.08.2026: все 17 имён были на латинице —
 * «Code Editor», «Voice (TTS)», «Music & SFX» — посреди русского интерфейса.
 *
 * Названия сервисов НЕ переводятся: GitHub, Railway, Vercel, Cloudflare,
 * WhatsApp, SMS. Их и нельзя — это имена собственные, человек ищет их именно
 * так.
 *
 * Прежде чем менять, проверено, что по `name` никто не сверяется: единственное
 * упоминание вне списка — другая страница со своим захардкоженным перечнем,
 * а прод-смоук проверяет лишь непустоту массива. Идентификатор `id` остался
 * машинным — по нему и матчится интерфейс.
 */

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "routes", "devhub.ts"),
  "utf8",
);

/** Названия сервисов: остаются как есть, это имена собственные. */
const BRANDS = ["GitHub", "SMS", "WhatsApp", "Railway", "Vercel", "Cloudflare", "aevion.build"];

function capabilityNames(): string[] {
  const i = SRC.indexOf('devhubRouter.get("/studio/capabilities"');
  expect(i, "блок возможностей не найден — сторож смотрит не туда").toBeGreaterThan(0);
  const block = SRC.slice(i, i + 40000);
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const k = block.indexOf('name: "', from);
    if (k < 0) break;
    const e = block.indexOf('"', k + 7);
    if (e < 0) break;
    out.push(block.slice(k + 7, e));
    from = e + 1;
  }
  return out;
}

describe("имена возможностей — на языке человека", () => {
  test("прибор исправен: имена найдены, и их не меньше пятнадцати", () => {
    // Без этого пустой список сделал бы проверку ниже зелёной ни на чём.
    const names = capabilityNames();
    expect(names.length).toBeGreaterThanOrEqual(15);
  });

  test("каждое имя либо по-русски, либо название сервиса", () => {
    const CYR = /[а-яА-ЯёЁ]/;
    const bad = capabilityNames().filter(
      (n) => !CYR.test(n) && !BRANDS.some((b) => n.includes(b)),
    );
    expect(bad, "имя возможности на латинице в русском интерфейсе").toEqual([]);
  });

  test("идентификаторы остались машинными", () => {
    // Человеческое слово в `id` сломало бы сверку в интерфейсе и в смоуке —
    // это отдельный класс, из-за которого сегодня уже пришлось чинить 3D.
    const ids = SRC.slice(SRC.indexOf('devhubRouter.get("/studio/capabilities"'))
      .slice(0, 5000)
      .match(/id: "([^"]+)"/g) ?? [];
    const cyrillic = ids.filter((s) => /[а-яА-ЯёЁ]/.test(s));
    expect(cyrillic, "идентификатор стал человеческим текстом").toEqual([]);
  });
});

/**
 * Описания шаблонов тоже на языке человека.
 *
 * Замер 28.08.2026: восемь описаний шаблонов были на латинице — и они
 * ПОКАЗЫВАЮТСЯ: подписью в списке и подсказкой при наведении. Я успел записать
 * утром, что «описания на экран не выводятся» — это было верно для описаний
 * ВОЗМОЖНОСТЕЙ, а у шаблонов иначе. Одно слово «описание» про две разные вещи
 * и увело вывод.
 */
describe("описания шаблонов на языке человека", () => {
  const CYR = /[а-яА-ЯёЁ]/;

  function descriptionsIn(marker: string): string[] {
    const i = SRC.indexOf(marker);
    if (i < 0) return [];
    const block = SRC.slice(i, i + 40000);
    const out: string[] = [];
    let from = 0;
    for (;;) {
      const k = block.indexOf('description: "', from);
      if (k < 0) break;
      const e = block.indexOf('"', k + 14);
      if (e < 0) break;
      out.push(block.slice(k + 14, e));
      from = e + 1;
    }
    return out;
  }

  test("прибор исправен: описания найдены", () => {
    const all = [...descriptionsIn("export const TEMPLATES"), ...descriptionsIn("AGENT_TEMPLATES")];
    expect(all.length, "описаний не найдено — сторож смотрит не туда").toBeGreaterThanOrEqual(5);
  });

  test("ни одно описание шаблона не на латинице", () => {
    const bad = [...descriptionsIn("export const TEMPLATES"), ...descriptionsIn("AGENT_TEMPLATES")]
      .filter((d) => !CYR.test(d));
    expect(bad, "описание шаблона на латинице — а его читает человек").toEqual([]);
  });
});
