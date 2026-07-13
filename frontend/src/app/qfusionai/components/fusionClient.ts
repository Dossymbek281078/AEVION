/**
 * Stable anonymous client id for QFusionAI run history.
 *
 * The backend scopes persisted fusion runs to an owner key so one visitor never
 * sees another's prompts. Anonymous visitors get a random id kept in
 * localStorage; it's sent with POST /route and read back on GET /runs. (The
 * Vercel→Railway proxy masks the real IP, so IP-scoping would be unreliable.)
 */
const LS_KEY = "aevion_qfusionai_client";

export function fusionClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(LS_KEY);
    if (!id) {
      id = (window.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.floor(Math.random() * 1e9)}`);
      window.localStorage.setItem(LS_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
