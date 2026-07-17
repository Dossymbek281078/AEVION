/**
 * Lightweight syntax-only check for AI-generated code files, before they're
 * silently treated as "done" — parses a single file in isolation (no project/
 * tsconfig, no type-checking, no module resolution), so it only catches
 * genuine syntax errors (unmatched braces, invalid tokens), not semantic ones.
 *
 * The `typescript` compiler API is large; it's dynamic-imported and cached
 * here on first real use rather than statically imported, so modules that
 * pull this file in (like devhub.ts, which nearly every backend test touches
 * transitively) don't pay its parse/load cost just by being imported.
 */

let tsModule: typeof import("typescript") | null = null;
async function getTs() {
  if (!tsModule) tsModule = await import("typescript");
  return tsModule;
}

const SYNTAX_CHECKABLE_EXT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

export async function checkFileSyntax(path: string, content: string): Promise<string[]> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") {
    try {
      JSON.parse(content);
      return [];
    } catch (e) {
      return [`Invalid JSON: ${(e as Error).message}`];
    }
  }
  if (!SYNTAX_CHECKABLE_EXT.has(ext)) return []; // no lightweight parser available for this language — not an error, just unchecked
  const ts = await getTs();
  const isJsx = ext === "tsx" || ext === "jsx";
  const result = ts.transpileModule(content, {
    compilerOptions: {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      jsx: isJsx ? ts.JsxEmit.Preserve : ts.JsxEmit.None,
      allowJs: true,
    },
    reportDiagnostics: true,
  });
  return (result.diagnostics ?? [])
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (d.file && d.start !== undefined) {
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        return `Line ${line + 1}:${character + 1} — ${msg}`;
      }
      return msg;
    });
}

export async function validateGeneratedFiles(
  files: Array<{ path: string; content: string }>
): Promise<Array<{ path: string; errors: string[] }>> {
  const problems: Array<{ path: string; errors: string[] }> = [];
  for (const f of files) {
    const errors = await checkFileSyntax(f.path, f.content);
    if (errors.length > 0) problems.push({ path: f.path, errors });
  }
  return problems;
}
