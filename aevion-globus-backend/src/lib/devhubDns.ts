/**
 * Адреса сайтов DevHub: <slug>.<зона> → <проект>.pages.dev.
 *
 * Решение основателя 15.09.2026: зона — `aevion.app`. До этого код выдавал
 * `<slug>.aevion.build` и писал CNAME в зону Cloudflare, а зоны aevion.build в
 * аккаунте Cloudflare больше нет — каждый выданный адрес не разрешался, и
 * возможность «домен» честно стояла not_available с 28.08.
 *
 * DNS домена aevion.app живёт у Vercel (ns1/ns2.vercel-dns.com; 17 записей,
 * включая почту ImprovMX/Brevo/Resend и api → Railway). Переносить зону в
 * Cloudflare ради одной записи значило бы трогать сайт и почту. Поэтому
 * поставщиков два за одним интерфейсом:
 *   vercel     — записи через Vercel DNS API (токен VERCEL_API_TOKEN уже стоит);
 *   cloudflare — прежний путь, остаётся для зоны в Cloudflare.
 *
 * Выбор явный (DEVHUB_DNS_PROVIDER), иначе по наличию ключей: Cloudflare, если
 * задана его зона, — чтобы существующие тесты и старые окружения не сменили
 * поведение молча; Vercel, если есть только его токен.
 *
 * Регистрация того же домена у Cloudflare Pages (шаг 4a выкатки) остаётся в
 * routes/devhub.ts: она про Pages, а не про DNS, и не зависит от того, где зона.
 */

export type DnsProvider = "vercel" | "cloudflare" | null;

export type UpsertResult =
  | { ok: true; action: "created" | "updated" | "already-configured"; recordId: string }
  | { ok: false; error: string };

export type ZoneProbe = { name: string; ok: boolean; detail: string };

export function siteZone(): string {
  return (process.env.DEVHUB_SITE_ZONE || "aevion.app").trim().toLowerCase().replace(/\.$/, "");
}

export function dnsProvider(): DnsProvider {
  const explicit = (process.env.DEVHUB_DNS_PROVIDER || "").trim().toLowerCase();
  if (explicit === "vercel" || explicit === "cloudflare") return explicit;
  if (process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN) return "cloudflare";
  if (process.env.VERCEL_API_TOKEN) return "vercel";
  return null;
}

export function dnsConfigured(): boolean {
  const p = dnsProvider();
  if (p === "vercel") return Boolean(process.env.VERCEL_API_TOKEN);
  if (p === "cloudflare") return Boolean(process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN);
  return false;
}

/** Какие переменные нужны выбранному поставщику — для подсказки в списке возможностей. */
export function dnsTokensNeeded(): string[] {
  const p = dnsProvider();
  if (p === "vercel") return ["VERCEL_API_TOKEN"];
  return ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"];
}

/** Имя пробы в /providers/health — зависит от поставщика, чтобы сводка называла, КТО не отвечает. */
export function zoneProbeName(): string {
  return dnsProvider() === "vercel" ? "vercel_dns" : "cloudflare_zone";
}

function stripDot(v: string): string {
  return String(v || "").replace(/\.$/, "").toLowerCase();
}

/** Метка записи внутри зоны: `app-x.aevion.app` → `app-x`; сама зона → `@`; чужой домен → null. */
export function labelInZone(fqdn: string): string | null {
  const zone = siteZone();
  const host = stripDot(fqdn);
  if (host === zone) return "@";
  if (host.endsWith("." + zone)) return host.slice(0, host.length - zone.length - 1);
  return null;
}

/**
 * Имя, которое DevHub выдаёт сам: <slug>-<6 hex id проекта>. ТОЛЬКО такие метки
 * пишутся в зону. Найдено окном приёмки 15.09.2026: гость без входа мог записать
 * проекту customDomain «api.aevion.app», позвать auto-setup — и upsertCname удалил
 * бы CNAME `api` (весь бэкенд) ради своей записи; так же уязвимы brevo1/2._domainkey.
 * Служебные имена (`@`, с `_`, с точкой) под этот формат не подходят никогда.
 */
export const DEVHUB_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{6}$/;

export function isDevHubLabel(label: string): boolean {
  return DEVHUB_LABEL_RE.test(label);
}

