/**
 * What actually happened last time we called a provider.
 *
 * /studio/capabilities reported "live" whenever a key was present, and today
 * three of those were lies at once: image (OpenAI billing hard limit,
 * Cloudflare Workers AI 401, Together key absent), video (Replicate 402, no
 * credit) and voice (ElevenLabs had removed the model we sent). A configured
 * key is not a working capability.
 *
 * This records the outcome of real calls, so the shop window can say
 * "degraded" with the provider's own reason instead of a green light nobody
 * verified. In-memory on purpose: it describes this process's recent
 * experience, not a fact worth persisting, and it must never become another
 * thing that can be stale.
 */

export type CapabilityHealth = {
  ok: boolean;
  reason?: string;
  at: string;
};

const health = new Map<string, CapabilityHealth>();

/** Failures older than this stop being reported — a topped-up account should
 * not stay red because of an hour-old error. */
const TTL_MS = 30 * 60 * 1000;

export function noteProviderFailure(capabilityId: string, reason: string): void {
  health.set(capabilityId, { ok: false, reason: reason.slice(0, 200), at: new Date().toISOString() });
}

export function noteProviderSuccess(capabilityId: string): void {
  health.set(capabilityId, { ok: true, at: new Date().toISOString() });
}

export function getProviderHealth(capabilityId: string): CapabilityHealth | null {
  const h = health.get(capabilityId);
  if (!h) return null;
  if (Date.now() - Date.parse(h.at) > TTL_MS) {
    health.delete(capabilityId);
    return null;
  }
  return h;
}

/** Apply recent reality to a capability's declared status. */
export function applyHealth<T extends { id: string; status?: string }>(capability: T): T & { lastError?: string } {
  const h = getProviderHealth(capability.id);
  if (!h || h.ok || capability.status !== "live") return capability;
  return { ...capability, status: "degraded", lastError: h.reason };
}

/** Test seam. */
export function __resetProviderHealth(): void {
  health.clear();
}
