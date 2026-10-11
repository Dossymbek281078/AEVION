import { describe, it, expect } from "vitest";
import { pickEntryFile, hasRenderableHtml } from "./devhubEntryFile";

type F = { path: string };
const f = (path: string): F => ({ path });

describe("pickEntryFile", () => {
  it("prefers root index.html over other files, whatever the order", () => {
    const files = [f("style.css"), f("script.js"), f("index.html")];
    expect(pickEntryFile(files)?.path).toBe("index.html");
  });

  it("prefers root index.html over a nested index.html", () => {
    const files = [f("pages/index.html"), f("index.html"), f("app.js")];
    expect(pickEntryFile(files)?.path).toBe("index.html");
  });

  it("falls back to a nested index.html when there is no root one", () => {
    const files = [f("style.css"), f("src/pages/index.html"), f("main.js")];
    expect(pickEntryFile(files)?.path).toBe("src/pages/index.html");
  });

  it("falls back to any .html when there is no index.html at all", () => {
    // .html is deliberately NOT first, so this distinguishes the html-fallback
    // from the plain first-file fallback (otherwise a broken html check passes).
    const files = [f("style.css"), f("script.js"), f("about.html")];
    expect(pickEntryFile(files)?.path).toBe("about.html");
  });

  it("falls back to the first file when there is no html (e.g. a bare script)", () => {
    const files = [f("main.py"), f("README.md")];
    expect(pickEntryFile(files)?.path).toBe("main.py");
  });

  it("returns null for empty / missing lists", () => {
    expect(pickEntryFile([])).toBeNull();
    expect(pickEntryFile(null)).toBeNull();
    expect(pickEntryFile(undefined)).toBeNull();
  });

  it("matches index.html case-insensitively", () => {
    const files = [f("App.js"), f("INDEX.HTML")];
    expect(pickEntryFile(files)?.path).toBe("INDEX.HTML");
  });
});

describe("hasRenderableHtml", () => {
  it("is true when any .html exists (so the live preview has something to render)", () => {
    expect(hasRenderableHtml([{ path: "index.html" }, { path: "style.css" }])).toBe(true);
    expect(hasRenderableHtml([{ path: "deep/page.HTML" }])).toBe(true);
  });

  it("is false with no html — the guest should get the editor, not an empty preview", () => {
    expect(hasRenderableHtml([{ path: "main.js" }, { path: "style.css" }])).toBe(false);
    expect(hasRenderableHtml([])).toBe(false);
    expect(hasRenderableHtml(null)).toBe(false);
  });
});
