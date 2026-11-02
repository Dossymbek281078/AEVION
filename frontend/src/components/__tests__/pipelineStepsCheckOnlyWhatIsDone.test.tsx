import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

/**
 * 2.11.2026: степпер рисовал «✓» у каждого шага слева от текущего, даже гостю.
 * Теперь ✓ — только у реально пройденного этим посетителем: auth (вошёл), qright (вошёл и есть объект).
 */
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const fetchMock = vi.fn();
async function показать(current: string) {
  vi.resetModules(); // кэш запроса — на загрузку страницы
  const { PipelineSteps } = await import("../PipelineSteps");
  return render(<PipelineSteps current={current} />);
}
const ответ = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("PipelineSteps: ✓ только у сделанного", () => {
  it("гость на qsign: ни одного ✓, запросов нет", async () => {
    await показать("qsign");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryAllByText("✓")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("вошёл, объектов нет: ✓ только у auth", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok");
    fetchMock.mockResolvedValue(ответ(200, { items: [] }));
    const { container } = await показать("qsign");
    await waitFor(() => expect(screen.getAllByText("✓")).toHaveLength(1));
    const первый = container.querySelectorAll("a")[0];
    expect(первый.textContent).toContain("✓");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("вошёл, есть объект: ✓ у auth и qright", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok");
    fetchMock.mockResolvedValue(ответ(200, { items: [{ id: "x" }] }));
    const { container } = await показать("qsign");
    await waitFor(() => expect(screen.getAllByText("✓")).toHaveLength(2));
    const a = container.querySelectorAll("a");
    expect(a[0].textContent).toContain("✓");
    expect(a[1].textContent).toContain("✓");
    expect(a[2].textContent).not.toContain("✓");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/qright/objects?mine=1");
  });

  it("запрос упал: auth ✓, qright без ✓, без ошибки на экране, с console.warn", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok");
    fetchMock.mockRejectedValue(new Error("net"));
    const { container } = await показать("qsign");
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText("✓")).toHaveLength(1));
    expect(container.querySelectorAll("a")[1].textContent).not.toContain("✓");
  });

  it("токен протух (401): ни одного ✓", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "old");
    fetchMock.mockResolvedValue(ответ(401, {}));
    await показать("qsign");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryAllByText("✓")).toHaveLength(0);
  });
});
