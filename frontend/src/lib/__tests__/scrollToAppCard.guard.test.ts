import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ждатьКарточкуПриложения } from "../scrollToAppCard";

/**
 * ДО КАРТОЧКИ ПРИЛОЖЕНИЯ ЧЕЛОВЕКА ДОВОЗЯТ, А ПРОМАХ НЕ МОЛЧИТ.
 *
 * Повод 29.09.2026: переход `/pricing?app=cyberchess` оставлял человека
 * наверху. Замер на ширине телефона (390 px, 7 с ожидания): прокрутка 0,
 * карточка на 6162 px — 7.3 экрана вниз при длине страницы 23 экрана.
 * Прежнее ожидание считало ТАКТЫ (40 × 150 мс = 6 с) и кончалось раньше
 * отрисовки на медленном устройстве.
 *
 * Проверяется ТА ЖЕ функция, что работает на проде: ради этого она и вынесена
 * из страницы — копия правила в тесте расходится с оригиналом молча.
 */

beforeEach(() => {
  vi.useFakeTimers();
  // Гнездо создаётся ДО начала ожидания и живёт в дереве: карточка появится
  // внутри него, а не прямым ребёнком body. Иначе наблюдателю хватило бы
  // childList по body, и мутация «без поддерева» проходила бы мимо — проверено.
  document.body.innerHTML = "<section><div id=\"гнездо\"></div></section>";
});
afterEach(() => { vi.useRealTimers(); });

function карточка(слаг: string, прокруткаРаботает = true) {
  const el = document.createElement("div");
  el.setAttribute("data-app", слаг);
  // scrollIntoView в jsdom ничего не делает; подменяем его так, чтобы можно
  // было проверить ОБА случая: когда окно сдвинулось и когда нет.
  (el as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn(() => {
    if (прокруткаРаботает) Object.defineProperty(window, "scrollY", { value: 2406, configurable: true });
  });
  return el;
}

/**
 * Кладём карточку ГЛУБОКО в дерево, как на настоящей странице: там она лежит
 * внутри секции приложений, а не прямым ребёнком body. Первая версия теста
 * добавляла её в body — и мутация «наблюдать без поддерева» проходила мимо,
 * потому что прямых детей видно и без него.
 */
function положитьГлубоко(el: Element) {
  document.getElementById("гнездо")!.appendChild(el);
}

describe("ожидание карточки приложения", () => {
  it("карточка уже на месте — довозим сразу", () => {
    положитьГлубоко(карточка("cyberchess"));
    const доставлено = vi.fn();
    ждатьКарточкуПриложения("cyberchess", { приДоставке: доставлено, приПромахе: vi.fn() });
    expect(доставлено).toHaveBeenCalledOnce();
  });

  it("карточка появилась ПОЗЖЕ шести секунд — всё равно довозим", async () => {
    // Ровно тот случай, который ломал прежнее ожидание по тактам.
    const доставлено = vi.fn();
    const промах = vi.fn();
    ждатьКарточкуПриложения("cyberchess", { приДоставке: доставлено, приПромахе: промах });
    await vi.advanceTimersByTimeAsync(9000);
    expect(доставлено, "на девятой секунде ещё рано — карточки нет").not.toHaveBeenCalled();
    положитьГлубоко(карточка("cyberchess"));
    await vi.advanceTimersByTimeAsync(50);
    expect(доставлено, "карточка появилась, а её не довезли").toHaveBeenCalledOnce();
    expect(промах, "довезли и всё равно сообщили о промахе").not.toHaveBeenCalled();
  });

  it("карточки нет вовсе — промах НЕ молчит", async () => {
    const промах = vi.fn();
    ждатьКарточкуПриложения("qskyway", { приДоставке: vi.fn(), приПромахе: промах, срокМс: 1000 });
    await vi.advanceTimersByTimeAsync(1200);
    expect(промах, "человек остался наверху без объяснения").toHaveBeenCalledWith("qskyway");
  });

  it("КОНТРОЛЬ: чужая карточка не считается нужной", async () => {
    const доставлено = vi.fn();
    const промах = vi.fn();
    ждатьКарточкуПриложения("qright", { приДоставке: доставлено, приПромахе: промах, срокМс: 1000 });
    положитьГлубоко(карточка("cyberchess"));
    await vi.advanceTimersByTimeAsync(1200);
    expect(доставлено, "довезли к чужому приложению").not.toHaveBeenCalled();
    expect(промах).toHaveBeenCalledWith("qright");
  });

  it("уход со страницы отменяет ожидание — ни доставки, ни промаха", async () => {
    const доставлено = vi.fn();
    const промах = vi.fn();
    const о = ждатьКарточкуПриложения("cyberchess", { приДоставке: доставлено, приПромахе: промах, срокМс: 1000 });
    о.отменить();
    положитьГлубоко(карточка("cyberchess"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(доставлено).not.toHaveBeenCalled();
    expect(промах).not.toHaveBeenCalled();
  });
});

describe("прокрутка обязана СДВИНУТЬ окно, а не просто быть вызванной", () => {
  /*
   * 🔴 Замер 30.09.2026 на живом проде, настоящая вкладка:
   *   scrollIntoView({ block: "center" })                     → 2406 ✔
   *   scrollIntoView({ block: "center", behavior: "smooth" }) → 0    ✘
   * Плавная прокрутка молча не двигала окно (настройка «меньше движения»
   * выключена, scroll-behavior не переопределён, страница прокручиваема).
   * То есть прежний код и моя ночная починка звали действие, которое ничего
   * не делало, и обе выглядели рабочими.
   */
  it("не просит плавную прокрутку", () => {
    // Комментарии отбрасываем: в этом же файле причина описана словами, и
    // первая версия проверки краснела на СВОЁМ ЖЕ объяснении — текст о вещи
    // неотличим от вещи, если читать файл целиком.
    const исходник = readFileSync(join(__dirname, "..", "scrollToAppCard.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(new RegExp("//[^" + String.fromCharCode(10) + "]*", "g"), " ");

    expect(
      исходник.includes('behavior: "smooth"'),
      "вернулась плавная прокрутка — на проде она молча не двигает окно",
    ).toBe(false);
    // Контроль прибора: в очищенном исходнике осталось то, что там ТОЧНО есть.
    expect(исходник, "проверка читает пустоту — очистка съела код").toContain("scrollIntoView");
  });

  it("окно не сдвинулось — довозим вручную", () => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    const вручную = vi.fn();
    (window as unknown as { scrollTo: unknown }).scrollTo = вручную;
    const el = карточка("cyberchess", false); // scrollIntoView ничего не делает
    положитьГлубоко(el);
    ждатьКарточкуПриложения("cyberchess", { приДоставке: vi.fn(), приПромахе: vi.fn() });
    expect(
      вручную,
      "scrollIntoView ничего не сделал, а запасного пути нет — человек остался наверху",
    ).toHaveBeenCalled();
  });

  it("КОНТРОЛЬ: окно сдвинулось — вручную не трогаем", () => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    const вручную = vi.fn();
    (window as unknown as { scrollTo: unknown }).scrollTo = вручную;
    const el = карточка("cyberchess", true);
    положитьГлубоко(el);
    ждатьКарточкуПриложения("cyberchess", { приДоставке: vi.fn(), приПромахе: vi.fn() });
    expect(вручную, "дёрнули окно дважды — прокрутка прыгнет").not.toHaveBeenCalled();
  });
});
