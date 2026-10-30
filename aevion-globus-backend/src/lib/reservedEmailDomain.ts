/**
 * Адрес на зарезервированном (тестовом) домене: письмо туда не доставляется никогда.
 *
 * Sentry AEVION-BACKEND-1Q, 30.10.2026: подписка с адресом на example.com шла к Resend,
 * тот отвечал «Invalid `to` field… domains like example.com», и это писалось как ошибка
 * сервера. Домены RFC 2606/6761 (example.com/.net/.org, *.example, *.test, *.invalid,
 * *.localhost) и наш test.aevion.dev принимать у провайдера бессмысленно, это не сбой.
 */
const ТОЧНЫЕ = new Set(["example.com", "example.net", "example.org", "test.aevion.dev"]);
const ЗОНЫ = ["example", "test", "invalid", "localhost"];

export function адресНаТестовомДомене(email: string): boolean {
  const s = String(email ?? "").trim().toLowerCase().replace(/>$/, "");
  const at = s.lastIndexOf("@");
  if (at < 0) return false;
  const домен = s.slice(at + 1).replace(/\.$/, "");
  if (!домен) return false;
  for (const т of ТОЧНЫЕ) if (домен === т || домен.endsWith("." + т)) return true;
  const зона = домен.split(".").pop() ?? "";
  return ЗОНЫ.includes(зона);
}
