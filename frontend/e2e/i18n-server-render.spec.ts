import { test, expect } from "@playwright/test";

/**
 * Pages that translate on the server must still do it.
 *
 * /awards, /build/help and their kind call getServerT() so a cold visit shows
 * the visitor's language immediately, without the English flash the client
 * provider would otherwise give. On 10.08.2026 the dictionaries moved out of
 * i18n-data.ts into one file per language, and i18n-server.ts began reading
 * them through the new i18n-all aggregate. If that import ever breaks —
 * renamed, tree-shaken, caught by the "use client" boundary that broke this
 * exact path once before — nothing throws: tServer() falls back to English key
 * by key and the page renders fine, in the wrong language.
 *
 * Checked against the HTML the server sends, not the hydrated page, because
 * that is the thing under test.
 */

const KK_ONLY = /[әқңұүіһөҒҚҢҰҮІҺӘӨ]/g;
const CYRILLIC = /[А-Яа-я]/g;
const PAGES = ["/awards", "/build/help"];

/** Server HTML with the inline scripts removed — they carry data, not copy. */
async function visibleServerHtml(
  request: import("@playwright/test").APIRequestContext,
  path: string,
  lang?: string,
) {
  const res = await request.get(path, {
    headers: lang ? { cookie: `aevion_lang_v1=${lang}` } : {},
  });
  expect(res.status(), `${path} responded`).toBe(200);
  return (await res.text()).replace(/<script[\s\S]*?<\/script>/g, "");
}

for (const path of PAGES) {
  test(`${path} renders Kazakh on the server when the visitor asked for it`, async ({ request }) => {
    const kk = await visibleServerHtml(request, path, "kk");
    // Kazakh-only letters exist in no other language offered here, so their
    // presence cannot come from an English or Russian fallback.
    expect(
      (kk.match(KK_ONLY) || []).length,
      "the server fell back to another language for a Kazakh visitor",
    ).toBeGreaterThan(50);
  });

  test(`${path} renders Russian on the server when the visitor asked for it`, async ({ request }) => {
    const ru = await visibleServerHtml(request, path, "ru");
    const en = await visibleServerHtml(request, path);
    // Measured against the same page in English rather than asserted outright:
    // a few Russian words sit in the JSX as literals whatever the language is.
    expect(
      (ru.match(CYRILLIC) || []).length,
      "the Russian render is no more Russian than the English one",
    ).toBeGreaterThan((en.match(CYRILLIC) || []).length + 200);
    expect((ru.match(KK_ONLY) || []).length, "and it is not Kazakh").toBe(0);
  });
}
