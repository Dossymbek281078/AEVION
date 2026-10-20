/**
 * «Скачать все мои записи» на /qright (20.10.2026, Продажи: «а если уйдём?»).
 *
 * Кнопка зовёт GET /api/pipeline/certificates/export.zip с Bearer и обязана
 * показать словами каждый исход: 200 — файл скачан (ссылка download с именем
 * из Content-Disposition), 404 no_records — «У вас пока нет записей», 401 —
 * предложение войти, сбой сети — текст, а не тишина. Без входа кнопки нет.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExportAllButton, exportFileName, type ExportAllLabels } from "../ExportAllButton";
import { QRIGHT_DICT, tq } from "../qrightI18n";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

const KEYS = {
  button: "Download all my records",
  busy: "Preparing archive…",
  hint: "One .zip with every certificate bundle — verifiable without AEVION.",
  empty: "You have no records yet",
  signIn: "Sign in to download your records",
  tooMany: "More than 500 records — too many for one archive. Contact support for a full export.",
  network: "Could not download the archive — check your connection and try again",
  failed: "Could not prepare the archive",
} satisfies ExportAllLabels;

const labels = (lang: string): ExportAllLabels =>
  Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, tq(lang, v)])) as ExportAllLabels;

const fetchMock = vi.fn();
beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const signIn = () => localStorage.setItem(AUTH_TOKEN_KEY, "tok-123");
const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("кнопка «Скачать все мои записи»", () => {
  test("без входа кнопки нет", () => {
    render(<ExportAllButton labels={labels("ru")} />);
    expect(screen.queryByTestId("qright-export-all")).toBeNull();
  });

  test("при входе кнопка есть, подпись русская", async () => {
    signIn();
    render(<ExportAllButton labels={labels("ru")} />);
    const b = await screen.findByTestId("qright-export-all");
    expect(b.textContent).toContain("Скачать все мои записи");
  });

  test("200: зовёт export.zip с Bearer и создаёт ссылку download с именем файла", async () => {
    signIn();
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);
    fetchMock.mockResolvedValue(
      new Response(zipBytes, {
        status: 200,
        headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="aevion-records-2026-10-20.zip"' },
      }),
    );
    const created = vi.fn(() => "blob:test-url");
    Object.defineProperty(URL, "createObjectURL", { value: created, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });
    const clicked: Array<{ href: string; download: string }> = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });

    render(<ExportAllButton labels={labels("en")} />);
    fireEvent.click(await screen.findByTestId("qright-export-all"));
    await waitFor(() => expect(clicked.length).toBe(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/pipeline\/certificates\/export\.zip$/);
    expect((init as RequestInit).headers).toEqual({ Authorization: "Bearer tok-123" });
    expect(created).toHaveBeenCalledTimes(1);
    expect(clicked[0]).toEqual({ href: "blob:test-url", download: "aevion-records-2026-10-20.zip" });
    expect(await screen.findByRole("status")).toHaveTextContent("aevion-records-2026-10-20.zip");
    clickSpy.mockRestore();
  });

  test("404 no_records: текст «У вас пока нет записей», ссылка не создаётся", async () => {
    signIn();
    fetchMock.mockResolvedValue(jsonRes(404, { error: "no_records", message: "This account has no protected records yet." }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
    render(<ExportAllButton labels={labels("ru")} />);
    fireEvent.click(await screen.findByTestId("qright-export-all"));
    expect(await screen.findByRole("alert")).toHaveTextContent("У вас пока нет записей");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  test("401: предложение войти со ссылкой на /auth", async () => {
    signIn();
    fetchMock.mockResolvedValue(jsonRes(401, { error: "auth_required" }));
    render(<ExportAllButton labels={labels("ru")} />);
    fireEvent.click(await screen.findByTestId("qright-export-all"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Войдите, чтобы скачать свои записи");
    expect(alert.querySelector('a[href="/auth"]')).not.toBeNull();
  });

  test("413: текст про предел 500", async () => {
    signIn();
    fetchMock.mockResolvedValue(jsonRes(413, { error: "too_many_records", limit: 500 }));
    render(<ExportAllButton labels={labels("en")} />);
    fireEvent.click(await screen.findByTestId("qright-export-all"));
    expect(await screen.findByRole("alert")).toHaveTextContent("More than 500 records");
  });

  test("сбой сети и неожиданный ответ — текст, а не тишина", async () => {
    signIn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ExportAllButton labels={labels("ru")} />);
    const b = await screen.findByTestId("qright-export-all");
    fireEvent.click(b);
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось скачать архив");
    fetchMock.mockResolvedValueOnce(jsonRes(500, { error: "x" }));
    await act(async () => { fireEvent.click(b); });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Не удалось подготовить архив (HTTP 500)"));
  });

  test("имя файла: из Content-Disposition, без него — по дате", () => {
    expect(exportFileName('attachment; filename="aevion-records-2026-10-20.zip"')).toBe("aevion-records-2026-10-20.zip");
    expect(exportFileName(null, new Date("2026-10-21T01:00:00Z"))).toBe("aevion-records-2026-10-21.zip");
  });

  test("словарь: ключи есть в ru и kk, переводы не равны источнику", () => {
    const ru = QRIGHT_DICT.ru ?? {};
    const kk = QRIGHT_DICT.kk ?? {};
    const keys = Object.values(KEYS);
    const ruOk = keys.filter((k) => ru[k] && ru[k] !== k && /[А-Яа-яЁё]/.test(ru[k]));
    const kkOk = keys.filter((k) => kk[k] && kk[k] !== k && /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІі]/.test(kk[k]));
    expect(ruOk.length, `ru: ${ruOk.length}/${keys.length}`).toBe(keys.length);
    expect(kkOk.length, `kk: ${kkOk.length}/${keys.length}`).toBe(keys.length);
    expect(tq("ru", KEYS.button)).toBe("Скачать все мои записи");
    expect(tq("kk", KEYS.button)).toBe("Барлық жазбаларымды жүктеу");
    expect(tq("en", KEYS.button)).toBe("Download all my records");
  });

  test("проводка в page.tsx: кнопка стоит на странице, все подписи через tq(lang, …)", () => {
    const page = readFileSync(join(process.cwd(), "src/app/qright/page.tsx"), "utf8");
    expect(page).toMatch(/<ExportAllButton\s+labels=\{\{/);
    expect(page).toContain('import { ExportAllButton } from "./ExportAllButton";');
    const missing = Object.values(KEYS).filter((k) => !page.includes(`tq(lang, "${k}")`));
    expect(missing, `не проведены ${missing.length} из ${Object.values(KEYS).length}`).toEqual([]);
  });
});
