/**
 * Chat hint triggers for the DevHub IDE — pure decision functions, extracted
 * so the rules are unit-testable without rendering the (huge) IDE page.
 */

const DATA_SIGNALS =
  /трекер|список|заказ|товар|запис|заметк|расход|склад|учёт|учет|пользовател|юзер|todo|task|tracker|inventory|order|list|user|note|expense|habit|привыч/i;

/** Offer the "design a database" card when the idea is data-shaped, the
 * project has no schema yet, and we haven't offered before (hints are
 * single-shot — a dismissed suggestion must never nag). */
/** Offer the "deploy it" card after a successful generation on a Static
 * project that has never been deployed — the one-click path from generated
 * code to a public URL. Static only: that's the stack whose CF Pages deploy
 * is verified end-to-end (react SPA sources need a build step first). */
export function shouldOfferDeployHint(args: {
  stack: string;
  deployUrl: string | null | undefined;
  historyHasDeployHint: boolean;
}): boolean {
  if (args.historyHasDeployHint) return false;
  if (args.stack !== "static") return false;
  return !args.deployUrl;
}

export function shouldOfferDbHint(args: {
  userText: string;
  projectDescription: string | null | undefined;
  filePaths: string[];
  historyHasHint: boolean;
}): boolean {
  if (args.historyHasHint) return false;
  if (args.filePaths.includes("db/schema.sql")) return false;
  return DATA_SIGNALS.test(args.userText) || DATA_SIGNALS.test(args.projectDescription || "");
}
