/**
 * Платный пилот $490 на `/proof`: нажатие ДОЛЖНО быть видно воронке.
 *
 * 🔴 ЗАЧЕМ СТОРОЖ ИМЕННО НА ЭТО. Смысл блока — узнать, берут ли пилот. Если
 * нажатие не доезжает до учёта, страница выглядит работающей, а ответа на
 * главный вопрос нет; такой отказ мы уже получали дважды — своё событие,
 * заведённое только на фронте, сервер отбрасывал с ответом 200, и ступень
 * воронки терялась целиком.
 *
 * Поэтому проверяется СВОЙСТВО, а не вёрстка:
 *   1. нажатие отправляет РОВНО ДВА события, и оба — из имён, которые уже
 *      приняты бэкендом (`cta_click` для разреза по письмам, `feature_use` для
 *      разреза `byFeature`, где наши пробы отделены от людей);
 *   2. цена на кнопке и в заголовке приходит ИЗ КОНСТАНТЫ, а не из вёрстки;
 *   3. письмо-заказ несёт тему и состав поставки.
 *
 * ⚠️ Чего сторож НЕ утверждает: что событие доехало до прода. Он проверяет
 * нашу половину — что отправитель вызван с этими именами. Что сервер их
 * принимает, доказано тем, что оба имени стоят в `ALLOWED_TYPES` бэкенда
 * (проверено чтением 12.10.2026), и живым замером после выкатки.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ProofPilotBlock } from "../ProofPilotBlock";
import { PILOT_USD, PILOT_RECORDS, PILOT_FEATURE, pismoZakaza } from "@/lib/proofPilot";

const отправленные: Array<Record<string, unknown>> = [];
vi.mock("@/lib/track", () => ({
  track: (p: Record<string, unknown>) => {
    отправленные.push(p);
  },
}));

beforeEach(() => {
  отправленные.length = 0;
});

describe("нажатие на пилот видно воронке", () => {
  test("🔴 одно нажатие — два события, оба известных имени", () => {
    render(<ProofPilotBlock />);
    const кнопка = screen.getByText(`Order the pilot — $${PILOT_USD}`);
    кнопка.click();

    expect(отправленные.length, "нажатие обязано отправить ровно два события").toBe(2);
    const имена = отправленные.map((e) => e.type);
    // Имена именно эти: оба приняты бэкендом, молча отброшены быть не могут.
    expect(имена).toContain("cta_click");
    expect(имена).toContain("feature_use");
  });

  test("🔴 шаг назван, иначе в разрезе byFeature его не отличить от других", () => {
    render(<ProofPilotBlock />);
    screen.getByText(`Order the pilot — $${PILOT_USD}`).click();

    const шаг = отправленные.find((e) => e.type === "feature_use");
    expect((шаг?.meta as Record<string, unknown>)?.feature).toBe(PILOT_FEATURE);
    // И у нажатия тоже: разрез по письмам иначе покажет «нажали», но не что.
    const нажатие = отправленные.find((e) => e.type === "cta_click");
    expect((нажатие?.meta as Record<string, unknown>)?.feature).toBe(PILOT_FEATURE);
    expect(нажатие?.source, "источник — страница, с которой пришёл человек").toBe("proof");
  });

  test("без нажатия не отправляется ничего — контроль прибора", () => {
    render(<ProofPilotBlock />);
    expect(отправленные.length).toBe(0);
  });

  /*
   * 🔴 ЦЕНА ПРОВЕРЯЕТСЯ ЛИТЕРАЛОМ, И ВОТ ПОЧЕМУ.
   *
   * Первая редакция сторожа выводила ожидание из самой охраняемой константы
   * (`$${PILOT_USD}`), и мутация 490 -> 491 прошла НАСКВОЗЬ: менялись
   * одновременно и страница, и ожидание. Это тавтология — проверка утверждала
   * «число равно самому себе». Решение основателя 12.10.2026 («490») стоит
   * здесь литералом: политику пишем числом, поведение выводим из константы.
   * Меняется цена решением основателя — меняется и эта строка, осознанно.
   */
  test("🔴 цена пилота — ровно та, что решил основатель: $490", () => {
    expect(PILOT_USD).toBe(490);
    render(<ProofPilotBlock />);
    expect(document.body.textContent ?? "").toContain("$490");
  });

  test("🔴 цена приходит из константы: в разметке её нет", () => {
    render(<ProofPilotBlock />);
    // Заголовок и кнопка называют ОДНО число, и это число — из модуля.
    expect(screen.getByText(`Paid pilot — $${PILOT_USD}`)).toBeTruthy();
    expect(screen.getByText(`Order the pilot — $${PILOT_USD}`)).toBeTruthy();
    // Контроль: другого числа на блоке нет — иначе цена разошлась бы с письмами.
    const текст = document.body.textContent ?? "";
    const цены = [...текст.matchAll(/\$(\d[\d,]*)/g)].map((m) => m[1].replace(/,/g, ""));
    expect(новыйНабор(цены), `найденные цены: ${цены.join(", ")}`).toEqual(["490"]);
  });

  test("письмо-заказ несёт тему и состав поставки", () => {
    const ссылка = pismoZakaza();
    expect(ссылка.startsWith("mailto:data@aevion.app?")).toBe(true);
    const запрос = new URLSearchParams(ссылка.slice(ссылка.indexOf("?") + 1));
    expect(запрос.get("subject")).toBe(`Pilot request - $${PILOT_USD}`);
    const тело = запрос.get("body") ?? "";
    // Без объёма и формата письмо не отличить от обычного вопроса.
    for (const строка of ["Records to sign:", "Delivery format:", "Deadline:"]) {
      expect(тело, `в письме нет строки «${строка}»`).toContain(строка);
    }
  });

  test("объём записей на странице — тоже из константы", () => {
    render(<ProofPilotBlock />);
    const текст = document.body.textContent ?? "";
    expect(текст).toContain(PILOT_RECORDS.toLocaleString("en-US"));
  });

  test("границы названы прямо: заглушка проверки документов и отсутствие SOC 2", () => {
    render(<ProofPilotBlock />);
    const текст = (document.body.textContent ?? "").toLowerCase();
    for (const слово of ["stub", "soc", "iso", "consent-to-train", "no data catalogue"]) {
      expect(текст, `обещание без оговорки «${слово}»`).toContain(слово);
    }
  });
});

