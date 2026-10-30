// «Показать на примере» на /en — английский вопрос и три английских ответа, а не русский исходник.
// Замер 30.10.2026 (прод 4f71ad70f, /en, ?c=probe-multichat): гость нажимал «Show an example» и читал
// по-русски все три ответа и вопрос. Ответы заданы заранее, карту разногласий по ним считает сервер —
// прогон английских ответов через прод-эндпоинт /dissent/preview 30.10 дал 40↔300 и отрицание по «launch».
// КОНТРОЛЬ: на 828da943d оба случая с рендером красные (в теле preview — русские ответы).
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getAuthHeaders: () => ({}) }));
const язык = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: язык.lang, t: (k: string) => k }),
}));

import { CouncilConsole, примерДляЯзыка } from "../CouncilConsole";

const кириллица = /[А-Яа-яЁё]/;

afterEach(() => vi.unstubAllGlobals());

async function нажатьПример(подпись: RegExp) {
  const вызовы: { url: string; body: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    вызовы.push({ url, body: String(init?.body ?? "") });
    if (url.includes("multichat-guest/allowance")) return { ok: true, json: async () => ({ лимит: 2, использовано: 0, осталось: 2 }) } as Response;
    return { ok: true, status: 200, json: async () => ({ dissent: { note: "", checks: [], numericConflicts: [], contradictions: [], hedges: [], outlier: null } }) } as Response;
  }));
  render(<CouncilConsole />);
  fireEvent.click(await screen.findByRole("button", { name: подпись }));
  await waitFor(() => expect(вызовы.some((в) => в.url.includes("/dissent/preview"))).toBe(true));
  const preview = JSON.parse(вызовы.find((в) => в.url.includes("/dissent/preview"))!.body) as { answers: Array<{ reply: string; provider: string }>; lang: string };
  const поле = document.querySelector("textarea") as HTMLTextAreaElement;
  return { preview, вопрос: поле.value };
}

describe("пример на языке страницы", () => {
  test("/en: в preview уходят английские ответы, в поле — английский вопрос, кириллицы нет", async () => {
    язык.lang = "en";
    const { preview, вопрос } = await нажатьПример(/Show an example/i);
    expect(preview.lang).toBe("en");
    expect(preview.answers).toHaveLength(3);
    for (const a of preview.answers) {
      expect(a.reply, "русский ответ примера на /en").not.toMatch(кириллица);
      expect(a.provider).not.toMatch(кириллица);
    }
    expect(вопрос).toBe("Should we launch a paid tier before the first sale?");
    // Развилка та же, что в русском примере: 40 и 300 визитов, «launch / do not launch».
    expect(preview.answers.map((a) => a.reply).join(" ")).toMatch(/\b40\b/);
    expect(preview.answers.map((a) => a.reply).join(" ")).toMatch(/\b300\b/);
    expect(preview.answers.some((a) => /Do not launch/.test(a.reply))).toBe(true);
  });

  test("ru: прежний русский пример без изменений — канон не сдвинулся", async () => {
    язык.lang = "ru";
    const { preview, вопрос } = await нажатьПример(/Показать на примере/i);
    expect(вопрос).toBe("Стоит ли запускать платный тариф до первой продажи?");
    expect(preview.answers.every((a) => кириллица.test(a.reply))).toBe(true);
  });

  test("примерДляЯзыка: en — английский, ru/kk/пусто — русский исходник; agentId и порядок совпадают", () => {
    const ru = примерДляЯзыка("ru"), en = примерДляЯзыка("en");
    expect(примерДляЯзыка("kk")).toEqual(ru);
    expect(примерДляЯзыка("")).toEqual(ru);
    expect(en.answers.map((a) => a.agentId)).toEqual(ru.answers.map((a) => a.agentId));
    expect(en.prompt).not.toMatch(кириллица);
  });
});
