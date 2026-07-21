/** Normalizes a stored URL that may carry a doubled scheme ("https://https://x").
 *
 * The pattern comes from two real sources: legacy deploy records written before
 * their constructor gained a startsWith("http") guard, and user-entered links
 * pasted with a scheme into a form that prepends its own. Renders should pass
 * stored external URLs through this instead of trusting them verbatim. */
export function fixDoubledScheme(u: string): string {
  return u.replace(/^(https?:\/\/)+(?=https?:\/\/)/, "");
}
