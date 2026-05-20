/**
 * WebCrypto helpers — PBKDF2 key derivation + AES-GCM encryption.
 *
 * Everything happens in-browser. The server only sees opaque ciphertext + iv +
 * salt. Without the password, decryption is computationally infeasible.
 */

const PBKDF2_ITERATIONS = 250_000;

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

export async function encryptPlaintext(
  plaintext: string,
  password: string,
): Promise<EncryptedPayload> {
  if (!crypto.subtle) {
    throw new Error("WebCrypto subtle API not available in this browser");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  );
  return {
    ciphertext: toB64(new Uint8Array(ctBuf)),
    iv: toB64(iv),
    salt: toB64(salt),
  };
}

export async function decryptPayload(
  payload: EncryptedPayload,
  password: string,
): Promise<string> {
  if (!crypto.subtle) {
    throw new Error("WebCrypto subtle API not available in this browser");
  }
  const salt = fromB64(payload.salt);
  const iv = fromB64(payload.iv);
  const ciphertext = fromB64(payload.ciphertext);
  const key = await deriveKey(password, salt);
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new TextDecoder().decode(ptBuf);
}
