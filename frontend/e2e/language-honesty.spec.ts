import { test, expect } from "@playwright/test";

/**
 * The switcher used to offer eleven languages as equals. Measured 28.07.2026:
 * three carry the interface (ru/en/kk, ~7220 keys each) and the other eight
 * hold 94 — about 1%. Someone picking German got German menus and Russian
 * everything else, and nothing on screen said so beforehand.
 *
 * Checked on prod the same day: switching to German does produce German — the
 * gap is filled by machine translation at runtime. So the label says "машинный"
 * rather than "not translated", and the exact share sits in the tooltip. The
 * grouping is computed from the dictionary, so a language that gets translated
 * for real moves into the complete group on its own.
 */
test("the language switcher says which languages are only started", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/", { waitUntil: "networkidle" });

  const trigger = page.getByRole("button", { name: /(EN|RU|KK|ҚАЗ)/ }).first();
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();

  const list = page.getByRole("listbox");
  await expect(list).toBeVisible({ timeout: 15_000 });
  const text = await list.innerText();

  // The three real languages come first and carry no disclaimer.
  const firstThree = text.split("\n").filter((l) => /Русский|English|Қазақша/.test(l));
  expect(firstThree.length, "the complete languages are listed").toBe(3);
  expect(text.indexOf("Deutsch"), "complete languages come before partial ones")
    .toBeGreaterThan(text.indexOf("Қазақша"));

  // Every partial language states its share rather than implying parity.
  for (const name of ["Deutsch", "Français", "Español"]) {
    const at = text.indexOf(name);
    expect(at, `${name} is offered`).toBeGreaterThan(-1);
    expect(text.slice(at, at + 60), `${name} is marked as machine-translated`).toContain("машинный");
  }

  expect(text, "and the summary counts them honestly").toContain("3 из 11 переведены полностью");
  expect(text, "while saying what the others actually are").toContain("машинный перевод");
});
