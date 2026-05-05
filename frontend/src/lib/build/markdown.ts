// Tiny safe markdown renderer for vacancy descriptions and similar
// recruiter-authored prose. Supports a deliberately small subset:
//   - **bold** / __bold__
//   - *italic* / _italic_
//   - `inline code`
//   - bullet lists (- foo / * foo) and numbered lists (1. foo)
//   - blank lines → paragraph breaks
//   - autolinked http(s) URLs
// HTML is NEVER passed through. We escape first, then transform tokens.
// Returns a string of HTML safe to drop in via dangerouslySetInnerHTML.

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

// Linkify after escaping so the URL itself is safe.
function linkify(s: string): string {
  return s.replace(
    /\bhttps?:\/\/[^\s<]+[^\s<.,:;!?'")\]]/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-emerald-300 hover:underline">${url}</a>`,
  );
}

function inline(s: string): string {
  // bold (** or __) — non-greedy
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  // italic (* or _) — only single delimiters now (after bold pass)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  // inline code
  s = s.replace(/`([^`\n]+)`/g, '<code class="rounded bg-white/10 px-1 text-emerald-200">$1</code>');
  return linkify(s);
}

export function renderMarkdown(src: string | null | undefined): string {
  if (!src) return "";
  const escaped = esc(src);
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inUL = false;
  let inOL = false;
  let para: string[] = [];

  function flushPara() {
    if (para.length === 0) return;
    out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  }
  function closeLists() {
    if (inUL) { out.push("</ul>"); inUL = false; }
    if (inOL) { out.push("</ol>"); inOL = false; }
  }

  for (const raw of lines) {
    const line = raw.trim();

    // Blank line — flush
    if (line === "") {
      flushPara();
      closeLists();
      continue;
    }

    // Bullet list
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushPara();
      if (!inUL) {
        closeLists();
        out.push('<ul class="list-disc pl-5 space-y-0.5">');
        inUL = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    // Numbered list
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (numbered) {
      flushPara();
      if (!inOL) {
        closeLists();
        out.push('<ol class="list-decimal pl-5 space-y-0.5">');
        inOL = true;
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    // Otherwise a paragraph line — close lists if any
    if (inUL || inOL) closeLists();
    para.push(line);
  }

  flushPara();
  closeLists();
  return out.join("");
}
