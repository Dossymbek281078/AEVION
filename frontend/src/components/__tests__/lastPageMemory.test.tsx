/*
 * Последняя страница запоминается при каждой смене пути, кроме /auth.
 * Без этого вход не знает, куда вернуть: referrer при <Link> пустой (12.10.2026).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

let путь = "/z-tide";
vi.mock("next/navigation", () => ({ usePathname: () => путь }));

import LastPageMemory, { ПОСЛЕДНЯЯ_СТРАНИЦА } from "../LastPageMemory";

beforeEach(() => sessionStorage.clear());

describe("LastPageMemory", () => {
  it("страница модуля запоминается", () => {
    путь = "/z-tide";
    render(<LastPageMemory />);
    expect(sessionStorage.getItem(ПОСЛЕДНЯЯ_СТРАНИЦА)).toBe("/z-tide");
  });

  it("КОНТРОЛЬ: /auth не перезаписывает запомненную страницу", () => {
    sessionStorage.setItem(ПОСЛЕДНЯЯ_СТРАНИЦА, "/lifebox");
    путь = "/auth";
    render(<LastPageMemory />);
    expect(sessionStorage.getItem(ПОСЛЕДНЯЯ_СТРАНИЦА)).toBe("/lifebox");
  });
});
