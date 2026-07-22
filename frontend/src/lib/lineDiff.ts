/** Minimal line-level diff for the DevHub AI chat — enough to SHOW a change,
 * not a full patch engine. LCS over lines with a size cap; oversized inputs
 * fall back to stats-only so a huge generated file can't freeze the tab. */

export type FileDiff = {
  added: number;
  removed: number;
  /** Unified-style text ("+ line" / "- line" / "  line"), or null when the
   * inputs were too large and only the counts are reliable. */
  text: string | null;
};

const MAX_LINES = 600;
const CONTEXT = 2;

export function diffLines(before: string, after: string): FileDiff {
  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    // Cheap approximation for the counters: lines not present on the other side.
    const setA = new Set(a);
    const setB = new Set(b);
    return {
      added: b.filter((l) => !setA.has(l)).length,
      removed: a.filter((l) => !setB.has(l)).length,
      text: null,
    };
  }

  // Standard LCS table (inputs are capped, so O(n·m) is fine).
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  type Op = { kind: " " | "+" | "-"; line: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ kind: " ", line: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { ops.push({ kind: "-", line: a[i] }); i++; }
    else { ops.push({ kind: "+", line: b[j] }); j++; }
  }
  while (i < n) { ops.push({ kind: "-", line: a[i++] }); }
  while (j < m) { ops.push({ kind: "+", line: b[j++] }); }

  const added = ops.filter((o) => o.kind === "+").length;
  const removed = ops.filter((o) => o.kind === "-").length;

  // Collapse long unchanged runs to keep the rendered diff readable.
  const keep = new Array(ops.length).fill(false);
  ops.forEach((o, idx) => {
    if (o.kind !== " ") {
      for (let k = Math.max(0, idx - CONTEXT); k <= Math.min(ops.length - 1, idx + CONTEXT); k++) keep[k] = true;
    }
  });
  const out: string[] = [];
  let skipping = 0;
  ops.forEach((o, idx) => {
    if (keep[idx]) {
      if (skipping > 0) { out.push(`  … ${skipping} unchanged line${skipping === 1 ? "" : "s"} …`); skipping = 0; }
      out.push(`${o.kind} ${o.line}`);
    } else {
      skipping++;
    }
  });
  if (skipping > 0) out.push(`  … ${skipping} unchanged line${skipping === 1 ? "" : "s"} …`);

  return { added, removed, text: out.join("\n") };
}
