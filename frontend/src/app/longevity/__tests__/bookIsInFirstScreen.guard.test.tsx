/*
 * Платная книга видна В ПЕРВОМ ЭКРАНЕ телефона, и якорь #kniga ведёт на неё.
 *
 * 🔴 Замер 01.10.2026, из-за которого правка. `instagram|/go` — 17 сессий,
 * 15 дошли до цен (88 %, лучший отрезок всей воронки), 0 нажали «Купить».
 * Instagram приходит за долголетием. А за всё время платформа продала ТРИ раза
 * один и тот же товар — книгу `orcfbo` за $9.99; пакет `ghvzq` за $29.99,
 * который показывали, не купил никто. Платное лежало на ШЕСТОМ экране, первым
 * шло бесплатное.
 *
 * ⚠️ ЧТО ЭТОТ СТОРОЖ МОЖЕТ И ЧЕГО НЕ МОЖЕТ, честно. jsdom не считает вёрстку:
 * все размеры в нём нулевые, поэтому «выше 600 px» здесь НЕ проверяется — это
 * проверяется живым заходом (scripts/longevity-first-screen-probe.mjs) и
 * записано в его выводе. Здесь проверяется то, что от вёрстки не зависит и
 * ломается чаще: ПОРЯДОК блоков в разметке, наличие цены и кнопки у книги,
 * наличие якоря и то, что бесплатное не исчезло.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LongevityClient from "../_client";
import { productById } from "@/lib/products";

const КНИГА = productById("orcfbo");
const ПАКЕТ = productById("ghvzq");

describe("книга в первом экране /longevity", () => {
  it("контроль набора: оба товара есть в каталоге и цены те, что замерены", () => {
    // Без этого сторож мог бы проверять пустоту и быть зелёным.
    expect(КНИГА, "товара orcfbo нет в каталоге — проверять нечего").toBeTruthy();
    expect(ПАКЕТ, "товара ghvzq нет в каталоге").toBeTruthy();
    expect(КНИГА!.priceUsd, "цена книги сменилась — обнови замер и рекламу").toBe(9.99);
    expect(ПАКЕТ!.priceUsd, "цена пакета сменилась").toBe(29.99);
  });

  it("якорь #kniga стоит на карточке ПРОДАВАВШЕГОСЯ товара, а не на пакете", () => {
    const { container } = render(<LongevityClient channel={null} />);
    const якорь = container.querySelector("#kniga");
    expect(якорь, "якоря #kniga нет — платный клик приедет в начало страницы").not.toBeNull();

    const ссылка = якорь!.querySelector('a[href]');
    expect(ссылка, "внутри якоря нет ссылки на покупку").not.toBeNull();
    const href = ссылка!.getAttribute("href") ?? "";
    expect(href, `якорь ведёт не на orcfbo: ${href}`).toContain("orcfbo");
    // Отрицательный контроль: именно НЕ пакет. Их легко перепутать — я и
    // перепутал бы, если бы не сверил с кассой, что продавался $9.99.
    expect(href, "якорь #kniga ведёт на пакет $29.99, который не покупали").not.toContain("ghvzq");
  });

  it("у книги в якоре есть и ЦЕНА, и кнопка", () => {
    const { container } = render(<LongevityClient channel={null} />);
    const текст = (container.querySelector("#kniga") as HTMLElement).textContent ?? "";
    expect(текст, "в карточке книги нет цены").toContain("$9.99");
    // Кнопка — видимая подпись, а не только атрибут: подпись для скринридера
    // человек не видит, на этом мы уже обжигались.
    expect(текст.replace(/ /g, " "), "в карточке книги нет кнопки").toMatch(/Книга\s*→/);
  });

  it("ПОРЯДОК: книга $9.99 → пакет $29.99 → бесплатный протокол", () => {
    const { container } = render(<LongevityClient channel={null} />);
    const весь = container.textContent ?? "";
    const iКнига = весь.indexOf("$9.99");
    const iПакет = весь.indexOf("$29.99");
    // «Собрать план» — кнопка бесплатного инструмента, он идёт после платного.
    const iБесплатно = весь.indexOf("Собрать план");

    expect(iКнига, "цены книги нет в разметке").toBeGreaterThan(-1);
    expect(iПакет, "цены пакета нет в разметке").toBeGreaterThan(-1);
    expect(iБесплатно, "бесплатный инструмент ПРОПАЛ — его убирать не просили").toBeGreaterThan(-1);

    expect(iКнига, "пакет $29.99 стоит выше книги $9.99").toBeLessThan(iПакет);
    expect(iПакет, "платное оказалось ниже бесплатного — порядок прежний").toBeLessThan(iБесплатно);
  });

  it("у якоря задан отступ прокрутки — иначе карточка уедет под липкую шапку", () => {
    const { container } = render(<LongevityClient channel={null} />);
    const якорь = container.querySelector("#kniga") as HTMLElement;
    // Проверяем ЗАДАННОЕ значение (inline-стиль), а не вычисленное: вычислять
    // jsdom не умеет, и притворяться, что умеет, было бы ложью.
    expect(якорь.style.scrollMarginTop, "без отступа якорь приводит под шапку").not.toBe("");
  });
});
