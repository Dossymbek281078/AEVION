"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFileSyntax = checkFileSyntax;
exports.validateGeneratedFiles = validateGeneratedFiles;
let tsModule = null;
async function getTs() {
    if (!tsModule)
        tsModule = await Promise.resolve().then(() => __importStar(require("typescript")));
    return tsModule;
}
const SYNTAX_CHECKABLE_EXT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);
async function checkFileSyntax(path, content) {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "json") {
        try {
            JSON.parse(content);
            return [];
        }
        catch (e) {
            return [`Invalid JSON: ${e.message}`];
        }
    }
    if (!SYNTAX_CHECKABLE_EXT.has(ext))
        return []; // no lightweight parser available for this language — not an error, just unchecked
    const ts = await getTs();
    const isJsx = ext === "tsx" || ext === "jsx";
    const result = ts.transpileModule(content, {
        compilerOptions: {
            target: ts.ScriptTarget.Latest,
            module: ts.ModuleKind.ESNext,
            // Omit `jsx` entirely for non-JSX files — `ts.JsxEmit.None` is NOT a
            // valid value for this option (only preserve/react/react-native/
            // react-jsx/react-jsxdev are) and TS reports that as an "invalid --jsx
            // option" diagnostic on EVERY .ts/.js file, indistinguishable from a
            // real syntax error. Caught via a Node one-liner reproducing the false
            // positive before this shipped — not by the type checker, since
            // `JsxEmit.None` is a legitimate enum member, just not a legal value here.
            ...(isJsx ? { jsx: ts.JsxEmit.Preserve } : {}),
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
async function validateGeneratedFiles(files) {
    const problems = [];
    for (const f of files) {
        const errors = await checkFileSyntax(f.path, f.content);
        if (errors.length > 0)
            problems.push({ path: f.path, errors });
    }
    return problems;
}
