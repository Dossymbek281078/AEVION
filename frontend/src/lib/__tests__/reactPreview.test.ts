import { describe, it, expect } from "vitest";
import { findReactEntry, resolveLocalImport, rewriteLocalImports, buildReactPreviewSrcdoc } from "../reactPreview";

const f = (path: string, content = "") => ({ path, content });

describe("reactPreview — entry detection and import resolution", () => {
  it("prefers main.jsx over App.jsx (self-mounting entries win)", () => {
    expect(findReactEntry([f("src/App.jsx"), f("src/main.jsx")])).toBe("src/main.jsx");
    expect(findReactEntry([f("App.tsx")])).toBe("App.tsx");
    expect(findReactEntry([f("styles.css")])).toBeNull();
  });

  it("resolves relative imports with extension and index fallbacks", () => {
    const files = [f("src/App.jsx"), f("src/lib/util.js"), f("src/components/Button/index.tsx")];
    expect(resolveLocalImport("src/App.jsx", "./lib/util", files)).toBe("src/lib/util.js");
    expect(resolveLocalImport("src/App.jsx", "./components/Button", files)).toBe("src/components/Button/index.tsx");
    expect(resolveLocalImport("src/lib/util.js", "../App", files)).toBe("src/App.jsx");
    expect(resolveLocalImport("src/App.jsx", "./missing", files)).toBeNull();
  });

  it("rewrites resolvable local imports to bare specifiers and drops css imports", () => {
    const files = [f("src/App.jsx"), f("src/Button.jsx"), f("src/app.css")];
    const code = 'import Button from "./Button";\nimport "./app.css";\nimport x from "./nope";';
    const out = rewriteLocalImports(code, "src/App.jsx", files);
    expect(out).toContain('from "local/src/Button.jsx"');
    expect(out).toContain('import "data:text/javascript,"'); // css → no-op module
    expect(out).toContain('from "./nope"'); // unknown stays — surfaces honestly in the iframe
  });
});

describe("reactPreview — srcdoc build (real babel transform)", () => {
  it("builds an import-mapped srcdoc that mounts an App-style entry", async () => {
    const files = [
      f("src/App.jsx", "export default function App() { return <h1>Hi</h1>; }"),
      f("src/app.css", "h1 { color: teal; }"),
    ];
    const r = await buildReactPreviewSrcdoc(files, "/*overlay*/");
    if ("error" in r) throw new Error(r.error);
    expect(r.srcdoc).toContain('"local/src/App.jsx":"data:text/javascript;base64,');
    expect(r.srcdoc).toContain("esm.sh/react@");
    expect(r.srcdoc).toContain("createRoot(document.getElementById(\"root\"))");
    expect(r.srcdoc).toContain("h1 { color: teal; }");
    expect(r.srcdoc).toContain("/*overlay*/");
  }, 30_000);

  it("reports a broken file as an error instead of a blank preview", async () => {
    const r = await buildReactPreviewSrcdoc([f("App.jsx", "export default function ( { return <h1>; }")], "");
    expect("error" in r && r.error).toMatch(/Babel could not transform App.jsx/);
  }, 30_000);
});
