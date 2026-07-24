/**
 * Chat hint triggers for the DevHub IDE — pure decision functions, extracted
 * so the rules are unit-testable without rendering the (huge) IDE page.
 */

const DATA_SIGNALS =
  /трекер|список|заказ|товар|запис|заметк|расход|склад|учёт|учет|пользовател|юзер|todo|task|tracker|inventory|order|list|user|note|expense|habit|привыч/i;

/** Offer the "design a database" card when the idea is data-shaped, the
 * project has no schema yet, and we haven't offered before (hints are
 * single-shot — a dismissed suggestion must never nag). */
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
