// Biometric protection via WebAuthn. Uses native OS prompts (Touch ID / Windows Hello /
// hardware key). Credential id stored in localStorage; the actual private key never leaves
// the authenticator.
//
// Demo mode (no backend): we don't verify the signature server-side — we just require a
// successful navigator.credentials.get() before high-value transfers. Real production would
// send the assertion to backend for signature verification against a stored public key.

const STORAGE_KEY = "aevion_bank_biometric_v1";

export type BiometricSettings = {
  credentialId: string;
  email: string;
  enrolledAt: string;
  threshold: number;
};

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuf(s: string): ArrayBuffer {
  let v = s.replace(/-/g, "+").replace(/_/g, "/");
  while (v.length % 4 !== 0) v += "=";
  const bin = atob(v);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("credentials" in navigator)) return false;
  return typeof (window as Window & { PublicKeyCredential?: unknown }).PublicKeyCredential === "function";
}

export function loadBiometric(): BiometricSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (
      v &&
      typeof v.credentialId === "string" &&
      typeof v.email === "string" &&
      typeof v.enrolledAt === "string" &&
      typeof v.threshold === "number"
    ) {
      return v as BiometricSettings;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveBiometric(s: BiometricSettings | null): void {
  if (typeof window === "undefined") return;
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function enrollBiometric(email: string, threshold: number): Promise<BiometricSettings> {
  if (!isBiometricSupported()) throw new Error("Biometric not supported on this device");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "AEVION Bank" },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        userVerification: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred || cred.type !== "public-key") throw new Error("Enrollment cancelled");

  const settings: BiometricSettings = {
    credentialId: bufToBase64Url(cred.rawId),
    email,
    enrolledAt: new Date().toISOString(),
    threshold,
  };
  saveBiometric(settings);
  return settings;
}

export async function assertBiometric(settings: BiometricSettings): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { id: base64UrlToBuf(settings.credentialId), type: "public-key" },
        ],
        userVerification: "preferred",
        timeout: 60_000,
      },
    });
    return !!result;
  } catch {
    return false;
  }
}
