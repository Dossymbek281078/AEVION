/**
 * Author co-signing keypair — generated and held entirely client-side.
 *
 * Threat model recap: AEVION owns the platform Ed25519 key + HMAC secret.
 * If those leak, attacker can forge any new certificate. The author's
 * keypair lives only in the user's browser (IndexedDB) plus an exportable
 * backup file — AEVION never sees the private key. So forging a cert
 * that matches a SPECIFIC author additionally requires the author's
 * private key, which the platform cannot lose because it never had it.
 *
 * Trade-off the user accepts: they MUST keep their backup file safe. If
 * they lose both the IndexedDB record AND the backup, they cannot issue
 * new claims under that identity. Existing certs remain verifiable
 * forever — the public key is stored on every certificate row.
 */

const DB_NAME = "aevion_author_v1";
const STORE = "keypair";
const RECORD_ID = "current";

type StoredRecord = {
  id: string;
  publicKeyRaw: ArrayBuffer; // 32 bytes
  privateKeyPkcs8: ArrayBuffer;
  createdAt: string;
};

export type AuthorKey = {
  publicKeyBase64: string;
  fingerprint: string;
  createdAt: string;
  /** Sign a UTF-8 string and return base64 raw 64-byte signature. */
  sign: (message: string) => Promise<string>;
};

export type AuthorKeyBackup = {
  version: 1;
  algo: "ed25519";
  createdAt: string;
  /** base64-encoded raw 32-byte public key */
  publicKeyBase64: string;
  /** base64-encoded PKCS8 private key (Ed25519) */
  privateKeyPkcs8Base64: string;
  fingerprint: string;
};

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function sha256Hex(input: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fingerprint(rawPub: ArrayBuffer): Promise<string> {
  return (await sha256Hex(rawPub)).slice(0, 16);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readStored(): Promise<StoredRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(RECORD_ID);
    req.onsuccess = () => resolve((req.result as StoredRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

async function writeStored(record: StoredRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStored(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(RECORD_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** True when the runtime can actually do Ed25519 in WebCrypto. */
export async function isCosignSupported(): Promise<boolean> {
  if (typeof crypto === "undefined" || !crypto.subtle) return false;
  try {
    await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    );
    return true;
  } catch {
    return false;
  }
}

async function buildAuthorKeyFromCryptoKeys(
  publicKey: CryptoKey,
  privateKey: CryptoKey,
  createdAt: string,
): Promise<AuthorKey> {
  const rawPub = await crypto.subtle.exportKey("raw", publicKey);
  const fp = await fingerprint(rawPub);
  return {
    publicKeyBase64: bufToBase64(rawPub),
    fingerprint: fp,
    createdAt,
    sign: async (message: string) => {
      const data = new TextEncoder().encode(message);
      const sig = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        data,
      );
      return bufToBase64(sig);
    },
  };
}

async function importStoredAsKey(record: StoredRecord): Promise<AuthorKey> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    record.publicKeyRaw,
    { name: "Ed25519" },
    true,
    ["verify"],
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    record.privateKeyPkcs8,
    { name: "Ed25519" },
    true,
    ["sign"],
  );
  return buildAuthorKeyFromCryptoKeys(
    publicKey,
    privateKey,
    record.createdAt,
  );
}

/**
 * Returns the current author key, generating + persisting a new one on
 * first use. `isNew` lets the UI prompt the user to download a backup.
 */
export async function getOrCreateAuthorKey(): Promise<{
  key: AuthorKey;
  isNew: boolean;
}> {
  if (!(await isCosignSupported())) {
    throw new Error("This browser does not support Ed25519 in WebCrypto");
  }

  const existing = await readStored();
  if (existing) {
    return { key: await importStoredAsKey(existing), isNew: false };
  }

  const kp = (await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const publicKeyRaw = await crypto.subtle.exportKey("raw", kp.publicKey);
  const privateKeyPkcs8 = await crypto.subtle.exportKey(
    "pkcs8",
    kp.privateKey,
  );
  const createdAt = new Date().toISOString();

  await writeStored({
    id: RECORD_ID,
    publicKeyRaw,
    privateKeyPkcs8,
    createdAt,
  });

  return {
    key: await buildAuthorKeyFromCryptoKeys(kp.publicKey, kp.privateKey, createdAt),
    isNew: true,
  };
}

/** Build a backup blob the user can download. Includes the private key. */
export async function exportAuthorKeyBackup(): Promise<AuthorKeyBackup> {
  const stored = await readStored();
  if (!stored) {
    throw new Error("No author key stored — generate one first");
  }
  const fp = await fingerprint(stored.publicKeyRaw);
  return {
    version: 1,
    algo: "ed25519",
    createdAt: stored.createdAt,
    publicKeyBase64: bufToBase64(stored.publicKeyRaw),
    privateKeyPkcs8Base64: bufToBase64(stored.privateKeyPkcs8),
    fingerprint: fp,
  };
}

/** Replace the stored keypair from a backup file. Returns the new key. */
export async function importAuthorKeyBackup(
  backup: AuthorKeyBackup,
): Promise<AuthorKey> {
  if (backup.version !== 1 || backup.algo !== "ed25519") {
    throw new Error("Unsupported backup format");
  }
  const publicKeyRaw = base64ToBuf(backup.publicKeyBase64);
  const privateKeyPkcs8 = base64ToBuf(backup.privateKeyPkcs8Base64);

  // Sanity-check by importing both halves before we overwrite the store.
  await crypto.subtle.importKey(
    "raw",
    publicKeyRaw,
    { name: "Ed25519" },
    true,
    ["verify"],
  );
  await crypto.subtle.importKey(
    "pkcs8",
    privateKeyPkcs8,
    { name: "Ed25519" },
    true,
    ["sign"],
  );

  const createdAt = backup.createdAt || new Date().toISOString();
  await writeStored({
    id: RECORD_ID,
    publicKeyRaw,
    privateKeyPkcs8,
    createdAt,
  });

  const stored = await readStored();
  if (!stored) throw new Error("Failed to persist imported keypair");
  return importStoredAsKey(stored);
}

/** Wipe the stored keypair. Caller must confirm with the user — irreversible. */
export async function deleteAuthorKey(): Promise<void> {
  await clearStored();
}
