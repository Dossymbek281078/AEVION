/**
 * Client-side live preview for React SPA projects — no deploy, no dev server.
 *
 * How it closes the Bolt/v0 preview gap within our srcdoc iframe pattern:
 * - JSX/TS transform runs in the PARENT page via @babel/standalone (bundled
 *   with our app — the transformer itself needs no CDN);
 * - each project file becomes an ES module as a data: URL, and local imports
 *   are rewritten to virtual bare specifiers ("local/src/App.jsx") resolved
 *   through an import map — bare specifiers work from data: modules where
 *   relative paths cannot (data: URLs have no base URL);
 * - react / react-dom stay external (esm.sh) — React ships no browser-ready
 *   single-file build we could inline; when that fetch fails the iframe shows
 *   an honest error instead of a blank page.
 */

export type PreviewFile = { path: string; content: string };

const ENTRY_CANDIDATES = [
  "src/main.jsx", "src/main.tsx", "main.jsx", "main.tsx",
  "src/index.jsx", "src/index.tsx", "index.jsx", "index.tsx",
  "src/App.jsx", "src/App.tsx", "App.jsx", "App.tsx",
];

const CODE_RE = /\.(jsx|tsx|js|ts|mjs)$/i;
const REACT_VERSION = "18.3.1";

export function findReactEntry(files: PreviewFile[]): string | null {
  for (const c of ENTRY_CANDIDATES) {
    if (files.some((f) => f.path === c)) return c;
  }
  const anyCode = files.find((f) => CODE_RE.test(f.path));
  return anyCode?.path ?? null;
}

/** Resolve "./Button" from "src/App.jsx" to an actual project path, trying
 * the bare name plus the usual extensions and index files. */
export function resolveLocalImport(importerPath: string, spec: string, files: PreviewFile[]): string | null {
  const dir = importerPath.split("/").slice(0, -1);
  const parts = spec.split("/");
  const stack = [...dir];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    else if (part === "..") stack.pop();
    else stack.push(part);
  }
  const base = stack.join("/");
  const candidates = [
    base,
    `${base}.jsx`, `${base}.tsx`, `${base}.js`, `${base}.ts`, `${base}.mjs`, `${base}.css`,
    `${base}/index.jsx`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.ts`,
  ];
  for (const c of candidates) {
    if (files.some((f) => f.path === c)) return c;
  }
  return null;
}

/** Rewrite relative import/from specifiers in TRANSFORMED (plain ESM) code to
 * virtual bare specifiers the import map can resolve. CSS imports are dropped
 * (their content is injected as <style> separately). */
export function rewriteLocalImports(code: string, importerPath: string, files: PreviewFile[]): string {
  return code.replace(
    /(from\s*|import\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g,
    (whole, lead: string, quote: string, spec: string) => {
      const resolved = resolveLocalImport(importerPath, spec, files);
      if (!resolved) return whole; // unknown import — leave it; the iframe error surfaces it honestly
      if (resolved.endsWith(".css")) return `${lead}${quote}data:text/javascript,${quote}`; // no-op module
      return `${lead}${quote}local/${resolved}${quote}`;
    }
  );
}

type Babel = { transform: (code: string, opts: Record<string, unknown>) => { code?: string | null } };

export async function buildReactPreviewSrcdoc(files: PreviewFile[], overlayScript: string): Promise<{ srcdoc: string } | { error: string }> {
  const entry = findReactEntry(files);
  if (!entry) return { error: "No .jsx/.tsx entry file found — add src/App.jsx to use the live preview." };

  const babel = (await import("@babel/standalone")) as unknown as Babel;

  const moduleMap: Record<string, string> = {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    "react-dom": `https://esm.sh/react-dom@${REACT_VERSION}`,
    "react-dom/client": `https://esm.sh/react-dom@${REACT_VERSION}/client`,
    "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
  };

  const codeFiles = files.filter((f) => CODE_RE.test(f.path));
  for (const f of codeFiles) {
    let transformed: string;
    try {
      const out = babel.transform(f.content, {
        filename: f.path,
        presets: [
          ["react", { runtime: "automatic" }],
          ...(/\.tsx?$/i.test(f.path) ? [["typescript", { isTSX: f.path.toLowerCase().endsWith(".tsx"), allExtensions: true }]] : []),
        ],
        sourceType: "module",
      });
      transformed = out.code ?? "";
    } catch (e) {
      return { error: `Babel could not transform ${f.path}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` };
    }
    const rewritten = rewriteLocalImports(transformed, f.path, files);
    moduleMap[`local/${f.path}`] = `data:text/javascript;base64,${toBase64(rewritten)}`;
  }

  const styles = files
    .filter((f) => f.path.toLowerCase().endsWith(".css"))
    .map((f) => `<style>${f.content.replace(/<\/style/gi, "<\\/style")}</style>`)
    .join("\n");

  const entryContent = files.find((f) => f.path === entry)?.content ?? "";
  // main.jsx-style entries call createRoot themselves; App.jsx-style entries
  // export a component we mount ourselves.
  const selfMounting = /createRoot\s*\(|ReactDOM\.render\s*\(/.test(entryContent);
  const boot = selfMounting
    ? `import ${JSON.stringify(`local/${entry}`)};`
    : `import React from "react";
import { createRoot } from "react-dom/client";
import App from ${JSON.stringify(`local/${entry}`)};
createRoot(document.getElementById("root")).render(React.createElement(App));`;

  const srcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify({ imports: moduleMap })}</script>
${styles}
<style>#devhub-preview-error{font-family:ui-monospace,monospace;color:#b91c1c;background:#fef2f2;padding:12px 16px;font-size:13px;white-space:pre-wrap}</style>
</head><body>
<div id="root"></div>
<script>
window.addEventListener("error", function(e){
  var el = document.getElementById("devhub-preview-error") || document.body.appendChild(Object.assign(document.createElement("div"),{id:"devhub-preview-error"}));
  el.textContent = "Preview error: " + (e.message || "failed to load a module (network blocked?)");
});
window.addEventListener("unhandledrejection", function(e){
  var el = document.getElementById("devhub-preview-error") || document.body.appendChild(Object.assign(document.createElement("div"),{id:"devhub-preview-error"}));
  el.textContent = "Preview error: " + (e.reason && e.reason.message ? e.reason.message : String(e.reason));
});
</script>
<script type="module">${boot.replace(/<\/script/gi, "<\\/script")}</script>
<script>${overlayScript}</script>
</body></html>`;

  return { srcdoc };
}

function toBase64(s: string): string {
  // btoa chokes on non-Latin1; round-trip through UTF-8 bytes.
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
