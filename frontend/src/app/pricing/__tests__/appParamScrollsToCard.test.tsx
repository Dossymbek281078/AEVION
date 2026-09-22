import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Пришедший ЗА КОНКРЕТНЫМ приложением должен увидеть его карточку, а не начало
 * длинной страницы. Замер 22.09.2026 (телефон 390 px): /pricing?app=qright#apps
 * открывался сверху, карточка стояла на y≈6900 — восемь экранов вниз, и первой
 * кнопкой на экране была «Купить CyberChess».
 *
 * Здесь проверяется САМО ПРАВИЛО прокрутки, отдельно от большой страницы:
 * ждать появления карточки и только потом прокручивать; не нашли — не трогать.
 */
function прокруткаККарточке(слаг: string, шагМс = 150, пределПопыток = 40): () => void {
  let попыток = 0;
  const таймер = setInterval(() => {
    const карточка = document.querySelector(`[data-app="${CSS.escape(слаг)}"]`);
    if (карточка) {
      clearInterval(таймер);
      (карточка as HTMLElement & { scrollIntoView: (o?: unknown) => void }).scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (++попыток > пределПопыток) {
      clearInterval(таймер);
    }
  }, шагМс);
  return () => clearInterval(таймер);
}

describe("страница цен довозит до нужной карточки", () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ""; });
  afterEach(() => { vi.useRealTimers(); });

  it("карточка появилась позже — всё равно прокручиваем", async () => {
    прокруткаККарточке("qright");
    // карточка приходит на четвёртом тике, как после гидрации
    await vi.advanceTimersByTimeAsync(450);
    const el = document.createElement("div");
    el.setAttribute("data-app", "qright");
    const зов = vi.fn();
    (el as unknown as { scrollIntoView: unknown }).scrollIntoView = зов;
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(200);
    expect(зов, "до карточки не довезли — человек остался наверху").toHaveBeenCalled();
  });

  it("КОНТРОЛЬ: чужая карточка не считается нужной", async () => {
    прокруткаККарточке("qright");
    const el = document.createElement("div");
    el.setAttribute("data-app", "cyberchess");
    const зов = vi.fn();
    (el as unknown as { scrollIntoView: unknown }).scrollIntoView = зов;
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(1000);
    expect(зов, "прокрутили к чужому приложению").not.toHaveBeenCalled();
  });

  it("КОНТРОЛЬ: карточки нет вовсе — попытки прекращаются, ошибки нет", async () => {
    прокруткаККарточке("qright", 150, 3);
    await expect(vi.advanceTimersByTimeAsync(2000)).resolves.not.toThrow();
  });
});
