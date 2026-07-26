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

// Models routinely emit CRA-style React in plain .js ("src/index.js" +
// "src/App.js") — a real generation shape, not a defect. Extensions are
// therefore ranked, not required: .jsx/.tsx first, .js/.ts right behind.
const ENTRY_BASENAMES = ["src/main", "main", "src/index", "index", "src/App", "App"];
const ENTRY_EXTS = [".jsx", ".tsx", ".js", ".ts"];
// Next.js route entries come first: a Next project also has src/… files, but
// its page component is what the user expects to see rendered.
const NEXT_ENTRY_BASENAMES = ["app/page", "src/app/page", "pages/index", "src/pages/index"];
const ENTRY_CANDIDATES = [...NEXT_ENTRY_BASENAMES, ...ENTRY_BASENAMES].flatMap((b) =>
  ENTRY_EXTS.map((e) => b + e)
);

/** A Server Component cannot run in the browser: it awaits data server-side
 * before returning JSX. Detected so the preview says so instead of dying in
 * an unhandled rejection. */
const ASYNC_DEFAULT_RE = /export\s+default\s+async\s+function/;

const CODE_RE = /\.(jsx|tsx|js|ts|mjs)$/i;
/** An entry that mounts itself (CRA/Vite index) rather than exporting a component. */
const SELF_MOUNT_RE = /createRoot\s*\(|ReactDOM\.render\s*\(/;
const REACT_VERSION = "18.3.1";

/** Stacks whose sources can be rendered in the browser with no deploy.
 * "next" is included for client pages: a Server Component is caught later
 * and reported honestly rather than guessed at. */
export function isClientPreviewStack(stack: string | null | undefined): boolean {
  const s = (stack || "").toLowerCase();
  return s === "react" || s === "next" || s === "nextjs";
}

export function findReactEntry(files: PreviewFile[]): string | null {
  for (const c of ENTRY_CANDIDATES) {
    if (files.some((f) => f.path === c)) return c;
  }
  const code = files.filter((f) => CODE_RE.test(f.path));
  if (!code.length) return null;
  // No conventional name: mounting code identifies the entry far better than
  // file order does — picking the first code file alphabetically once made
  // "src/components/Settings.js" the root of the whole preview.
  const mounts = code.find((f) => SELF_MOUNT_RE.test(f.content));
  if (mounts) return mounts.path;
  // Still ambiguous — prefer the shallowest path (an app root sits above its
  // components), tie-broken by order, so the choice is at least deterministic.
  return code.reduce((best, f) =>
    f.path.split("/").length < best.path.split("/").length ? f : best
  ).path;
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
      // CSS Modules keep a value (s.title must be a string); plain CSS is
      // injected as <style> and its import becomes a no-op module.
      if (/\.module\.css$/i.test(resolved)) return `${lead}${quote}${CSS_MODULE_SPECIFIER}${quote}`;
      if (resolved.endsWith(".css")) return `${lead}${quote}data:text/javascript,${quote}`;
      return `${lead}${quote}local/${resolved}${quote}`;
    }
  );
}

/**
 * Browser stand-ins for the Next.js runtime imports a generated page uses.
 * They are not Next.js — they render the DOM element the real component would
 * produce, so a page can be *seen* without a build. Navigation is inert: this
 * is a preview of one route, not a running router.
 */
const NEXT_SHIMS: Record<string, string> = {
  "next/link": `import React from "react";
export default function Link({ href, children, ...rest }) {
  return React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children);
}`,
  "next/image": `import React from "react";
export default function Image({ src, alt, fill, priority, quality, loader, placeholder, blurDataURL, unoptimized, ...rest }) {
  const resolved = src && typeof src === "object" ? (src.src || "") : src;
  const style = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...(rest.style || {}) } : rest.style;
  return React.createElement("img", { ...rest, style, src: resolved, alt: alt || "" });
}`,
  "next/navigation": `const noop = () => {};
export function useRouter() { return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop }; }
export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {}; }
export function redirect() {}
export function notFound() {}`,
  "next/head": `export default function Head() { return null; }`,
  "next/script": `export default function Script() { return null; }`,
};

/** CSS Modules: `import s from "./x.module.css"` must yield something whose
 * every property is a string, or the first `s.title` throws. The real class
 * names are already in the injected <style>, so echoing the key is enough. */
const CSS_MODULE_SHIM =
  `const handler = { get: (_t, k) => (typeof k === "string" ? k : undefined) };\n` +
  `export default new Proxy({}, handler);`;

const CSS_MODULE_SPECIFIER = "devhub/css-module";

/** `next/font` exports arbitrary named loaders (Inter, Roboto, …) which no
 * fixed shim module can satisfy, so the import is rewritten into a local
 * stub instead of resolved. */
export function stubNextFontImports(code: string): string {
  return code.replace(
    /import\s*\{([^}]*)\}\s*from\s*["']next\/font\/[a-z]+["']\s*;?/g,
    (_whole, names: string) => {
      const decls = names
        .split(",")
        .map((n) => n.split(/\s+as\s+/).pop()!.trim())
        .filter(Boolean)
        .map((n) => `const ${n} = () => ({ className: "", style: {}, variable: "" });`);
      return decls.join(" ");
    }
  );
}

type Babel = { transform: (code: string, opts: Record<string, unknown>) => { code?: string | null } };

export async function buildReactPreviewSrcdoc(files: PreviewFile[], overlayScript: string): Promise<{ srcdoc: string } | { error: string }> {
  const entry = findReactEntry(files);
  if (!entry) return { error: "No React entry file found — add src/App.jsx (or src/App.js) to use the live preview." };

  const babel = (await import("@babel/standalone")) as unknown as Babel;

  const entryFile = files.find((f) => f.path === entry);
  if (entryFile && ASYNC_DEFAULT_RE.test(entryFile.content)) {
    return {
      error:
        `${entry} is an async Server Component — it fetches on the server before rendering, ` +
        `so the browser preview cannot run it. Deploy the project to see this page.`,
    };
  }

  const moduleMap: Record<string, string> = {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    "react-dom": `https://esm.sh/react-dom@${REACT_VERSION}`,
    "react-dom/client": `https://esm.sh/react-dom@${REACT_VERSION}/client`,
    "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
    [CSS_MODULE_SPECIFIER]: `data:text/javascript;base64,${toBase64(CSS_MODULE_SHIM)}`,
  };
  // Next runtime stand-ins are always mapped: harmless entries for a plain
  // React project, and the difference between a rendered page and a module
  // resolution error for a Next one.
  for (const [spec, src] of Object.entries(NEXT_SHIMS)) {
    moduleMap[spec] = `data:text/javascript;base64,${toBase64(src)}`;
  }

  const codeFiles = files.filter((f) => CODE_RE.test(f.path));
  for (const f of codeFiles) {
    let transformed: string;
    try {
      const out = babel.transform(stubNextFontImports(f.content), {
        filename: f.path,
        // Babel 8 removed preset-typescript's isTSX/allExtensions options —
        // the filename alone now decides TS/TSX handling (bug found live:
        // every preview build failed with "[BABEL] options have been removed").
        presets: [
          ["react", { runtime: "automatic" }],
          ...(/\.tsx?$/i.test(f.path) ? ["typescript"] : []),
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
  const selfMounting = SELF_MOUNT_RE.test(entryContent);
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
