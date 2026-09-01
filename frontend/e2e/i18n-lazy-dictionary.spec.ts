import { test, expect } from "@playwright/test";

/**
 * The visitor's language has to actually arrive, now that it is fetched.
 *
 * Since 10.08.2026 a page compiles in English only and pulls the chosen
 * language as a chunk — that is what halved the blocking JavaScript on every
 * page (2485 -> 1254 KB on the home page). The risk it introduces is silent:
 * if the chunk never loads, nothing throws and no build fails, the interface
 * simply stays English for a person who asked for Kazakh.
 *
 * Kazakh is the test case because its alphabet is self-evident — ә, қ, ң, ұ, ү,
 * і and һ exist in no other language the platform offers, so their presence
 * cannot come from a fallback.
 */

const KK_ONLY = /[әқңұүіһөҒҚҢҰҮІҺӘӨ]/;

async function kazakhLetters(page: import("@playwright/test").Page) {
  const text = (await page.locator("body").innerText()) || "";
  return (text.match(new RegExp(KK_ONLY, "g")) || []).length;
}

test("a page fetches the visitor's dictionary and shows it", async ({ page }) => {
  test.setTimeout(120_000);

  // Counted against English rather than asserted outright: the language menu
  // spells Kazakh in Kazakh whatever language the page is in, so a plain "is
  // there a Kazakh letter" check would pass with the dictionary never loading.
  // Never wait for "networkidle" on these pages: when the translation service
  // is unreachable AutoTranslate keeps retrying, the network never goes quiet,
  // and the wait burns the whole timeout. That is exactly how this spec failed
  // inside the full suite while passing when run alone.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("aevion_lang_v1", "en"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  const inEnglish = await kazakhLetters(page);

  await page.evaluate(() => localStorage.setItem("aevion_lang_v1", "kk"));
  await page.reload({ waitUntil: "domcontentloaded" });

  // Not a fixed wait: the dictionary is a network chunk, so give the assertion
  // room to become true rather than guessing how long the fetch takes.
  await expect
    .poll(() => kazakhLetters(page), {
      timeout: 30_000,
      message: "the page stayed as Kazakh as it was in English — the chunk never arrived",
    })
    .toBeGreaterThan(inEnglish + 20);
});

test("English needs no fetch: it is already in the page", async ({ page }) => {
  // The first render must match the server's, which renders in English, so the
  // English dictionary has to be compiled in. If it ever became a chunk too,
  // every page would hydrate showing raw keys like "home.badge".
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("aevion_lang_v1", "en"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");

  const body = (await page.locator("body").innerText()) || "";
  expect(body.length, "the page rendered something").toBeGreaterThan(100);
  // A key that leaked through would look like a dotted identifier standing
  // alone as visible text.
  expect(body).not.toMatch(/(^|\s)(home|nav|footer)\.[a-z][\w.]+(\s|$)/);
});