/** Цель, которую ставит сам DevHub. Запись с другой целью — чужая, её не трогаем. */
export function isOurTarget(value: string): boolean {
  const v = stripDot(value);
  return v.endsWith(".pages.dev") || v.endsWith(".vercel.app") || v === `devhub.${siteZone()}`;
}

/** Почему запись писать нельзя; null — можно. Проверяется ДО любого запроса к поставщику. */
export function cnameWriteRefusal(fqdn: string, target: string): string | null {
  const zone = siteZone();
  const label = labelInZone(fqdn);
  if (label === null) return `${fqdn} is outside the ${zone} zone — DevHub writes only its own <slug>-<id>.${zone} names; an external domain is configured at its registrar`;
  if (!isDevHubLabel(label)) return `${fqdn} is not a DevHub-issued name (expected <slug>-<6 hex>.${zone}) — reserved and service records are never written`;
  if (!isOurTarget(target)) return `target ${target} is not a DevHub destination (*.pages.dev, *.vercel.app or devhub.${zone})`;
  return null;
}
// ───── Vercel ────────────────────────────────────────────────────────────────

type VercelRecord = { id: string; name: string; type: string; value: string };

function vercelHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json" };
}

async function upsertVercel(fqdn: string, target: string): Promise<UpsertResult> {
  const zone = siteZone();
  const label = labelInZone(fqdn);
  if (label === null) {
    return { ok: false, error: `${fqdn} is outside the ${zone} zone — Vercel DNS can only hold records of our own zone` };
  }
  const want = stripDot(target);
  const base = `https://api.vercel.com/v2/domains/${zone}/records`;

  const listResp = await fetch(`https://api.vercel.com/v4/domains/${zone}/records?limit=100`, { headers: vercelHeaders() });
  if (!listResp.ok) {
    const t = await listResp.text().catch(() => "");
    return { ok: false, error: `Vercel DNS list refused (${listResp.status}): ${t.slice(0, 200)}` };
  }
  const listData = (await listResp.json()) as { records?: VercelRecord[] };
  const existing = (listData.records || []).find((r) => r.type === "CNAME" && stripDot(r.name) === label);

  if (existing && stripDot(existing.value) === want) {
    return { ok: true, action: "already-configured", recordId: existing.id };
  }
  // У Vercel нет «заменить значение» с гарантированной формой ответа во всех
  // версиях API, зато удаление и создание задокументированы одинаково. Порядок:
  // сперва создать нельзя (дубль CNAME отвергается), поэтому удалить → создать.
  if (existing && !isOurTarget(existing.value)) {
    return { ok: false, error: `${fqdn} already exists and points elsewhere (${stripDot(existing.value)}) — not a DevHub record, refusing to replace it` };
  }
  if (existing) {
    const delResp = await fetch(`${base}/${existing.id}`, { method: "DELETE", headers: vercelHeaders() });
    if (!delResp.ok && delResp.status !== 404) {
      const t = await delResp.text().catch(() => "");
      return { ok: false, error: `Vercel DNS delete refused (${delResp.status}): ${t.slice(0, 200)}` };
    }
  }
  const createResp = await fetch(base, {
    method: "POST",
    headers: vercelHeaders(),
    body: JSON.stringify({ name: label, type: "CNAME", value: want, ttl: 60 }),
  });
  if (!createResp.ok) {
    const t = await createResp.text().catch(() => "");
    return { ok: false, error: `Vercel DNS create refused (${createResp.status}): ${t.slice(0, 200)}` };
  }
  const created = (await createResp.json().catch(() => ({}))) as { uid?: string; id?: string };
  return { ok: true, action: existing ? "updated" : "created", recordId: String(created.uid || created.id || "") };
}

/** Зона у Vercel: домен подтверждён и его NS совпадают с ожидаемыми. Отказ сети → null («не знаю»). */
async function vercelZoneActive(): Promise<boolean | null> {
  const zone = siteZone();
  const r = await fetch(`https://api.vercel.com/v5/domains/${zone}`, { headers: vercelHeaders() });
  if (!r.ok) return false;
  const b = (await r.json().catch(() => ({}))) as {
    domain?: { verified?: boolean; nameservers?: string[]; intendedNameservers?: string[] };
  };
  const d = b.domain;
  if (!d) return false;
  const ns = (d.nameservers || []).map(stripDot).sort();
  const want = (d.intendedNameservers || []).map(stripDot).sort();
  const nsOk = want.length === 0 || (ns.length === want.length && ns.every((x, i) => x === want[i]));
  return d.verified === true && nsOk;
}

