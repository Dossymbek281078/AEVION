import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../__tests__/helpers/sourceCode";

/**
 * Заход на /go считается, и тем же источником, что и покупка с неё.
 *
 * /go — единственная кликабельная ссылка из шапок соцсетей: на неё ведёт вся
 * кампания. Замер 27.08.2026: события page_view шлют шесть страниц платформы,
 * а /go не слала ни одного. Покупка при этом помечалась каналом.
 *
 * Следствие было бы дорогим и незаметным: после раздачи двенадцати роликов мы
 * увидели бы продажи с источником и не увидели бы заходов. А без заходов «ноль
 * продаж» не отличить от «никто не пришёл» — первое лечат предложением и
 * ценой, второе трафиком. Два разных решения, и выбирать наугад дороже, чем
 * измерить.
 */

const GO = join(__dirname, "..");
const page = stripComments(readFileSync(join(GO, "page.tsx"), "utf8"));
const beacon = stripComments(readFileSync(join(GO, "PageViewBeacon.tsx"), "utf8"));

describe("заход на /go попадает в воронку", () => {
  test("контроль: оба файла прочитаны и это те самые", () => {
    expect(page).toContain("goSource");
    expect(beacon).toContain("page_view");
  });

  test("страница действительно зажигает маячок", () => {
    expect(page, "маячок не подключён — заходы не считаются").toContain("<PageViewBeacon");
  });

  test("заход помечается ТЕМ ЖЕ источником, что и покупка", () => {
    // Иначе заход и покупка окажутся в воронке под разными именами, и доля
    // покупок посчитается неверно — молча.
    const at = page.indexOf("<PageViewBeacon");
    expect(at, "маячка нет").toBeGreaterThanOrEqual(0);
    // Ровно до закрытия ТЕГА, а не «плюс 160 знаков»: следующей строкой идёт
    // <LandingView source={goSource} />, и окно по длине захватывало её —
    // проверка проходила, даже когда у маячка стоял чужой источник. Ловится
    // только мутацией: глазами такой тест выглядит строгим.
    const end = page.indexOf("/>", at);
    expect(end, "тег маячка не закрыт").toBeGreaterThan(at);
    const tag = page.slice(at, end);
    expect(tag, "источник у захода не goSource").toContain("source={goSource}");
    expect(tag, "канал не передан — заход будет без источника").toContain("channel={channel}");
  });

  test("маячок клиентский и шлёт ровно page_view", () => {
    // Страница серверная: без "use client" useEffect не выполнится вовсе, и
    // маячок молча не зажжётся — ровно тот отказ, который не видно.
    expect(beacon.split(String.fromCharCode(10))[0]).toContain("use client");
    expect(beacon).toContain('type: "page_view"');
    expect(beacon, "маячок должен молчать в разметке").toContain("return null");
  });
});
