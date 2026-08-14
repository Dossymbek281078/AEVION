/**
 * Turning a generated media URL into something you can paste into a project
 * file — extracted from the (huge) IDE page so the rules are unit-testable.
 *
 * The bug this exists for: the media tab's "save URL to file" buttons replaced
 * the whole open file with a single line. Open App.jsx, generate a video, press
 * the button, and the app is gone. Appending keeps the work.
 */

export type AssetKind = "video" | "image" | "model";

/** Escape for an HTML/JSX attribute value delimited by double quotes. */
function attr(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Neutralise sequences that would close the comment the URL sits in. Uses
 * percent-encoding rather than inserting filler characters: the URL stays a
 * working URL when someone copies it out of the comment.
 */
function inComment(url: string, closer: "*/" | "-->"): string {
  return closer === "*/" ? url.replace(/\*\//g, "*%2F") : url.replace(/>/g, "%3E");
}

/**
 * The markup to append for `url`, chosen by the open file's extension:
 * JSX/TSX gets JSX, HTML gets HTML, anything else gets the bare URL (a bare
 * line is always safe — wrong-language markup would break the file).
 */
export function assetSnippet(path: string, url: string, kind: AssetKind): string {
  const p = path.toLowerCase();
  const isJsx = /\.(jsx|tsx)$/.test(p);
  const isHtml = /\.html?$/.test(p);

  if (isJsx) {
    if (kind === "video") return `<video src="${attr(url)}" controls />`;
    if (kind === "image") return `<img src="${attr(url)}" alt="" />`;
    return `{/* 3D model (GLB): ${inComment(url, "*/")} */}`;
  }
  if (isHtml) {
    if (kind === "video") return `<video src="${attr(url)}" controls></video>`;
    if (kind === "image") return `<img src="${attr(url)}" alt="">`;
    return `<!-- 3D model (GLB): ${inComment(url, "-->")} -->`;
  }
  return url;
}

/**
 * Append `snippet` to `content`, separated by a blank line, ending with a
 * newline. Never returns less than it was given — that is the whole point.
 */
export function appendSnippet(content: string, snippet: string): string {
  const body = content.replace(/\s+$/, "");
  if (!body) return `${snippet}\n`;
  return `${body}\n\n${snippet}\n`;
}
