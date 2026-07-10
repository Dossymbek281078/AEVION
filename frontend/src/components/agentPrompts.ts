/**
 * Per-module suggested agent prompts.
 *
 * Given a product module, produce a few ready-to-run prompts that map onto the
 * agent runtime's real tools (image, voice, music, payment link, translate…).
 * Pure and deterministic → unit tested; used by the /[id] showcase page to seed
 * the AgentDock so every module can demonstrate value in one click.
 */

export interface PromptModule {
  id: string;
  code?: string;
  name: string;
  kind?: string;
  tags?: string[];
}

const hay = (m: PromptModule): string =>
  [m.id, m.code, m.kind, ...(m.tags ?? [])].filter(Boolean).join(" ").toLowerCase();

/** Return 3–4 module-tailored prompts, always including a safe generic set. */
export function suggestPromptsFor(m: PromptModule): string[] {
  const name = m.name?.trim() || m.code || m.id;
  const h = hay(m);
  const prompts: string[] = [];

  // Always useful: a visual for the module.
  prompts.push(`Generate a sleek hero image for "${name}".`);

  // Category-aware second prompt.
  if (/music|audio|awards|voice|sound|film/.test(h)) {
    prompts.push(`Compose a 10-second signature music clip for "${name}".`);
  } else if (/pay|fintech|bank|trade|card|checkout|commerce|invoice/.test(h)) {
    prompts.push(`Create a $29 payment link for "${name} Pro".`);
  } else {
    prompts.push(`Write and voice a 20-second intro for "${name}".`);
  }

  // Reach: translate the pitch for a global audience.
  prompts.push(`Translate the tagline for "${name}" into Kazakh and Russian.`);

  // Growth: a short launch email.
  prompts.push(`Draft a short launch announcement email for "${name}".`);

  // De-dupe defensively and cap at 4.
  return Array.from(new Set(prompts)).slice(0, 4);
}
