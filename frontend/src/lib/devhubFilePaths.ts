/**
 * File-path rules for the DevHub IDE — pure, so they are testable without
 * rendering the IDE page.
 *
 * These exist because the backend's file endpoint is an upsert: PUT with a
 * path that already exists replaces its content, no questions asked. "New
 * file" sent `content: ""`, so typing the name of a file you already had
 * emptied it. Rename had the mirror problem: renaming onto an existing path
 * overwrote that file and dropped it from the tree.
 */

/** Trim, normalise separators, and drop a leading "./" or "/". */
export function normalizeFilePath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.?\//, "");
}

/**
 * Why this path cannot be created, or null if it can. `existingPaths` is the
 * project's current file list.
 */
export function newFilePathError(raw: string, existingPaths: string[]): string | null {
  const path = normalizeFilePath(raw);
  if (!path) return "Введите имя файла";
  if (path.endsWith("/")) return "Имя файла не может заканчиваться на «/»";
  if (path.split("/").some((seg) => seg === "..")) return "«..» в пути не допускается";
  if (existingPaths.some((p) => normalizeFilePath(p) === path)) {
    return `${path} уже существует — откройте его в дереве файлов`;
  }
  return null;
}

/** Why this rename cannot happen, or null if it can. */
export function renamePathError(oldPath: string, raw: string, existingPaths: string[]): string | null {
  const path = normalizeFilePath(raw);
  if (path === normalizeFilePath(oldPath)) return null; // no-op, caller just closes the input
  const others = existingPaths.filter((p) => normalizeFilePath(p) !== normalizeFilePath(oldPath));
  return newFilePathError(raw, others);
}
