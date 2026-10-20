/**
 * Доска «что достроить» (MvpConceptBoard) спрашивает свои ручки один раз, а не на каждый рендер.
 *
 * ПОВОД (20.10.2026, осмотр /startup-exchange гостем на проде): concept/messages и
 * concept-stats запрашивались по 5 раз за загрузку. Страницы передают
 * hideAuthors={["ci"]} — новый массив на каждом рендере, refresh пересоздавался.
 * Компонент стоит на ~20 страницах.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useState } from "react";
import MvpConceptBoardModule from "../MvpConceptBoard";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

const MvpConceptBoard = (MvpConceptBoardModule as any).default ?? MvpConceptBoardModule;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("MvpConceptBoard: запросы", () => {
  it("пять перерисовок родителя с новым массивом hideAuthors — по одному запросу на ручку", async () => {
    const fetchMock = vi.fn(async (u: string) => ({
      ok: true,
      json: async () => (String(u).includes("concept-stats") ? { total: 1, last7d: 0, topTags: [] } : { items: [{ id: 1, payload: { author: "ci" } }, { id: 2, payload: { author: "человек" } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    let перерисовать!: () => void;
    function Родитель() {
      const [, setN] = useState(0);
      перерисовать = () => setN((n) => n + 1);
      return <MvpConceptBoard moduleId="startupx" noun="concept/messages" hideAuthors={["ci"]} fields={[{ key: "title", label: "Т" }]} titleField="title" />;
    }
    await act(async () => { render(<Родитель />); });
    for (let i = 0; i < 5; i++) await act(async () => { перерисовать(); });
    const список = fetchMock.mock.calls.filter((c) => String(c[0]).includes("concept/messages")).length;
    const статистика = fetchMock.mock.calls.filter((c) => String(c[0]).includes("concept-stats")).length;
    expect(список).toBe(1);
    expect(статистика).toBe(1);
  });
});
