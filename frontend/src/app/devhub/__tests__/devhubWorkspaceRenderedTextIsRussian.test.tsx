import { describe, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Suspense } from "react";
import {
  sobratVidimyj,
  angliyskieStroki,
  TERMINY_OBSHIE,
} from "@/test-utils/renderedText";

/**
 * Рабочее окно DevHub говорит по-русски — проверка по ОТРИСОВКЕ.
 *
 * Это экран, где платящий $149/мес проводит время. Исходниковый сторож
 * workspaceTextIsRussian знает четыре формы записи подписи и за три дня трижды
 * оказывался зелёным при живом английском — форм столько, сколькими способами
 * фреймворк умеет доставить строку в DOM.
 *
 * ГРАНИЦА: отрисовывается НАЧАЛЬНОЕ состояние с загруженным проектом. Панели,
 * которые открываются по нажатию, и сообщения об отказах сюда не попадают —
 * их держит исходниковый сторож.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/devhub/proba",
}));
vi.mock("@/lib/apiBase", () => ({
  apiUrl: (p: string) => p,
  fetchWithRedeployRetry: (...a: unknown[]) => (globalThis.fetch as never)(...(a as [])),
}));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
// Редактор кода тянет тяжёлый пакет и к языку интерфейса отношения не имеет.
vi.mock("@monaco-editor/react", () => ({ default: () => null }));

import DevHubProjectPage from "../[id]/page";

/** Имена сервисов и машинные значения, которые видны как есть. */
/**
 * Термины сверх общего списка. `Static` и `live` — МАШИННЫЕ значения из данных
 * проекта: имя стека и статус. Человек видит их как есть, и переводить нельзя —
 * они уходят обратно на сервер и сравниваются по строке.
 */
const TERMINY = [...TERMINY_OBSHIE, "DevHub", "Pages", "Deploy", "pages.dev", "Static", "live",
  "static", "express", "react", "Monaco", "Preview", "Studio"];

describe("рабочее окно DevHub говорит по-русски (по отрисовке)", () => {
  test("видимый текст и подписи — не английские", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      const s = String(u);
      if (s.includes("/files")) {
        return new Response(JSON.stringify({ files: [{ path: "index.html", content: "<h1>Проба</h1>" }] }), { status: 200 });
      }
      if (s.includes("/capabilities")) {
        return new Response(JSON.stringify({ capabilities: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ project: {
        id: "proba", name: "Проба", stack: "static", status: "live",
        deployUrl: null, files: [], envVars: {}, collaborators: [],
      } }), { status: 200 });
    }));

    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Suspense fallback={null}>
          <DevHubProjectPage params={Promise.resolve({ id: "proba" })} />
        </Suspense>,
      ).container;
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const v = sobratVidimyj(container);

    // Охват: страница отрисовалась и на ней есть РУССКИЙ текст. Без второго
    // контроля зелёный цвет означал бы «ничего не нашли», а не «всё хорошо».
    expect(v.tekst.length, "видимого текста нет — окно не отрисовалось").toBeGreaterThan(5);
    expect(
      v.vsyo.filter((s) => /[А-ЯЁа-яё]/.test(s)).length,
      "русского текста нет вовсе — проверка бессмысленна",
    ).toBeGreaterThan(3);

    expect(
      angliyskieStroki(v, TERMINY),
      "английский текст в рабочем окне: платящий проводит здесь время",
    ).toEqual([]);
  });
});
