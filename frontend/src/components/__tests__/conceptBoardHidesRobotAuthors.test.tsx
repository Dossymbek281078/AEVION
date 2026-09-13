import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MvpConceptBoard from "../MvpConceptBoard";

/**
 * Доска предложений не показывает записи нашего робота сборки.
 *
 * 🔴 ЗАЧЕМ. Замер 09.09.2026 на живом проде: в доске биржи стартапов лежали
 * ровно ТРИ записи, и все три сделаны автором `ci` — «smoke 20260519T064745Z»
 * с обоснованием «auto-smoke», возрастом 112–113 дней. Блок называется
 * «Последние», то есть обещает свежесть, а показывал наши автопробы с мая.
 * Посетитель читает это как «здесь ничего не происходит четыре месяца» —
 * и это первое, что он видит на витрине модуля, выходящего 20 сентября.
 *
 * ГРАНИЦА. Скрытие включается ТОЛЬКО параметром `hideAuthors`. Компонент общий,
 * его используют 17 страниц, и прятать чужие записи по умолчанию нельзя: так
 * однажды исчезнет настоящая. Поэтому второй тест здесь важнее первого — он
 * проверяет, что БЕЗ параметра не скрывается ничего.
 */

const записи = [
  { id: "1", payload: { idea: "smoke 20260519T064745Z", rationale: "auto-smoke", author: "ci" }, tags: ["startupx"], createdAt: "2026-05-19T06:47:45Z" },
  { id: "2", payload: { idea: "Живое предложение человека", rationale: "польза", author: "человек" }, tags: ["startupx"], createdAt: "2026-09-09T08:00:00Z" },
  { id: "3", payload: { idea: "Без автора вовсе" }, tags: ["startupx"], createdAt: "2026-09-09T09:00:00Z" },
];

function подменитьСеть() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("concept-stats")) {
      return { ok: true, json: async () => ({ total: 3, last7d: 2, topTags: [] }) };
    }
    return { ok: true, json: async () => ({ items: записи }) };
  }) as unknown as typeof fetch);
}

const поля = [{ key: "idea", label: "Идея" }];

describe("доска предложений: записи робота", () => {
  beforeEach(() => { подменитьСеть(); });

  test("с hideAuthors=[ci] запись робота не показывается, живые остаются", async () => {
    render(
      <MvpConceptBoard moduleId="startupx" noun="concept/messages" fields={поля}
        titleField="idea" summaryField="rationale" sectionTitle="Предложения"
        hideAuthors={["ci"]} />,
    );
    await waitFor(() => expect(screen.getByText("Живое предложение человека")).toBeTruthy());
    expect(screen.queryByText("smoke 20260519T064745Z")).toBeNull();
    // запись БЕЗ поля author скрывать нельзя — она не робот
    expect(screen.getByText("Без автора вовсе")).toBeTruthy();
  });

  test("БЕЗ параметра не скрывается ничего — 17 других страниц не затронуты", async () => {
    render(
      <MvpConceptBoard moduleId="deepsan" noun="concept/messages" fields={поля}
        titleField="idea" summaryField="rationale" sectionTitle="Предложения" />,
    );
    await waitFor(() => expect(screen.getByText("Живое предложение человека")).toBeTruthy());
    expect(screen.getByText("smoke 20260519T064745Z")).toBeTruthy();
  });
});
