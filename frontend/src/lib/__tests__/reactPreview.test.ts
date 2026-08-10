import { describe, it, expect } from "vitest";
import {
  findReactEntry,
  resolveLocalImport,
  rewriteLocalImports,
  buildReactPreviewSrcdoc,
  stubNextFontImports,
} from "../reactPreview";

const f = (path: string, content = "") => ({ path, content });

describe("reactPreview — entry detection and import resolution", () => {
  it("prefers main.jsx over App.jsx (self-mounting entries win)", () => {
    expect(findReactEntry([f("src/App.jsx"), f("src/main.jsx")])).toBe("src/main.jsx");
    expect(findReactEntry([f("App.tsx")])).toBe("App.tsx");
    expect(findReactEntry([f("styles.css")])).toBeNull();
  });

  it("accepts CRA-style .js entries — the shape the 2026-07-25 nightly actually produced", () => {
    const cra = [
      f("package.json"),
      f("public/index.html"),
      f("README.md"),
      f("src/App.js", "export default function App() { return <h1/>; }"),
      f("src/components/Settings.js", "export default function Settings() { return <div/>; }"),
      f("src/components/Timer.js", "export default function Timer() { return <div/>; }"),
      f("src/index.js", "import { createRoot } from 'react-dom/client';"),
      f("src/styles.css"),
    ];
    expect(findReactEntry(cra)).toBe("src/index.js"); // the mounting file, not App.js
    expect(findReactEntry([f("src/App.js"), f("src/util.js")])).toBe("src/App.js");
    // .jsx still outranks .js when both exist.
    expect(findReactEntry([f("src/App.js"), f("src/App.jsx")])).toBe("src/App.jsx");
  });

  it("never roots the preview at a component when no conventional entry exists", () => {
    const odd = [
      f("src/components/Settings.js", "export default function Settings() { return <div/>; }"),
      f("src/root.js", "createRoot(document.getElementById('root'))"),
    ];
    expect(findReactEntry(odd)).toBe("src/root.js"); // mounting code wins over file order
    // No mounting code anywhere: the shallowest path, deterministically.
    expect(
      findReactEntry([f("src/components/deep/Widget.js"), f("src/Shell.js")])
    ).toBe("src/Shell.js");
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

  it("transforms a .tsx entry under Babel 8 (isTSX/allExtensions were removed)", async () => {
    const files = [f("src/App.tsx", "type P = { n: number };\nexport default function App({ n = 1 }: P) { return <b>{n}</b>; }")];
    const r = await buildReactPreviewSrcdoc(files, "");
    if ("error" in r) throw new Error(r.error);
    expect(r.srcdoc).toContain('"local/src/App.tsx":"data:text/javascript;base64,');
  }, 30_000);

  it("renders a CRA-style .js project (JSX inside .js transforms fine)", async () => {
    const files = [
      f("src/index.js", "import { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.getElementById('root')).render(<App/>);"),
      f("src/App.js", "export default function App() { return <h1>Pomodoro</h1>; }"),
      f("src/styles.css", "h1 { color: crimson; }"),
    ];
    const r = await buildReactPreviewSrcdoc(files, "");
    if ("error" in r) throw new Error(r.error);
    expect(r.srcdoc).toContain('"local/src/index.js":"data:text/javascript;base64,');
    expect(r.srcdoc).toContain('"local/src/App.js":"data:text/javascript;base64,');
    // Self-mounting entry: we import it, we do not wrap it in our own createRoot.
    expect(r.srcdoc).toContain('import "local/src/index.js";');
    expect(r.srcdoc).toContain("h1 { color: crimson; }");
  }, 30_000);

  it("reports a broken file as an error instead of a blank preview", async () => {
    const r = await buildReactPreviewSrcdoc([f("App.jsx", "export default function ( { return <h1>; }")], "");
    expect("error" in r && r.error).toMatch(/Babel could not transform App.jsx/);
  }, 30_000);
});

describe("reactPreview — Next.js projects (previously previewable only after a deploy)", () => {
  const f = (path: string, content = "") => ({ path, content });

  it("prefers the route entry over src/ files", () => {
    expect(findReactEntry([f("src/App.jsx"), f("app/page.tsx")])).toBe("app/page.tsx");
    expect(findReactEntry([f("src/app/page.jsx"), f("src/lib/util.ts")])).toBe("src/app/page.jsx");
    expect(findReactEntry([f("pages/index.tsx")])).toBe("pages/index.tsx");
  });

  it("renders a client page that imports next/link and next/image", async () => {
    const files = [
      f(
        "app/page.tsx",
        `"use client";
import Link from "next/link";
import Image from "next/image";
export default function Home() {
  return <main><Image src="/logo.png" alt="logo" width={40} height={40} /><Link href="/about">About</Link></main>;
}`
      ),
    ];
    const r = await buildReactPreviewSrcdoc(files, "");
    if ("error" in r) throw new Error(r.error);
    // The shims are mapped, so nothing tries to resolve the real next package.
    expect(r.srcdoc).toContain('"next/link":"data:text/javascript;base64,');
    expect(r.srcdoc).toContain('"next/image":"data:text/javascript;base64,');
    expect(r.srcdoc).toContain('"local/app/page.tsx":"data:text/javascript;base64,');
    expect(r.srcdoc).toContain("createRoot(document.getElementById(\"root\"))");
  }, 30_000);

  it("says so plainly when the page is an async Server Component", async () => {
    const files = [
      f("app/page.tsx", "export default async function Home() { const d = await fetch('/api'); return <p>{d}</p>; }"),
    ];
    const r = await buildReactPreviewSrcdoc(files, "");
    expect("error" in r && r.error).toMatch(/async Server Component/);
    expect("error" in r && r.error).toMatch(/Deploy the project/);
  }, 30_000);

  it("gives CSS Modules a value so styles.title does not throw", async () => {
    const files = [
      f("app/page.jsx", 'import s from "./page.module.css";\nexport default function P(){ return <h1 className={s.title}>x</h1>; }'),
      f("app/page.module.css", ".title { color: rebeccapurple; }"),
    ];
    const r = await buildReactPreviewSrcdoc(files, "");
    if ("error" in r) throw new Error(r.error);
    expect(r.srcdoc).toContain('"devhub/css-module":"data:text/javascript;base64,');
    expect(r.srcdoc).toContain("rebeccapurple"); // still injected as a real <style>
  }, 30_000);

  it("rewrites a CSS Module import to the shim, plain CSS to a no-op", () => {
    const files = [f("app/page.jsx"), f("app/page.module.css"), f("app/global.css")];
    const out = rewriteLocalImports(
      'import s from "./page.module.css";\nimport "./global.css";',
      "app/page.jsx",
      files
    );
    expect(out).toContain('from "devhub/css-module"');
    expect(out).toContain('import "data:text/javascript,"');
  });

  it("stubs next/font imports, which no fixed shim module could satisfy", () => {
    const out = stubNextFontImports(
      'import { Inter, Roboto_Mono as Mono } from "next/font/google";\nconst x = Inter();'
    );
    expect(out).toContain("const Inter = () => ({ className:");
    expect(out).toContain("const Mono = () =>");
    expect(out).not.toContain("next/font");
  });
});

describe("isClientPreviewStack", () => {
  it("covers the stacks whose sources can render without a deploy", async () => {
    const { isClientPreviewStack } = await import("../reactPreview");
    expect(isClientPreviewStack("react")).toBe(true);
    expect(isClientPreviewStack("next")).toBe(true); // the backend's default stack
    expect(isClientPreviewStack("Nextjs")).toBe(true);
    expect(isClientPreviewStack("express")).toBe(false);
    expect(isClientPreviewStack("static")).toBe(false); // has its own srcdoc path
    expect(isClientPreviewStack(undefined)).toBe(false);
  });
});
