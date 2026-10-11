/**
 * Which file should the IDE open after the AI finishes generating a project.
 *
 * Why this exists: after the first generation a guest's editor used to stay on
 * the "Выберите файл" placeholder (applyFileList only refreshed the tree, it
 * never selected a file), so "опиши — и получи работающее приложение" ended on
 * an empty code pane. The entry file is what a human wants to see first, and
 * for a static site it is also the file the in-IDE live preview renders.
 *
 * Preference order, most-wanted first:
 *   1. index.html at the project root (the served entry of a static site),
 *   2. an index.html deeper in the tree,
 *   3. any other .html file,
 *   4. the first file (so a non-web project still opens *something*),
 *   5. null when there are no files at all.
 *
 * Kept as a pure function (no React, no DOM) so it can be tested directly.
 */
export function pickEntryFile<T extends { path: string }>(files: readonly T[] | null | undefined): T | null {
  if (!Array.isArray(files) || files.length === 0) return null;
  const isHtml = (p: string) => p.toLowerCase().endsWith(".html");
  const base = (p: string) => p.split("/").pop()?.toLowerCase() ?? "";

  return (
    files.find((f) => f.path.toLowerCase() === "index.html") ??
    files.find((f) => base(f.path) === "index.html") ??
    files.find((f) => isHtml(f.path)) ??
    files[0]
  );
}

/**
 * Does this project have a page the in-IDE preview ("Правка на экране") can
 * render without a deploy — i.e. at least one .html file. Used to decide
 * whether to auto-open the preview tab after generation; projects with no
 * HTML (e.g. a bare script) get the editor, not an empty preview.
 */
export function hasRenderableHtml(files: readonly { path: string }[] | null | undefined): boolean {
  if (!Array.isArray(files)) return false;
  return files.some((f) => f.path.toLowerCase().endsWith(".html"));
}
