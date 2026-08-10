import { test, expect } from "@playwright/test";

/**
 * Invented text must never reach a visitor.
 *
 * The guard was written after production seemed to answer "Сохранить изменения"
 * with "Quantencomputer-Sicherheit". It did not: my own terminal was mangling
 * Cyrillic on the way out, and the model was answering nonsense with fluent
 * nonsense. Correctly encoded, the service returns "Änderungen speichern".
 *
 * The guard stays because the failure it models is real in kind — a translator
 * answering beside the point yields text a visitor cannot tell is wrong, which
 * is worse than leaving the source language alone. Both directions are checked
 * here: invented text never lands on the page, and an honest service still gets
 * to translate.
 */
test("a translation service that invents text is not trusted", async ({ page }) => {
  test.setTimeout(180_000);
  const requests: string[][] = [];
  await page.route("**/api/i18n/translate", async (route) => {
    const body = route.request().postDataJSON() as { texts: string[] };
    requests.push(body.texts);
    // Answer everything with plausible German that has nothing to do with the
    // input — exactly what production was doing.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ translations: body.texts.map(() => "Quantencomputer-Sicherheit") }),
    });
  });

  await page.goto("/devhub", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /(EN|RU|KK|DE)/ }).first().click();
  await page.getByRole("option", { name: /Deutsch/ }).click();
  await page.waitForTimeout(6000);

  const body = await page.locator("body").innerText();
  expect(body, "invented text must not be pasted onto the page")
    .not.toContain("Quantencomputer-Sicherheit");

  expect(requests.length, "the client asked at least once").toBeGreaterThan(0);
  expect(requests[0][0], "and the first batch carried the canary").toBe("AEVION 2026 · 12345");

  // Asserted as "it stopped", not as "it asked fewer than three times". The
  // verdict on the canary arrives while batches are already in flight, so the
  // exact count depends on how busy the machine is — it was 2 on a quiet run
  // and 3 inside the full suite, which failed a threshold without anything
  // being wrong. What matters is that nothing more is sent afterwards.
  const afterVerdict = requests.length;
  await page.waitForTimeout(4000);
  expect(requests.length, "it kept asking after the canary came back wrong").toBe(afterVerdict);
});

test("a translation service that behaves is still used", async ({ page }) => {
  // The guard must not cost honest translation: echo the canary, translate the
  // rest, and the German has to land on the page as before.
  test.setTimeout(180_000);
  await page.route("**/api/i18n/translate", async (route) => {
    const body = route.request().postDataJSON() as { texts: string[] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translations: body.texts.map((t) =>
          t === "AEVION 2026 · 12345" ? t : `DE:${t.slice(0, 24)}`,
        ),
      }),
    });
  });

  await page.goto("/devhub", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /(EN|RU|KK|DE)/ }).first().click();
  await page.getByRole("option", { name: /Deutsch/ }).click();
  await page.waitForTimeout(6000);

  const body = await page.locator("body").innerText();
  expect(body, "an honest service still gets to translate the page").toContain("DE:");
});