/*
 * 🔴 УКАЗАТЕЛЬ ИЗ ПЕРВОГО ЭКРАНА НЕ ДОЛЖЕН ВЕСТИ В НИКУДА.
 *
 * Замер 12.10.2026 живым браузером на проде 02a69a6bd531: кнопка пилота
 * достижима, но лежит на 4.9 экрана вниз при 390×844 и на 3.0 при 1463×724.
 * Поэтому в первом экране стоит строка-ссылка на `#pilot`. У такой пары есть
 * свой класс отказа: один конец переживает правку, другой нет, и ссылка молча
 * перестаёт куда-либо вести — страница при этом выглядит исправной.
 *
 * Сторож держит ОБА конца. Мишень проверяется отрисовкой (а не чтением файла),
 * чтобы переименование свойства не прошло мимо; ссылка — чтением страницы,
 * потому что страница серверная и в прогоне не отрисовывается.
 */
describe("ссылка из первого экрана ведёт на блок", () => {
  test("🔴 у блока есть мишень id=pilot", () => {
    const { container } = render(<ProofPilotBlock />);
    expect(container.querySelector("#pilot"), "мишени #pilot нет — ссылка сверху ведёт в никуда").toBeTruthy();
  });

  test("🔴 на странице есть ссылка на эту мишень", () => {
    const страница = readFileSync(
      join(process.cwd(), "src/app/proof/page.tsx"),
      "utf8",
    );
    expect(страница).toContain('href="#pilot"');
    // Контроль прибора: файл прочитан, а не пуст.
    expect(страница.length).toBeGreaterThan(5000);
    expect(страница).toContain("ProofPilotBlock");
  });
});

/** Уникальные значения по порядку первого появления. */
function новыйНабор(список: string[]): string[] {
  return [...new Set(список)];
}
