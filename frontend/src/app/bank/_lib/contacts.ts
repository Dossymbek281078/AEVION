const CONTACTS_KEY = "aevion_bank_contacts_v1";
const MAX_CONTACTS = 50;

export type Contact = {
  id: string;
  nickname: string;
  lastUsed: number;
};

function isContact(x: unknown): x is Contact {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<Contact>;
  return typeof c.id === "string" && typeof c.nickname === "string" && typeof c.lastUsed === "number";
}

export function listContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isContact).sort((a, b) => b.lastUsed - a.lastUsed);
  } catch {
    return [];
  }
}

export function saveContact(id: string, nickname: string): void {
  if (typeof window === "undefined") return;
  const trimmedId = id.trim();
  const trimmedNick = nickname.trim();
  if (!trimmedId || !trimmedNick) return;
  const current = listContacts();
  const existing = current.find((c) => c.id === trimmedId);
  const next: Contact[] = existing
    ? current.map((c) => (c.id === trimmedId ? { ...c, nickname: trimmedNick, lastUsed: Date.now() } : c))
    : [{ id: trimmedId, nickname: trimmedNick, lastUsed: Date.now() }, ...current];
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(next.slice(0, MAX_CONTACTS)));
  } catch {
    // storage quota — best-effort
  }
}

export function touchContact(id: string): void {
  if (typeof window === "undefined") return;
  const current = listContacts();
  const existing = current.find((c) => c.id === id);
  if (!existing) return;
  const next = current.map((c) => (c.id === id ? { ...c, lastUsed: Date.now() } : c));
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function removeContact(id: string): void {
  if (typeof window === "undefined") return;
  const current = listContacts();
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(current.filter((c) => c.id !== id)));
  } catch {
    // ignore
  }
}

export function contactsById(): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of listContacts()) map.set(c.id, c.nickname);
  return map;
}
