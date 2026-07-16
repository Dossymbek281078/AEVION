// Client helper for the platform smart-call layer. Any product page can ask a
// question through the QCoreAI auto-router (FACT → single flagship, OPEN →
// weight-graded Council) and get back the answer plus how it was routed — while
// the shared cross-module savings tally counts the run under `module`.
import { apiUrl } from "@/lib/apiBase";

export type AskRouting = {
  classification: "open" | "fact";
  resolved: "single" | "council";
  depth?: "light" | "deep";
  layers?: number;
  costUsd: number;
  durationMs: number;
};

export type AskResult = { answer: string; routing: AskRouting };

/** Route a question through POST /api/qcoreai/smart, tagged with `module` for
 *  savings attribution. Throws on a non-2xx response. */
export async function askSmart(opts: {
  question: string;
  module?: string;
  signal?: AbortSignal;
}): Promise<AskResult> {
  const question = opts.question.trim();
  if (!question) throw new Error("question is empty");
  const res = await fetch(apiUrl("/api/qcoreai/smart"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: question, module: opts.module || "qcoreai" }),
    signal: opts.signal,
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {
      /* keep status */
    }
    throw new Error(msg);
  }
  const j = (await res.json()) as AskResult;
  return { answer: j.answer, routing: j.routing };
}