// ───── Cloudflare (прежний путь) ─────────────────────────────────────────────

function cfHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };
}

async function upsertCloudflare(fqdn: string, target: string): Promise<UpsertResult> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
  const listResp = await fetch(`${base}?type=CNAME&name=${encodeURIComponent(fqdn)}`, { headers: cfHeaders() });
  if (!listResp.ok) {
    const t = await listResp.text().catch(() => "");
    return { ok: false, error: `Cloudflare list error (${listResp.status}): ${t.slice(0, 200)}` };
  }
  const listData = (await listResp.json()) as { result?: Array<{ id: string; content: string }> };
  const existing = listData.result?.[0];
  if (existing && stripDot(existing.content) === stripDot(target)) {
    return { ok: true, action: "already-configured", recordId: existing.id };
  }
  if (existing && !isOurTarget(existing.content)) {
    return { ok: false, error: `${fqdn} already exists and points elsewhere (${stripDot(existing.content)}) — not a DevHub record, refusing to replace it` };
  }
  const body = JSON.stringify({ type: "CNAME", name: fqdn, content: target, ttl: 1, proxied: true });
  const resp = existing
    ? await fetch(`${base}/${existing.id}`, { method: "PUT", headers: cfHeaders(), body })
    : await fetch(base, { method: "POST", headers: cfHeaders(), body });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    return { ok: false, error: `Cloudflare ${existing ? "update" : "create"} error (${resp.status}): ${t.slice(0, 200)}` };
  }
  const data = (await resp.json().catch(() => ({}))) as { success?: boolean; result?: { id?: string }; errors?: Array<{ message: string }> };
  if (data.success === false) {
    return { ok: false, error: data.errors?.[0]?.message ?? "Cloudflare DNS error" };
  }
  return { ok: true, action: existing ? "updated" : "created", recordId: String(data.result?.id || existing?.id || "") };
}

async function cloudflareZoneStatus(): Promise<string | null> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
  });
  const b = (await r.json().catch(() => ({}))) as { result?: { status?: string } };
  return b?.result?.status ?? null;
}

// ───── Общий интерфейс ───────────────────────────────────────────────────────

export async function upsertCname(fqdn: string, target: string): Promise<UpsertResult> {
  const refusal = cnameWriteRefusal(fqdn, target);
  if (refusal) return { ok: false, error: refusal };
  const p = dnsProvider();
  if (p === "vercel") {
    if (!process.env.VERCEL_API_TOKEN) return { ok: false, error: "VERCEL_API_TOKEN not set" };
    return upsertVercel(fqdn, target);
  }
  if (p === "cloudflare") {
    if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      return { ok: false, error: "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID not set" };
    }
    return upsertCloudflare(fqdn, target);
  }
  return { ok: false, error: "DNS provider not configured" };
}

/**
 * Готова ли зона: true — адреса разрешаются; false — поставщик ответил «нет»;
 * null — спросить не удалось (это НЕ «нет»: сетевая икота не должна выключать
 * работающую возможность). Кэш живёт у вызывающего.
 */
export async function zoneActiveUncached(): Promise<boolean | null> {
  const p = dnsProvider();
  try {
    if (p === "vercel") return await vercelZoneActive();
    if (p === "cloudflare") return (await cloudflareZoneStatus()) === "active";
    return null;
  } catch {
    return null;
  }
}

/** Проба для /providers/health — имя зависит от поставщика. */
export async function zoneProbe(): Promise<ZoneProbe> {
  const p = dnsProvider();
  const name = zoneProbeName();
  try {
    if (p === "vercel") {
      if (!process.env.VERCEL_API_TOKEN) return { name, ok: false, detail: "VERCEL_API_TOKEN not set" };
      const active = await vercelZoneActive();
      return { name, ok: active === true, detail: active ? `zone ${siteZone()} verified at Vercel` : `zone ${siteZone()} not verified at Vercel` };
    }
    if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      return { name, ok: false, detail: "CLOUDFLARE_ZONE_ID not set" };
    }
    const status = await cloudflareZoneStatus();
    return { name, ok: status === "active", detail: `zone status: ${status ?? "unknown"}` };
  } catch (e: unknown) {
    return { name, ok: false, detail: (e instanceof Error ? e.message : "request failed").slice(0, 120) };
  }
}
