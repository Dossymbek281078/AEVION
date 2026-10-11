import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LongevityTool } from "../_tool";

/**
 * Money: 06–07.10 /longevity drew live YouTube visitors, 0 tried. Mirror of the RU
 * /longevity fix on the EN half (parity: a fix to one language half must name the other).
 * Two things guarded:
 *  1) first screen had no one-tap action — the tool demanded entering 11 labs before any
 *     result. Added «Show an example»: fills the field placeholders and computes at once.
 *     Denominator: ALL 11 fields get filled, not some.
 *  2) the fixed InstallPrompt pill (bottom-right) covered the lower form on a phone — the
 *     page container reserves room via --aevion-install-h.
 */
describe("en /longevity: one tap + install-bar reserve", () => {
  it("«Show an example» is in the first screen before any typing", () => {
    render(<LongevityTool />);
    expect(screen.getByRole("button", { name: /show an example/i })).toBeTruthy();
  });

  it("clicking the example fills ALL 11 fields and computes (denominator 11)", async () => {
    const user = userEvent.setup();
    render(<LongevityTool />);
    await user.click(screen.getByRole("button", { name: /show an example/i }));
    // Both result branches name the denominator: "All 11 values you entered…" or
    // "N of 11 values you entered…". Either proves all 11 placeholders were filled.
    expect(screen.getByText(/11 values you entered/i)).toBeTruthy();
  });

  it("the page container reserves bottom room under the install pill", () => {
    const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const m = page.match(/page:\s*\{[^}]*\}/);
    expect(m, "styles.page not found").toBeTruthy();
    // Without this reserve (revert paddingBottom) the pill covers the submit button on a phone.
    expect(m![0]).toContain("--aevion-install-h");
  });
});

/**
 * Wave 30: the example action must be reachable in the FIRST screen. The in-tool
 * button sat far below the fold (measured 07.10). The page header now links to the
 * tool with href="#try-example"; arriving with that hash autofills the tool (one tap).
 */
describe("en /longevity: first-screen example CTA (wave 30)", () => {
  afterEach(() => { try { window.location.hash = ""; } catch {} });

  it("arriving with #try-example autofills the tool (all 11 computed)", async () => {
    window.location.hash = "#try-example";
    render(<LongevityTool />);
    // All 11 placeholders filled on the hash → the denominator names 11.
    expect(await screen.findByText(/11 values you entered/i)).toBeTruthy();
  });

  it("header anchors to the tool in the first screen; tool has the scroll target", () => {
    const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const tool = readFileSync(join(__dirname, "..", "_tool.tsx"), "utf8");
    const anchor = page.indexOf('href="#try-example"');
    const firstSection = page.indexOf("<section");
    expect(anchor, "no #try-example anchor in header").toBeGreaterThan(-1);
    // The CTA sits in the header, above the first <section> — i.e. the first screen.
    expect(anchor).toBeLessThan(firstSection);
    // The scroll target / autofill trigger exists in the tool.
    expect(tool).toContain('id="try-example"');
  });
});
