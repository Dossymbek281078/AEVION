// "Circles" — group chats with embedded payment actions. Entirely client-side; backend
// would need websockets / SSE and a messages table.
// TODO backend: POST /api/circles, GET /api/circles/:id/messages, SSE stream.

const STORAGE_KEY = "aevion_bank_circles_v1";
export const CIRCLES_EVENT = "aevion:circles-changed";

export type CircleMember = {
  accountId: string;
  nickname: string;
};

export type CircleMessageKind = "text" | "sent" | "requested";

export type CircleMessage = {
  id: string;
  authorId: string;
  authorNickname: string;
  createdAt: string;
  kind: CircleMessageKind;
  text: string;
  amount?: number;
  recipient?: string;
  memo?: string;
};

export type Circle = {
  id: string;
  name: string;
  createdAt: string;
  members: CircleMember[];
  messages: CircleMessage[];
};

function isMember(x: unknown): x is CircleMember {
  if (!x || typeof x !== "object") return false;
  const m = x as Partial<CircleMember>;
  return typeof m.accountId === "string" && typeof m.nickname === "string";
}

function isMessage(x: unknown): x is CircleMessage {
  if (!x || typeof x !== "object") return false;
  const m = x as Partial<CircleMessage>;
  return (
    typeof m.id === "string" &&
    typeof m.authorId === "string" &&
    typeof m.createdAt === "string" &&
    typeof m.kind === "string" &&
    typeof m.text === "string"
  );
}

function isCircle(x: unknown): x is Circle {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<Circle>;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.createdAt === "string" &&
    Array.isArray(c.members) &&
    c.members.every(isMember) &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage)
  );
}

export function loadCircles(): Circle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isCircle);
  } catch {
    return [];
  }
}

export function saveCircles(items: Circle[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CIRCLES_EVENT));
  } catch {
    // ignore
  }
}
