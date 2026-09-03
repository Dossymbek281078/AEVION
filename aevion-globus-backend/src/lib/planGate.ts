/**
 * Platform-wide module paywall gate.
 *
 * Generalises the constitution Pro gate (lib/constitutionGate.ts) to ALL
 * modules. The policy — "which subscription tier unlocks which module" — is
 * derived from MODULES_PRICING[].includedIn in data/pricing.ts. That is the
 * single source of truth, shared with the public pricing page, so the paywall
 * a user hits can never disagree with what they were sold.
 *
 * SAFETY — dormant by default. A module is only enforced when its id is listed
 * in env PAYWALL_MODULES (comma-separated, or "*" for every module). With the
 * env unset, every requireModule() gate is a transparent no-op: existing free
 * traffic and the prod smoke suite are unaffected until the paywall is
 * deliberately switched on (after the frontend 402 UX + pricing pages ship).
 *
 * Enabling on Railway, once the frontend can render the 402 paywall:
 *   PAYWALL_MODULES=qfusionai,healthai   # gate a curated set
 *   PAYWALL_MODULES=*                    # gate everything priced full-only (blocked below for UNSAFE_TO_GATE ids)
 *   PAYWALL_DISABLED=1                   # global kill-switch (overrides all)
 *
 * UNSAFE_TO_GATE — see the const below. `qcoreai` briefly went live in
 * PAYWALL_MODULES on 2026-07-16 for ~44min via a manual Railway flip that
 * didn't cross-check docs/PAYWALL_FLIP_READINESS.md first; it 402'd free-tier
 * users who hadn't touched their advertised 100k-token/mo quota, since
 * qcoreai's includedIn starts at "medium" and no token-metering exists yet
 * to honor the free promise before falling back to a paid gate. Caught via
 * prod smoke and reverted. `enforcedModuleSet()` now strips these ids
 * defensively — this is a backstop, not a substitute for checking the docs.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyBearerOptional } from "./authJwt";
import { readLatestSubscription } from "../routes/provisioning";
import { MODULES_PRICING, type TierId } from "../data/pricing";
import { recordDeny } from "./paywallDenyLog";
import { hasActiveAppSubscription } from "./appEntitlements";

const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");

/**
 * Modules that must NEVER go behind this blanket, all-or-nothing module gate,
 * regardless of what PAYWALL_MODULES says — each advertises a free-tier
 * promise (a token/request quota, or "1 module of choice") that an immediate
 * 402 on every request would break outright, rather than honoring "first N
 * free, then upgrade".
 *
 * This is PERMANENT, not a placeholder — it is not lifted once some metering
 * ships. qcoreai already has its own metering (`lib/qcoreQuota.ts`,
 * `enforceFreeTokenQuota()`, live since PR #463 / QCOREAI_FREE_QUOTA=1 on
 * Railway) which correctly enforces "100k tokens/mo then 402" — but that is a
 * SEPARATE, more granular mechanism wired directly into qcoreai's routes, not
 * this blanket per-module gate. The right fix for a quota-shaped promise is
 * always a dedicated metering gate like qcoreQuota.ts, never adding the
 * module here to PAYWALL_MODULES — so qcoreai/qright/qsign stay in this set
 * even after (or especially after) proper metering exists for them.
 *
 * Update this list alongside docs/PAYWALL_FLIP_READINESS.md's "Deliberately
 * NOT gated" section — they must stay in sync.
 */
const UNSAFE_TO_GATE = new Set([
  "qcoreai", // free tier promises 100k tokens/mo; includedIn starts at "medium"; no token-metering yet
  "qright",  // same free-tier-promise conflict; includedIn starts at "full"
  "qsign",   // same free-tier-promise conflict; includedIn starts at "full"
]);

