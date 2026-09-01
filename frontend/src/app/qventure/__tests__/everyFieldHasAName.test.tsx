import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * У КАЖДОГО ПОЛЯ ЕСТЬ ИМЯ, КОТОРОЕ СЛЫШИТ ЧИТАЛКА.
 *
 * placeholder именем не является: он исчезает при вводе — то есть поле
 * становится безымянным ровно тогда, когда в нём работают. Экранный диктор
 * объявит такое поле одной ролью: «поле ввода», и человек не узнает, что
 * туда писать.
 *
 * Проверять ЭТО статическим свипом нельзя. Разметка
 * `<label>Текст <input/></label>` даёт имя неявно, и греп по атрибутам
 * насчитал бы сотни ложных: у нас на живой странице из 21 поля свип назвал
 * 11 безымянными, а на самом деле их меньше. Авторитетен только рендер:
 * `element.labels` в jsdom учитывает и обёртку, и связь по id.
 *
 * ГРАНИЦА. Проверяется главный экран — там живут все поля ввода модуля.
 * Скрытое поле выбора файла исключено намеренно: оно не видно и нажимается
 * кнопкой, у которой своя подпись; требовать имя у него значило бы красить
 * исправное. Остальные экраны модуля (список наблюдения, галерея, разбор)
 * полей ввода не имеют — если появятся, проверку надо расширить, иначе её
 * зелёный цвет будет означать меньше, чем читается.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/qventure",
}));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));

import QVenturePage from "../page";

type Pole = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function imya(el: Pole): string {
  const aria = el.getAttribute("aria-label");
  if (aria && aria.trim()) return aria.trim();
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const t = by
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (t) return t;
  }
  // labels видит и связь по id, и обёртку <label><input/></label>.
  const lab = (el as HTMLInputElement).labels;
  if (lab && lab.length) {
    const t = Array.from(lab).map((l) => l.textContent ?? "").join(" ").trim();
    if (t) return t;
  }
  return "";
}

describe("поля QVenture", () => {
  test("у каждого поля есть доступное имя", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const { container } = render(<QVenturePage />);

    const polya = Array.from(
      container.querySelectorAll<Pole>("input, textarea, select"),
    ).filter((el) => el.type !== "hidden" && el.type !== "file");

    // Контроль: поля вообще нашлись. Пустая выборка дала бы «безымянных нет»
    // на любом состоянии страницы — тот самый ложный ноль.
    expect(polya.length, "полей на странице не найдено — проверка обнулилась").toBeGreaterThan(8);

    const bez = polya.map((el) => (imya(el) ? null : el.getAttribute("placeholder") || el.tagName.toLowerCase()))
      .filter(Boolean);

    expect(
      bez,
      "поле без имени: читалка объявит его одной ролью, и человек не узнает, что туда писать",
    ).toEqual([]);
  });
});
