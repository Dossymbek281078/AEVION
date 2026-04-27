// Local audit log of QSign-signed operations.
// Each transfer or top-up is signed via /api/qsign/sign right after success;
// the (payload, signature) pair lives here so the user can re-verify any time
// against /api/qsign/verify and detect tampering.

const STORAGE_KEY = "aevion_bank_signatures_v1";
const MAX_KEEP = 200;
export const SIGNATURE_EVENT = "aevion:signatures-changed";

export type VerifyState = "unknown" | "valid" | "invalid" | "error";

export type SignedOperation = {
  id: string;
  kind: "transfer" | "topup";
  payload: Record<string, unknown>;
  signature: string;
  algo: string;
  signedAt: string;
  verified: VerifyState;
  verifiedAt: string | null;
};

function isSigned(x: unknown): x is SignedOperation {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<SignedOperation>;
  return (
    typeof s.id === "string" &&
    typeof s.kind === "string" &&
    typeof s.signature === "string" &&
    typeof s.payload === "object" &&
    typeof s.signedAt === "string"
  );
}

export function loadSignatures(): SignedOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isSigned);
  } catch {
    return [];
  }
}

export function saveSignatures(items: SignedOperation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_KEEP)));
    window.dispatchEvent(new Event(SIGNATURE_EVENT));
  } catch {
    // ignore
  }
}

export function appendSignature(item: SignedOperation): void {
  const current = loadSignatures();
  saveSignatures([item, ...current]);
}

export function updateSignatureStatus(
  id: string,
  state: VerifyState,
): void {
  const current = loadSignatures();
  const next = current.map((s) =>
    s.id === id
      ? { ...s, verified: state, verifiedAt: new Date().toISOString() }
      : s,
  );
  saveSignatures(next);
}

export function clearSignatures(): void {
  saveSignatures([]);
}