const ALLOWLIST = (process.env.PAYWALL_ALLOWLIST || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/* ───── Tier model ──────────────────────────────────────────────── */

/** Canonical, public-facing tiers, ordered low → high. */
export type CanonicalTier = "free" | "lite" | "medium" | "full" | "enterprise";

const TIER_RANK: Record<CanonicalTier, number> = {
  free: 0, lite: 1, medium: 2, full: 3, enterprise: 4,
};

/**
 * Normalise any stored tier id to a canonical tier for gating purposes.
 *
 * `pro` ("Universe") is a real, live, self-serve flagship tier (see TIERS in
 * data/pricing.ts, $149.99/mo) — "all AEVION in one place", so it normalizes
 * to `full` (every module's ceiling short of a negotiated Enterprise
 * contract), NOT `lite`. It used to alias `lite` back when `pro` was a
 * placeholder id with no real tier object behind it; now that it's sold at
 * the top of the ladder, gating it at `lite` would 402 a $149.99/mo customer
 * out of modules a $19/mo Lite customer can already reach — checked and
 * fixed 2026-07-22.
 *
 * `business` is a legacy alias with no live tier object of its own — still
 * written by older Gumroad/LemonSqueezy webhook paths (see provisioning.ts)
 * for subscriptions sold before the current tier lineup — and maps to
 * `full` ("all-access"), matching what those old plans actually granted.
 */
export function normalizeTier(tier: string | null | undefined): CanonicalTier {
  switch ((tier ?? "free").toLowerCase()) {
    case "lite":
      return "lite";
    case "medium":
      return "medium";
    case "full":
    case "pro":
    case "business":
      return "full";
    case "enterprise":
      return "enterprise";
    default:
      return "free";
  }
}

/* ───── Plan resolution ─────────────────────────────────────────── */

export interface ResolvedPlan {
  /** Canonical tier the request is entitled to (module-access gating). */
  tier: CanonicalTier;
  email: string | null;
  /** How the tier was decided — for debugging / the /me/entitlements payload. */
  reason: string;
  /** Modules explicitly chosen on a Lite ("1 of choice") subscription. */
  chosenModules: string[];
  /**
   * The tier id as actually stored/claimed, before normalizeTier() collapses
   * legacy aliases into a canonical tier — e.g. "pro" for a Universe
   * subscriber, where `tier` above reads "full". Needed anywhere that must
   * tell Universe apart from Full (e.g. qcoreQuota.ts's per-tier token cap —
   * Universe advertises 200M tokens/mo, Full 50M, and both normalize to the
   * same canonical "full" for module gating). Falls back to the canonical
   * tier for allowlist/default resolution paths that have no separate raw id.
   */
  rawTier: string;
}

/**
 * Single source of truth for platform plan resolution. Mirrors the priority
 * order of the constitution gate so behaviour is consistent across modules.
 *
 * Priority: env allowlist (full) → JWT payload.plan → active paid
 * subscription (data/subscriptions.jsonl) → free.
 */
export function resolveUserPlan(req: Request): ResolvedPlan {
  return resolvePlanFromPayload(verifyBearerOptional(req) as Record<string, unknown> | null);
}

/**
 * Same resolution as resolveUserPlan, but from an already-verified JWT payload
 * — for callers that don't hold an Express Request (e.g. the QCoreAI
 * WebSocket server, which authenticates via a `?token=` query param).
 */
export function resolvePlanFromPayload(payload: Record<string, unknown> | null): ResolvedPlan {
  const email = payload && typeof payload.email === "string" ? payload.email.toLowerCase() : null;

  if (email && ALLOWLIST.includes(email)) {
    return { tier: "full", rawTier: "full", email, reason: "allowlist", chosenModules: [] };
  }

  // A tier baked into the JWT wins over the subscription store (used for
  // impersonation / comped accounts). Only trust it if it names a real tier.
  if (payload && typeof payload.plan === "string" && payload.plan !== "free") {
    const t = normalizeTier(payload.plan);
    if (t !== "free") return { tier: t, rawTier: payload.plan, email, reason: "jwt-plan", chosenModules: [] };
  }

  if (email) {
    const sub = readLatestSubscription(email);
    if (sub) {
      const expired = sub.validUntil ? new Date(sub.validUntil).getTime() < Date.now() : false;
      if (!expired && sub.tierId !== "free") {
        return {
          tier: normalizeTier(sub.tierId),
          rawTier: sub.tierId,
          email,
          reason: `subscription:${sub.tierId}`,
          chosenModules: Array.isArray(sub.modules) ? sub.modules : [],
        };
      }
    }
  }

  return { tier: "free", rawTier: "free", email, reason: "default", chosenModules: [] };
}

/* ───── Entitlement policy (derived from MODULES_PRICING) ───────── */

const PRICING_BY_ID = new Map(MODULES_PRICING.map((m) => [m.id, m]));

/** Tiers (incl. free) that include this module without an add-on purchase. */
export function tiersForModule(moduleId: string): TierId[] {
  return PRICING_BY_ID.get(moduleId)?.includedIn ?? ["full", "enterprise"];
}

/**
 * Does `plan` grant access to `moduleId`?
 *   - full / enterprise are all-access (the whole ecosystem), always true.
 *   - otherwise the module's `includedIn` must list the canonical tier.
 *   - Lite is "1 product of choice": granted when the module was the one
 *     chosen on the subscription, even if not in `includedIn`.
 */
export function isModuleEntitled(plan: ResolvedPlan, moduleId: string): boolean {
  if (plan.tier === "full" || plan.tier === "enterprise") return true;
  const included = tiersForModule(moduleId).map(normalizeTier);
  if (included.includes(plan.tier)) return true;
  if (plan.tier === "lite" && plan.chosenModules.includes(moduleId)) return true;
  return false;
}

/* ───── Enforcement switch ──────────────────────────────────────── */

let warnedUnsafeGate = false;

/** Logs once per process, not once per request — this fires on every gated call otherwise. */
function warnUnsafeGateAttempt(ids: string[]): void {
  if (warnedUnsafeGate || ids.length === 0) return;
  warnedUnsafeGate = true;
  console.error(
    `[planGate] PAYWALL_MODULES included UNSAFE_TO_GATE module(s) [${ids.join(", ")}] — ` +
      `stripped from enforcement. These have a quota-shaped free promise that the blanket ` +
      `module gate can't honor — use a dedicated metering gate instead (see qcoreQuota.ts for ` +
      `qcoreai); see UNSAFE_TO_GATE in planGate.ts and ` +
      `docs/PAYWALL_FLIP_READINESS.md. Fix the PAYWALL_MODULES env var on Railway.`
  );
}

/**
 * Ни один тариф не даёт доступа к этому модулю.
 *
 * Вынесено на уровень модуля НАМЕРЕННО: правило нужно в ДВУХ местах, и первая
 * редакция закрыла только одно. Список модулей проверялся, а «закрыть всё»
 * (PAYWALL_MODULES=*) шло мимо — сторож поймал это мутацией в тот же час.
 * Одно правило в двух вызовах вместо двух копий, которые разойдутся молча.
 */
function niOdinTarifNeDaet(id: string): boolean {
  // ТОЛЬКО про модули ИЗ КАТАЛОГА. Первая редакция считала «нет в каталоге» за
  // «нет тарифов» — и тем самым переставала закрывать неизвестные
  // идентификаторы под PAYWALL_MODULES=*. Это открывало лишнее вместо того,
  // чтобы защищать: поймал существующий тест planGate, закреплявший прежний
  // договор. Опасность, ради которой правило написано, — модуль, который В
  // КАТАЛОГЕ ЕСТЬ и не входит ни в один тариф.
  const запись = PRICING_BY_ID.get(id);
  if (!запись) return false;
  return (запись.includedIn?.length ?? 0) === 0;
}

function enforcedModuleSet(): Set<string> | "all" | null {
  if (process.env.PAYWALL_DISABLED === "1") return null;
  const raw = (process.env.PAYWALL_MODULES || "").trim();
  if (!raw) return null;
  if (raw === "*") return "all";
  const set = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  /*
   * ВТОРАЯ ПРИЧИНА НЕБЕЗОПАСНОСТИ — ВЫВОДИТСЯ, А НЕ ПЕРЕЧИСЛЯЕТСЯ.
   *
   * Модуль, который не входит НИ В ОДИН тариф (includedIn пуст), закрывать
   * нельзя ни при каких настройках: шлюз потребует тариф из includedIn, а
   * подходящего нет — откажут ВСЕМ, включая платящих. Это хуже, чем «бесплатные
   * получают 402»: доступа не остаётся ни у кого.
   *
   * Живой повод 03.09.2026: у qskyway includedIn пуст по решению основателя
   * («продукт, убирай из тарифов», 02.09). Пока стена выключена, никто не
   * заблокирован — но ровно в тот момент, когда её включат, сработает.
   * В комментариях этого же файла записано, что похожее уже случалось:
   * qcoreai 44 минуты отдавал 402 бесплатным, поймали продовым смоуком.
   *
   * Почему условием, а не строкой в UNSAFE_TO_GATE: список — вторая копия
   * знания, которое уже лежит в каталоге. Выведенное правило покрывает КАЖДЫЙ
   * будущий модуль, а перечисление — только те, о ком вспомнили.
   *
   * Нашло соседнее окно, чинит окно запуска: файл общий, зона денежная.
   */
  // ВТОРОЙ СЛОЙ. Основную защиту несёт проверка в paywallEnabledFor — она
  // пинается мутацией и покрывает в том числе «закрыть всё» (PAYWALL_MODULES=*),
  // мимо которого этот список проходит по устройству. Здесь то же правило
  // повторено, чтобы модуль без тарифов не попадал в набор вовсе: так
  // warnUnsafeGateAttempt назовёт его в журнале, и человек увидит попытку.
  // Снятие ЭТОЙ строки мутацией не ловится намеренно — её работу подстрахует
  // второй слой; снятие второй строки ловится.
  const unsafe = [...set].filter((id) => UNSAFE_TO_GATE.has(id) || niOdinTarifNeDaet(id));
  if (unsafe.length) {
    warnUnsafeGateAttempt(unsafe);
    for (const id of unsafe) set.delete(id);
  }
  return set;
}

/** Is the paywall actively enforced for this module right now? */
export function paywallEnabledFor(moduleId: string): boolean {
  const id = moduleId.toLowerCase();
  if (UNSAFE_TO_GATE.has(id)) return false;
  // Пустой список тарифов небезопасен и при «закрыть всё»: подходящего тарифа
  // нет ни у кого, значит отказ получат ВСЕ, включая платящих.
  if (niOdinTarifNeDaet(id)) return false;
  const set = enforcedModuleSet();
  if (set === null) return false;
  if (set === "all") return true;
  return set.has(id);
}

/**
 * Sub-paths that stay open even on a gated module.
 *
 * Две группы, и вторая появилась 19.08.2026 после замера на проде:
 *
 *   служебные — health, статус, план, провайдеры: без них не понять, что с
 *   модулем, и закрывать их нечего продавать;
 *
 *   сбор адресов — waitlist и subscribe. Лист ожидания по определению для тех,
 *   у кого продукта ЕЩЁ НЕТ. Закрыв его тарифом, мы говорим человеку «купите
 *   Full за $49, чтобы записаться в очередь» — и теряем адрес.
 *
 * Замер, из-за которого правка: POST /api/qfusionai/waitlist отвечал 402
 * upgrade_required, а соседний POST /api/veilnetx/waitlist — 201 и счётчик 11.
 * Разница только в том, что qfusionai попал в PAYWALL_MODULES.
 *
 * Горькая деталь: upgradeResponse() тут же записывает каждый 402 как «сигнал
 * спроса». То есть спрос мы фиксировали, а человека, который его проявил,
 * отправляли ни с чем. Ровно наоборот к тому, ради чего лист ожидания заведён.
 *
 * Границу держим узко: открываем ПОДПИСКУ на будущее, а не выдачу продукта.
 * Всё, что отдаёт функциональность, остаётся за тарифом.
 */
function isExemptPath(req: Request): boolean {
  if (req.method === "OPTIONS") return true;
  const p = req.path.toLowerCase();
  return (
    p === "/health" || p.endsWith("/health") ||
    p === "/me/plan" || p.endsWith("/me/plan") ||
    p === "/me/entitlements" || p.endsWith("/me/entitlements") ||
    p === "/providers" || p.endsWith("/providers") ||
    p === "/status" || p.endsWith("/status") ||
    p === "/waitlist" || p.endsWith("/waitlist") ||
    p === "/subscribe" || p.endsWith("/subscribe")
  );
}

function upgradeResponse(res: Response, moduleId: string, plan: ResolvedPlan): void {
  const requiredTiers = tiersForModule(moduleId).map(normalizeTier)
    .filter((t) => TIER_RANK[t] > TIER_RANK.free);
  // Demand signal: every 402 is someone who WANTED a paid module. Aggregate-
  // only (module + tier, no user id), fire-and-forget — see paywallDenyLog.
  recordDeny(moduleId, plan.tier);
  res.status(402).json({
    error: "upgrade_required",
    module: moduleId,
    plan: plan.tier,
    requiredTiers: requiredTiers.length ? requiredTiers : ["full"],
    upgradeUrl: `${PUBLIC_BASE}/pricing`,
    message: `Модуль «${moduleId}» доступен на тарифах: ${requiredTiers.join(", ") || "full"}. Upgrade → ${PUBLIC_BASE}/pricing`,
  });
}

/**
 * Middleware factory: gate a module's routes behind its required tier.
 *
 * Usage (mount-level, no edits inside the module's route file):
 *   app.use("/api/qcoreai", requireModule("qcoreai"), qcoreaiRouter);
 *
 * No-op unless the module is listed in PAYWALL_MODULES, so attaching it is
 * always safe; flip the env to switch enforcement on.
 */
export function requireModule(moduleId: string) {
  return async function moduleGate(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!paywallEnabledFor(moduleId)) { next(); return; }
    if (isExemptPath(req)) { next(); return; }
    const plan = resolveUserPlan(req);
    if (isModuleEntitled(plan, moduleId)) { next(); return; }

    // Модуль мог быть куплен ОТДЕЛЬНОЙ подпиской — это второй источник прав,
    // до 13.08.2026 гейт про него не знал, и купивший модуль упирался в отказ
    // наравне с гостем. Спрашиваем базу только здесь: до этой строки доходят
    // лишь те, кому иначе отказали бы, поэтому обычный путь остаётся без
    // запросов. Права только добавляются — отнять этот источник ничего не может.
    if (await hasActiveAppSubscription(plan.email, moduleId)) { next(); return; }

    upgradeResponse(res, moduleId, plan);
  };
}

/* ───── Introspection (for GET /api/me/entitlements & /paywall/policy) ── */

export interface ModuleEntitlement {
  module: string;
  /** Tiers that unlock the module (canonical, excluding free). */
  requiredTiers: CanonicalTier[];
  /** Whether the current plan can access it. */
  entitled: boolean;
  /** Whether the paywall is actively enforced for this module right now. */
  enforced: boolean;
}

/** Full per-module entitlement map for the resolved request plan. */
export function getEntitlements(req: Request): {
  plan: CanonicalTier;
  email: string | null;
  reason: string;
  modules: ModuleEntitlement[];
} {
  const plan = resolveUserPlan(req);
  const modules: ModuleEntitlement[] = MODULES_PRICING.map((m) => ({
    module: m.id,
    requiredTiers: tiersForModule(m.id).map(normalizeTier)
      .filter((t) => TIER_RANK[t] > TIER_RANK.free),
    entitled: isModuleEntitled(plan, m.id),
    enforced: paywallEnabledFor(m.id),
  }));
  return { plan: plan.tier, email: plan.email, reason: plan.reason, modules };
}
