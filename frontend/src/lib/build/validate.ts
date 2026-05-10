// Shared client-side validators for QBuild forms.
// Server is the source of truth — these only catch obvious typos
// and let us keep submit buttons disabled until input looks plausible.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 5 || trimmed.length > 200) return false;
  return EMAIL_RE.test(trimmed);
}

export function emailError(s: string): string | null {
  if (!s.trim()) return null;
  return isEmail(s) ? null : "Looks like an invalid email";
}

const PHONE_DIGITS_RE = /\d/g;

export function normalizePhone(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = (trimmed.match(PHONE_DIGITS_RE) || []).join("");
  return (hasPlus ? "+" : "") + digits;
}

export function isPhone(s: string): boolean {
  if (!s.trim()) return true; // empty = optional
  const n = normalizePhone(s);
  const digits = n.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function phoneError(s: string): string | null {
  if (!s.trim()) return null;
  return isPhone(s) ? null : "Phone needs 7–15 digits, e.g. +1 415 555 0100";
}
