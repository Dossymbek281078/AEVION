// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PoloskaStarta from "../PoloskaStarta";
import { tFor } from "../i18n";

/*
 * 🔴 Первый экран шахмат не блокируется окном.
 *
 * Повод 13.10.2026 (приёмка bd): гостя на /cyberchess без ?puzzle= встречало
 * модальное окно «С чего начать» и перехватывало клик по «Задаче дня». Решение
 * оркестратора: то же содержимое не-модальной полоской над доской с крестиком,
 * показ один раз, клики по доске проходят сразу.
 *
 * Две половины: (1) сама полоска — не диалог, зовёт обработчики, подписи из
 * словаря на трёх языках; (2) страница — рендерит полоску одним помощником в
 * ДВУХ местах и больше не рендерит OnboardingOverlay (по исходнику: 16 тысяч
 * строк в jsdom не поднять). Почему два места: первый экран каждого — экран
 * настройки с превью доски (SetupBoardPreview), а колонка настоящей доски
 * монтируется только после первого действия. Первая версия ставила полоску
 * только в колонку — и на проде c17379338 её не видел никто (замер Playwright
 * 390×844 и код: 0 полосок до касания превью). Компонент OnboardingOverlay в
 * коде остаётся — у него свои тесты и он может понадобиться туру.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
const t = (k: string) => tFor("ru", k);

describe("полоска «С чего начать» — не модальное окно", () => {
  it("🔴 не диалог: нет role=dialog, aria-modal и position:fixed", () => {
    const { container } = render(<PoloskaStarta t={t} onIntent={vi.fn()} onClose={vi.fn()} onDaily={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("[aria-modal]")).toBeNull();
    const корень = container.querySelector("[data-cc-poloska-starta]") as HTMLElement;
    expect(корень).toBeTruthy();
    expect(корень.style.position).not.toBe("fixed");
    expect(корень.getAttribute("role")).toBe("region");
  });

  it("четыре входа и крестик зовут свои обработчики", () => {
    const onIntent = vi.fn();
    const onClose = vi.fn();
    const onDaily = vi.fn();
    render(<PoloskaStarta t={t} onIntent={onIntent} onClose={onClose} onDaily={onDaily} />);
    fireEvent.click(screen.getByText(/Задача дня/));
    fireEvent.click(screen.getByText(/Сыграй первую партию/));
    fireEvent.click(screen.getByText(/Реши задачу/));
    fireEvent.click(screen.getByText(/Спроси тренера/));
    fireEvent.click(screen.getByLabelText("Закрыть"));
    expect(onDaily).toHaveBeenCalledTimes(1);
    expect(onIntent.mock.calls.map((c) => c[0])).toEqual(["play", "puzzles", "learn"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("без задачи дня кнопки «Задача дня» нет — а не кнопка в пустоту", () => {
    const { container } = render(<PoloskaStarta t={t} onIntent={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelector('[data-cc-start="daily"]')).toBeNull();
    expect(container.querySelectorAll("[data-cc-start]").length).toBe(4);
  });

  it("подписи есть во всех трёх словарях (ключи не выдуманы)", () => {
    for (const loc of ["ru", "en", "kk"] as const) {
      for (const k of ["start.title", "start.daily.title", "start.game.title", "start.puzzle.title", "start.coach.title", "common.close"]) {
        expect(tFor(loc, k), `${loc}:${k}`).not.toBe(k);
      }
    }
  });
});

describe("страница шахмат показывает полоску вместо окна", () => {
  it("🔴 OnboardingOverlay на странице больше не рендерится", () => {
    expect(СТРАНИЦА.split("<OnboardingOverlay").length - 1).toBe(0);
    // и импорт по умолчанию снят — иначе это мёртвый импорт
    expect(СТРАНИЦА).not.toMatch(/import OnboardingOverlay[ ,]/);
  });

  it("🔴 один помощник под прежним условием показа, и ровно одна разметка полоски", () => {
    expect(СТРАНИЦА.split("<PoloskaStarta").length - 1).toBe(1);
    const i = СТРАНИЦА.indexOf("<PoloskaStarta");
    const строка = СТРАНИЦА.slice(СТРАНИЦА.lastIndexOf(String.fromCharCode(10), i) + 1, i);
    expect(строка, "помощник показывает только при showOnboarding").toContain("showOnboarding&&");
    expect(строка).toContain("const полоскаСтарта=");
  });

  it("🔴 два места показа: над превью экрана настройки (первый экран) и над строкой задания в колонке доски", () => {
    // объявление пишется «полоскаСтарта=(» и сюда не попадает — считаются только вызовы
    const вызовы = СТРАНИЦА.split("полоскаСтарта(").length - 1;
    expect(вызовы, "вызовов помощника").toBe(2);
    const превью = СТРАНИЦА.indexOf("<SetupBoardPreview");
    const надПревью = СТРАНИЦА.lastIndexOf("{полоскаСтарта(", превью);
    expect(надПревью, "вызов есть до превью").toBeGreaterThan(-1);
    expect(превью - надПревью, "вызов стоит прямо над превью").toBeLessThan(120);
    const задание = СТРАНИЦА.indexOf("Задание ВИДИМОЙ строкой над доской");
    const надДоской = СТРАНИЦА.lastIndexOf("{полоскаСтарта(bw)}", задание);
    expect(надДоской, "вызов есть над строкой задания").toBeGreaterThan(-1);
    expect(задание - надДоской).toBeLessThan(200);
  });

  it("🔴 закрытие и каждый вход помечают показ сделанным — иначе полоска вернётся", () => {
    const i = СТРАНИЦА.indexOf("<PoloskaStarta");
    const кусок = СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("/>", i));
    expect(кусок.split("markOnboardingDone()").length - 1, "onDaily, onIntent, onClose").toBeGreaterThanOrEqual(3);
    expect(кусок).toContain("onClose=");
    expect(кусок).toContain("onIntent=");
    expect(кусок).toContain("deystvieVyboraOnbordinga(");
  });

  it("условие первого показа не изменилось: по ссылке на задачу полоски нет", () => {
    expect(СТРАНИЦА).toContain("if(!поСсылке&&!hasCompletedOnboarding())sShowOnboarding(true);");
  });
});
