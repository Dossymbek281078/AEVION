import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VenturesInterestProvider } from "../VenturesInterest";
import TopIdeas from "../TopIdeas";
import IdeaMarket from "../IdeaMarket";

/*
 * 🔴 152 (18.10.2026). На /ventures единственное бесплатное действие гостя — «👍 интересно» — стояло на ~1831 px
 * (прибор первого экрана 18.10, прод 638a7b5: ventures в шести приложениях без действия на 390×844).
 * Теперь три первых замысла с той же кнопкой стоят в шапке страницы, состояние голосов общее для шапки и таблицы.
 * Здесь — ПОВЕДЕНИЕ (что видит и нажимает человек) и место блока в разметке; пиксели на проде меряет браузер
 * (scratchpad/152-priemka-ventures.cjs). Нажатие на проде сознательно не проверяется: голос несъёмный.
 */

const страница = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

function мокРучки(стартовые: Record<string, number>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (!init || init.method !== "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ ideas: Object.entries(стартовые).map(([id, interest]) => ({ id, interest })) }),
      } as unknown as Response);
    }
    const id = /ideas\/(\w+)\/interest/.exec(url)?.[1] ?? "";
    return Promise.resolve({
      ok: true,
      status: 201,
      json: async () => ({ ok: true, ideaId: id, alreadyVoted: false, interest: (стартовые[id] ?? 0) + 1 }),
    } as unknown as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("152: три замысла с «👍 интересно» — первый экран гостя /ventures", () => {
  it("🔴 блок стоит внутри <header> страницы, страница обёрнута провайдером общего состояния", () => {
    const провайдер = страница.indexOf("<VenturesInterestProvider>");
    const шапка = страница.indexOf('<header className="vtx-top">');
    const блок = страница.indexOf("<TopIdeas />");
    const конецШапки = страница.indexOf("</header>");
    expect(провайдер).toBeGreaterThan(0);
    expect(шапка).toBeGreaterThan(провайдер);
    expect(блок).toBeGreaterThan(шапка);
    expect(конецШапки).toBeGreaterThan(блок);
    expect(страница.split("<TopIdeas />").length - 1).toBe(1);
  });

  it("🔴 гость видит ровно 3 кнопки с живыми счётчиками; без входа нажатие шлёт POST с voterId и кнопка становится «✓ N+1»", async () => {
    const calls = мокРучки({ "01": 5, "02": 2, "03": 0, "04": 9 });
    render(<VenturesInterestProvider><TopIdeas /></VenturesInterestProvider>);
    const блок = screen.getByText(/один голос на замысел/).closest("[data-ventures-top3]") as HTMLElement;
    const кнопки = within(блок).getAllByRole("button");
    expect(кнопки).toHaveLength(3);
    await waitFor(() => expect(кнопки[0].textContent).toBe("👍 5"));
    expect(кнопки[1].textContent).toBe("👍 2");
    expect(кнопки[2].textContent).toBe("👍 0");

    fireEvent.click(кнопки[0]);
    await waitFor(() => expect(кнопки[0].textContent).toBe("✓ 6"));
    expect(кнопки[0]).toBeDisabled();
    const post = calls.find((c) => c.init?.method === "POST");
    expect(post?.url).toBe("/api-backend/api/ventures/ideas/01/interest");
    const тело = JSON.parse(String(post?.init?.body));
    expect(тело.kind).toBe("build");
    expect(typeof тело.voterId).toBe("string");
    expect(тело.voterId.length).toBeGreaterThan(8);
    expect(Object.keys(post?.init?.headers ?? {}).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("🔴 в блоке шапки нет обещаний: ни «$», ни потолка, ни «LIVE»", async () => {
    мокРучки({});
    render(<VenturesInterestProvider><TopIdeas /></VenturesInterestProvider>);
    const блок = screen.getByText(/один голос на замысел/).closest("[data-ventures-top3]") as HTMLElement;
    const текст = блок.textContent ?? "";
    expect(текст).not.toMatch(/\$|LIVE|ceiling|потолок|запущен/i);
  });

  it("🔴 голос в шапке сразу виден в таблице: одно состояние на обе поверхности", async () => {
    мокРучки({ "01": 1, "02": 0, "03": 0 });
    render(
      <VenturesInterestProvider>
        <TopIdeas />
        <IdeaMarket />
      </VenturesInterestProvider>,
    );
    const всеКнопки01 = await screen.findAllByRole("button", { name: /Отметить интерес: AEVIA/ });
    expect(всеКнопки01).toHaveLength(2); // шапка + таблица
    await waitFor(() => expect(всеКнопки01[0].textContent).toBe("👍 1"));
    fireEvent.click(всеКнопки01[0]);
    await waitFor(() => expect(всеКнопки01[1].textContent).toBe("✓ 2"));
    expect(всеКнопки01[1]).toBeDisabled();
  });
});
