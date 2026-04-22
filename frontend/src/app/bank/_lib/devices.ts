// Device / session list. Real per-device tracking needs backend (sessions table on
// server keyed by JWT jti). For demo we fingerprint the current browser and persist
// it locally; other devices are seeded mocks so the UI looks populated.
//
// TODO backend: GET /api/auth/sessions, DELETE /api/auth/sessions/:id, signed cookies
// per device with expiry; revoke = invalidate JWT.

import { pick, seeded } from "./random";

const STORAGE_KEY = "aevion_bank_devices_v1";

export type Device = {
  id: string;
  browser: string;
  os: string;
  screen: string;
  language: string;
  timezone: string;
  location: string;
  firstSeenAt: string;
  lastActiveAt: string;
  current: boolean;
};

function isDevice(x: unknown): x is Device {
  if (!x || typeof x !== "object") return false;
  const d = x as Partial<Device>;
  return (
    typeof d.id === "string" &&
    typeof d.browser === "string" &&
    typeof d.os === "string" &&
    typeof d.firstSeenAt === "string" &&
    typeof d.lastActiveAt === "string"
  );
}

function parseUA(ua: string): { browser: string; os: string } {
  let browser = "Unknown";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

function fingerprintCurrent(): Omit<Device, "id" | "firstSeenAt" | "lastActiveAt"> | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const { browser, os } = parseUA(navigator.userAgent || "");
  const screen = `${window.screen?.width ?? 0}×${window.screen?.height ?? 0}`;
  const language = navigator.language || "—";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    browser,
    os,
    screen,
    language,
    timezone,
    location: timezone.split("/")[1]?.replace(/_/g, " ") || timezone,
    current: true,
  };
}

function loadRaw(): Device[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isDevice);
  } catch {
    return [];
  }
}

function saveRaw(items: Device[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function deviceKey(d: Pick<Device, "browser" | "os" | "screen" | "language">): string {
  return `dev_${d.browser}_${d.os}_${d.screen}_${d.language}`.replace(/\s+/g, "");
}

function seedMockDevices(accountId: string, currentTzCity: string): Device[] {
  const rand = seeded(`${accountId}:devices`);
  const now = Date.now();
  const candidates: Array<Pick<Device, "browser" | "os" | "screen" | "language" | "timezone" | "location">> = [
    { browser: "Mobile Safari", os: "iOS", screen: "390×844", language: "en-US", timezone: "Asia/Almaty", location: currentTzCity || "Almaty" },
    { browser: "Chrome", os: "Android", screen: "412×915", language: "en-US", timezone: "Asia/Almaty", location: currentTzCity || "Almaty" },
    { browser: "Safari", os: "macOS", screen: "1512×982", language: "en-US", timezone: "Asia/Almaty", location: currentTzCity || "Almaty" },
  ];
  const count = 1 + Math.floor(rand() * 2);
  return Array.from({ length: count }, (_, i) => {
    const meta = pick(candidates, rand);
    const ageDays = 1 + Math.floor(rand() * 14);
    const lastHrs = 1 + Math.floor(rand() * 36);
    return {
      id: `${deviceKey(meta)}_seed${i}`,
      ...meta,
      firstSeenAt: new Date(now - ageDays * 86_400_000).toISOString(),
      lastActiveAt: new Date(now - lastHrs * 3600_000).toISOString(),
      current: false,
    };
  });
}

export function registerCurrentDevice(accountId: string): Device[] {
  const fp = fingerprintCurrent();
  const now = new Date().toISOString();
  const stored = loadRaw();

  if (!fp) return stored;

  const id = deviceKey(fp);
  const existing = stored.find((d) => d.id === id);

  let next: Device[];
  if (existing) {
    next = stored.map((d) =>
      d.id === id ? { ...d, ...fp, current: true, lastActiveAt: now } : { ...d, current: false },
    );
  } else {
    const cur: Device = {
      id,
      ...fp,
      firstSeenAt: now,
      lastActiveAt: now,
    };
    next = [cur, ...stored.map((d) => ({ ...d, current: false }))];
  }

  if (next.filter((d) => !d.current).length === 0) {
    next = [...next, ...seedMockDevices(accountId, fp.location)];
  }

  saveRaw(next);
  return next;
}

export function listDevices(): Device[] {
  return loadRaw();
}

export function revokeDevice(id: string): Device[] {
  const stored = loadRaw();
  const target = stored.find((d) => d.id === id);
  if (!target || target.current) return stored;
  const next = stored.filter((d) => d.id !== id);
  saveRaw(next);
  return next;
}

export function clearDevices(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
