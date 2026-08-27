import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { I18nProvider, loadDict } from "@/lib/i18n";
import { AutoTranslate } from "../AutoTranslate";

// JSX like `smart call{n === 1 ? "" : "s"}` renders ONE phrase as two sibling
// text nodes. Translating each fragment alone produced hybrids like
// "3 умный вызовs" (seen live on /pricing) — the walker must join sibling
// text nodes and translate the whole phrase.
describe("AutoTranslate — fragmented text nodes", () => {
  // Since 10.08.2026 only English is compiled into a page and the rest arrive
  // as chunks, so the translating pass waits for the dictionary it seeds from.
  // Awaiting it here makes that wait explicit instead of a race against waitFor.
  beforeEach(async () => {
    await loadDict("ru");
    localStorage.clear();
    localStorage.setItem("aevion_lang_v1", "ru");
    // Pre-seed the persisted translation cache so no network round-trip is
    // needed for the phrase under test.
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "3 smart calls": "3 умных вызова" })
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [] }),
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("translates a phrase split across sibling text nodes as one unit", async () => {
    const n = 3;
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span data-testid="phrase">
              {`${n} smart call`}
              {n === 1 ? "" : "s"}
            </span>
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await waitFor(() => {
      const span = container.querySelector('[data-testid="phrase"]');
      expect(span?.textContent).toBe("3 умных вызова");
    });
  });

  it("still translates single text nodes exactly as before", async () => {
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "Open project": "Открыть проект" })
    );
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span data-testid="single">Open project</span>
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await waitFor(() => {
      expect(container.querySelector('[data-testid="single"]')?.textContent).toBe("Открыть проект");
    });
  });
});
