import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Выкатка не объявляет поддомен, которого Cloudflare не выдал.
 *
 * Замер 28.08.2026. Настройка своего поддомена делала три вызова к Cloudflare —
 * привязка домена к проекту Pages, поиск существующей CNAME-записи и её
 * создание или обновление — и НИ ОДИН ответ не читался. Сразу после них
 * безусловно выполнялось `customDomain = fullDomain`.
 *
 * То есть при отказе провайдера выкатка всё равно сообщала адрес вида
 * `<проект>.aevion.build`, которого не существует. И это не гипотеза: зона
 * `aevion.build` не делегирована (проверено 27.08.2026, NS-запрос отвечает
 * «домен не существует» при живом контроле на aevion.app), значит отказ здесь —
 * обычный случай, а не редкий.
 *
 * Починка не меняет решения: своего поддомена по-прежнему может не быть, и это
 * не роняет выкатку — она остаётся на рабочем адресе *.pages.dev. Меняется
 * одно: отказ перестаёт превращаться в обещание, а его причина попадает в
 * журнал сборки, который человек видит.
 *
 * 409 намеренно НЕ считается отказом: он означает «домен уже привязан к этому
 * проекту», то есть желаемое состояние уже достигнуто.
 *
 * Сторож по исходнику: поведенческий путь потребовал бы живого Cloudflare либо
 * подмены сети внутри маршрута выкатки.
 */

const FILE = path.join(__dirname, "..", "src", "routes", "devhub.ts");

function code(): string {
  return fs
    .readFileSync(FILE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

/** Кусок кода, отвечающий за выдачу своего поддомена. */
function domainBlock(): string {
  const c = code();
  // Якорь — КОД, а не комментарий: комментарии вырезаются выше, и цепляться за
  // их текст значит искать то, чего в разбираемой строке уже нет. Первая
  // попытка так и промахнулась — упала на упоминание домена в другом месте.
  const anchor = c.indexOf("customDomain = fullDomain");
  expect(anchor, "блок выдачи поддомена не найден — сторож смотрит не туда").toBeGreaterThan(-1);
  return c.slice(Math.max(0, anchor - 2600), anchor + 900);
}

describe("свой поддомен объявляется только когда выдан", () => {
  test("прибор работает: блок найден и в нём есть вызовы к Cloudflare", () => {
    const b = domainBlock();
    expect(b.length).toBeGreaterThan(500);
    expect(b).toContain("dns_records");
  });

  test("ответ на привязку домена читается", () => {
    const b = domainBlock();
    expect(b, "привязка домена снова не проверяет ответ").toMatch(/addResp\.ok/);
    // 409 — уже привязан, это не отказ.
    expect(b).toMatch(/addResp\.status !== 409/);
  });

  test("ответ на запись DNS читается", () => {
    expect(domainBlock(), "запись DNS снова не проверяет ответ").toMatch(/dnsResp\.ok/);
  });

  test("отказ провайдера назван кодом и телом ответа", () => {
    const b = domainBlock();
    expect(b).toMatch(/Pages domain refused \(\$\{addResp\.status\}\)/);
    expect(b).toMatch(/DNS record refused \(\$\{dnsResp\.status\}\)/);
  });

  test("поддомен присваивается ПОСЛЕ проверок, а не до них", () => {
    const b = domainBlock();
    const dnsCheck = b.indexOf("dnsResp.ok");
    const assign = b.indexOf("customDomain = fullDomain");
    expect(dnsCheck).toBeGreaterThan(-1);
    expect(assign).toBeGreaterThan(-1);
    expect(assign, "адрес объявляется раньше, чем проверен").toBeGreaterThan(dnsCheck);
  });

  test("направление: отказ поддомена НЕ роняет выкатку", () => {
    // Проект остаётся на рабочем адресе *.pages.dev; терять выкатку из-за
    // необязательного поддомена нельзя.
    const b = domainBlock();
    expect(b).toMatch(/catch \(domainErr/);
    expect(b).toMatch(/buildLog \+= ` \| domain:/);
  });
});
