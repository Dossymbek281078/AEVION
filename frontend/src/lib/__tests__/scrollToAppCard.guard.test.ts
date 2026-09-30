import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function карточка(слаг: string) {
  const el = document.createElement("div");
  el.setAttribute("data-app", слаг);
  (el as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn();
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
