/**
 * Capability awareness for the DevHub IDE.
 *
 * `/api/devhub/studio/capabilities` already tells us honestly which
 * integrations are configured on the server ("live") and which are missing a
 * token ("needs_token"). The IDE never asked: the Vercel button looked
 * identical whether a deploy was possible or guaranteed to fail with 503.
 *
 * Deliberately FAIL-OPEN: a capability we have not loaded, or do not know, is
 * treated as available. A wrongly disabled button hides a working feature —
 * strictly worse than letting the honest server error through.
 */

export type Capability = {
  id: string;
  name?: string;
  status?: string;
  token?: string;
  tokens?: string[];
};

export type CapabilityIndex = Record<string, Capability>;

export function indexCapabilities(list: Capability[] | null | undefined): CapabilityIndex {
  const idx: CapabilityIndex = {};
  for (const c of list ?? []) {
    if (c && typeof c.id === "string") idx[c.id] = c;
  }
  return idx;
}

/** True only when the server explicitly reports this capability as not live. */
export function isCapabilityBlocked(idx: CapabilityIndex | null, id: string): boolean {
  const c = idx?.[id];
  if (!c || !c.status) return false; // unknown / not loaded yet → fail open
  return c.status !== "live";
}

/** Human explanation for a blocked capability — used as button title and toast. */
export function capabilityHint(idx: CapabilityIndex | null, id: string, label: string): string {
  const c = idx?.[id];
  if (!c || !c.status || c.status === "live") return `${label}`;
  const tokens = c.tokens?.length ? c.tokens : c.token ? [c.token] : [];
  const needs = tokens.length ? ` — set ${tokens.join(" + ")} on the server` : "";
  return `${label} is not configured${needs}`;
}
