/**
 * AEVION Fan — веерные скидки («купил один продукт → подешевела вся планета»).
 *
 * Идея взята с Higgsfield (замерено через их MCP-биллинг 2026-07-26, см.
 * docs/FAN_DISCOUNTS_2026-07.md — там таблица их реальных чисел): одна покупка
 * не даёт один товар, она *радиирует* ценность по всему каталогу — разной
 * глубиной и на ограниченный срок. У них это «365-DAY UNLIMITED» на 7 моделей
 * + «7-Day Unlimited» на 2-3 самые горячие + лестница объёма (39%→42%→44%).
 *
 * У AEVION 40+ модулей и другая экономика (нет амортизированного GPU-парка,
 * есть реальный per-token/per-render COGS), поэтому веер здесь —
 * **скидка на соседние модули**, а не «unlimited»:
 *
 *   ring 1 (прямой комплемент)  −30% → до −45%  ← тот же suite/кластер
 *   ring 2 (тот же домен)       −15% → до −30%  ← ≥1 общий тег в projects.ts
 *   ring 3 (остальная планета)    0%            ← прайс, скидки нет
 *
 * Каждый следующий купленный модуль поднимает уровень веера и добавляет
 * +5 п.п. кольцам 1-2 (до 5-го уровня). Потолков три, все обязательные:
 * потолок кольца (FAN_RING_CAP) → общий потолок скидок
 * (MAX_PROMO_DISCOUNT_RATIO, тот же, что у промокодов: два независимых
 * потолка неизбежно разъедутся) → потолок COGS для модулей, которые платят за
 * каждый вызов (FAN_COGS_SENSITIVE_MAX_RATIO).
 *
 * Окно: FAN_WINDOW_DAYS от последней покупки. Каждая новая покупка окно
 * обновляет — это и есть удерживающая петля (у Higgsfield ту же роль играет
 * «Buy until <дата>» и 90-дневное истечение топ-апов).
 *
 * ЧЕГО ЗДЕСЬ НЕТ (осознанно):
 *   - Веер НЕ применяется к платформенным тарифам (Lite/Medium/Full/Universe).
 *     По docs/PRICING_STRATEGY_2026-07.md бандл-тарифы стоят ВЫШЕ топовых
 *     планов конкурентов намеренно; скидывать их веером — противоречить
 *     собственной стратегии. Веер работает только на à-la-carte модулях.
 *   - Веер НЕ даёт «unlimited» ни на один AI-модуль. Причина в том же доке:
 *     per-token COGS реален, а сабкапы (QCOREAI_TIER_QUOTA /
 *     QCOREAI_PREMIUM_QUOTA) до сих пор dormant.
 *
 * Почему движок лежит здесь, а не внутри buildQuote(): data/pricing.ts не
 * импортирует этот файл — иначе получится циклический импорт. Единственная
 * точка, где веер накатывается на смету, — buildQuoteWithFan() ниже; и
 * routes/pricing.ts, и routes/checkout.ts обязаны звать именно её, чтобы
 * «смета == списание» держалось по построению, а не по внимательности.
 */

import {
  BUNDLES,
  CURRENCY_RATES,
  MAX_PROMO_DISCOUNT_RATIO,
  MODULES_PRICING,
  buildQuote,
  getModulePrice,
  getTier,
  type BillingPeriod,
  type CurrencyCode,
  type Quote,
  type TierId,
} from "./pricing";
import { projects } from "./projects";

/* ───── Параметры веера (единственное место, где их можно менять) ───── */

export type FanRing = 1 | 2 | 3;

/**
 * Базовая скидка кольца на 1-м уровне веера (доля, не проценты).
 *
 * ring 3 = 0 намеренно. Первый прогон на живом каталоге (2026-07-26) дал при
 * уровне 1: ring1 — 3 модуля, ring2 — 1, ring3 — 27. То есть «скидка −10% на
 * всё» превращала прайс 27 модулей в фикцию и делала распродажу вечной. Веер
 * должен бить точно: глубоко по прямым комплементам, умеренно по домену,
 * никак — по остальной планете. ring3 остаётся как ЯВНОЕ «здесь скидки нет»
 * (и как место, куда падает модуль, если таксономия не знает его связей).
 */
export const FAN_RING_BASE: Record<FanRing, number> = { 1: 0.3, 2: 0.15, 3: 0 };

/** Потолок КОЛЬЦА (сверх общего потолка): дальше лестница уровней не тянет. */
export const FAN_RING_CAP: Record<FanRing, number> = { 1: 0.45, 2: 0.3, 3: 0 };

/** +5 п.п. каждому кольцу за каждый купленный модуль сверх первого. */
export const FAN_LEVEL_STEP = 0.05;

/** Дальше 5-го уровня лестница не растёт (и всё равно упёрлась бы в потолок). */
export const FAN_MAX_LEVEL = 5;

/** Дней от последней покупки, пока веер активен. */
export const FAN_WINDOW_DAYS = 14;

/**
 * Потолок веера = потолок промокодов. Один и тот же number намеренно:
 * checkout уже ловил баг, где скидка обнуляла тариф (TEAM100, 2026-07-23),
 * и второй независимый потолок — приглашение повторить это.
 */
export const FAN_MAX_DISCOUNT_RATIO = MAX_PROMO_DISCOUNT_RATIO;

/**
 * Максимальная веерная скидка для модулей с РЕАЛЬНЫМ переменным COGS.
 *
 * Почему отдельный, более низкий потолок: docs/PRICING_STRATEGY_2026-07.md
 * фиксирует, что оба токенных гейта (`QCOREAI_TIER_QUOTA`,
 * `QCOREAI_PREMIUM_QUOTA`) до сих пор **dormant**, а у multi-agent
 * оркестратора сабкап премиум-моделей вообще не подключён. Пока нижняя
 * граница расхода не защищена в рантайме, скидка −45..50% на модуль, который
 * платит за токены/рендеры, может уводить конкретного подписчика в минус —
 * и мы этого даже не увидим, потому что per-модульный COGS никто не измерял.
 *
 * 0.30 — не измеренная величина, а осознанно консервативная граница «пока не
 * измерено». Как только появятся (а) измеренный per-модуль COGS и (б)
 * включённые сабкапы — эту константу можно поднимать, но по замеру, а не «на
 * глаз». Не убирать раньше, чем выполнены оба пункта.
 */
export const FAN_COGS_SENSITIVE_MAX_RATIO = 0.3;

/**
 * Модули, чья себестоимость растёт с использованием (LLM-токены, рендеры).
 * Всё это в итоге дёргает QCoreAI-флот или fal.ai, т.е. платит за каждый
 * вызов. Список держим явным, а не «по тегу ai», чтобы добавление тега не
 * меняло молча цену.
 */
export const FAN_COGS_SENSITIVE = new Set<string>([
  "qcoreai",
  "multichat-engine",
  "qfusionai",
  "qai",
  "qpersona",
  "qreal",
  "qbuild",
  "kids-ai-content",
  "healthai",
  "qlearn",
  "qnews",
  "qmedia",
  "smeta-trainer",
  "qgood",
  "psyapp-deps",
]);

/**
 * Ручные кластеры «прямых комплементов» (ring 1) — поверх BUNDLES.
 *
 * BUNDLES + общие теги projects.ts дают базовую близость, но теги местами
 * слишком общие («ai» висит на 15 модулях) и местами отсутствуют вовсе
 * (qmelanin/qrenew в MODULES_PRICING есть, строки в projects.ts нет — это
 * известный дефект, его ловит scripts/projects-pricing-audit.js). Здесь —
 * только пары, где комплементарность реальная и проверяемая продуктом.
 * Кластеры могут пересекаться; итог — объединение пар.
 */
export const FAN_EXTRA_CLUSTERS: Array<{ id: string; why: string; modules: string[] }> = [
  {
    id: "longevity",
    why: "Один контур измерения/замедления старения: биомаркеры → протокол → тренер",
    modules: ["healthai", "qlife", "qmelanin", "qrenew"],
  },
  {
    id: "mental",
    why: "Психика/зависимости — общий терапевтический контур",
    modules: ["qgood", "psyapp-deps"],
  },
  {
    id: "education",
    why: "Обучающий контур: курсы + профильный тренажёр + детский контент",
    modules: ["qlearn", "smeta-trainer", "kids-ai-content"],
  },
  {
    id: "media-production",
    why: "Производство контента: видео-студия → медиатека → голос/музыка",
    modules: ["qreal", "qmedia", "voice-of-earth"],
  },
  {
    id: "docs-ip",
    why: "Документы и права: реестр → подпись → бюро → договор",
    modules: ["qright", "qsign", "aevion-ip-bureau", "qcontract"],
  },
  {
    id: "money-rails",
    why: "Платёжные рельсы: эквайринг → карта → витрина",
    modules: ["qpaynet-embedded", "qmaskcard", "qstore"],
  },
  {
    id: "privacy",
    why: "Приватность/хранение: сеть → сеть → сейф",
    modules: ["veilnetx", "shadownet", "lifebox"],
  },
  {
    id: "ai-core",
    why: "AI-ядро: движок → мультичат → роутер → персона",
    modules: ["qcoreai", "multichat-engine", "qfusionai", "qpersona"],
  },
  {
    id: "venture",
    why: "Стройка бизнеса: найм/сборка → биржа стартапов → венчурный анализ",
    modules: ["qbuild", "startup-exchange", "qventure"],
  },
  {
    id: "governance",
    why: "Управление обществом: симулятор конституции → DAO-механика",
    modules: ["constitution", "qchaingov"],
  },
  {
    id: "play",
    why: "Игра как контур: партии → турниры/события → обучение теории",
    modules: ["cyberchess", "qevents", "qlearn"],
  },
  {
    id: "focus",
    why: "Внимание и привычки: фокус-режим → работа с зависимостями",
    modules: ["deepsan", "psyapp-deps"],
  },
];

/**
 * Платные модули, у которых веер (ring 1) законно пуст — «одиночки».
 * Список нужен как канарейка в тестах: если модуль выпал из веера НЕ по этой
 * причине, а потому что его сосед по кластеру остался без цены, это надо
 * увидеть, а не проглотить.
 *
 * Замер 2026-07-26: `lifebox` (кластер privacy) и `constitution` (кластер
 * governance) остались без ring 1 именно так — их соседи veilnetx/shadownet/
 * qchaingov имеют `addonMonthly: null`, то есть купить их нельзя ничем, и в
 * веер они не попадают. Это не дефект веера, это дефект прайса: 8 из 43
 * модулей не продаются à-la-carte вообще (см. docs/FAN_DISCOUNTS_2026-07.md §6).
 * Как только соседи получат цену — этих двух надо убрать отсюда.
 */
export const FAN_KNOWN_LONERS = new Set<string>(["lifebox", "constitution"]);

/* ───── Индексы (строятся лениво: MODULES_PRICING приходит из pricing.ts) ───── */

let tagIndex: Map<string, Set<string>> | null = null;
let clusterIndex: Map<string, Set<string>> | null = null;

function tagsOf(moduleId: string): Set<string> {
  if (!tagIndex) {
    tagIndex = new Map();
    for (const p of projects) tagIndex.set(p.id, new Set(p.tags ?? []));
  }
  return tagIndex.get(moduleId) ?? new Set();
}

/** id → множество модулей, лежащих с ним в одном кластере (BUNDLES + ручные). */
function clusterMatesOf(moduleId: string): Set<string> {
  if (!clusterIndex) {
    clusterIndex = new Map();
    const groups: string[][] = [
      ...BUNDLES.map((b) => b.modules),
      ...FAN_EXTRA_CLUSTERS.map((c) => c.modules),
    ];
    for (const group of groups) {
      for (const id of group) {
        const set = clusterIndex.get(id) ?? new Set<string>();
        for (const other of group) if (other !== id) set.add(other);
        clusterIndex.set(id, set);
      }
    }
  }
  return clusterIndex.get(moduleId) ?? new Set();
}

/** Только для тестов/скриптов: сбросить ленивые индексы. */
export function __resetFanIndexes(): void {
  tagIndex = null;
  clusterIndex = null;
}

/* ───── Кольца ───── */

export interface FanRingResolution {
  ring: FanRing;
  /** Модуль-владелец, который дал кандидату это кольцо. */
  anchor: string | null;
  reason: string;
}

/**
 * Кольцо кандидата относительно набора уже купленных модулей.
 *   ring 1 — общий кластер (BUNDLES/FAN_EXTRA_CLUSTERS) ИЛИ ≥2 общих тега
 *   ring 2 — ≥1 общий тег
 *   ring 3 — всё остальное
 * Берём лучшее (минимальное) кольцо по всем владельцам.
 */
export function resolveRing(candidateId: string, ownedIds: string[]): FanRingResolution {
  let best: FanRingResolution = { ring: 3, anchor: null, reason: "остальная планета" };
  const candTags = tagsOf(candidateId);
  const mates = clusterMatesOf(candidateId);

  for (const owned of ownedIds) {
    if (owned === candidateId) continue;
    if (mates.has(owned)) {
      return { ring: 1, anchor: owned, reason: `один контур с ${owned}` };
    }
    const shared = [...tagsOf(owned)].filter((t) => candTags.has(t));
    if (shared.length >= 2) {
      return { ring: 1, anchor: owned, reason: `общие теги с ${owned}: ${shared.join(", ")}` };
    }
    if (shared.length === 1 && best.ring > 2) {
      best = { ring: 2, anchor: owned, reason: `общий домен с ${owned}: ${shared[0]}` };
    }
  }
  return best;
}

/* ───── Состояние веера ───── */

export type FanStatus = "active" | "expired" | "inactive";

export interface FanOffer {
  module: string;
  ring: FanRing;
  anchor: string | null;
  reason: string;
  listMonthly: number;
  discountRatio: number;
  discountPercent: number;
  /** Цена модуля в месяц с веерной скидкой, в запрошенной валюте. */
  priceMonthly: number;
  savingMonthly: number;
  availability: string;
  /** true — скидка урезана потолком COGS (FAN_COGS_SENSITIVE_MAX_RATIO). */
  cogsCapped: boolean;
}

export interface FanState {
  status: FanStatus;
  /** Уровень веера = число оплаченных модулей (1..FAN_MAX_LEVEL). */
  level: number;
  ownedPaid: string[];
  /** Модули, которые уже входят в тариф владельца — веер их не предлагает. */
  coveredByTier: string[];
  windowDays: number;
  /** ISO — до какого момента веер действует (null, если статус не active). */
  validUntil: string | null;
  ringRatios: Record<FanRing, number>;
  /**
   * ВСЕ доступные к докупке модули, включая ring 3 с discountPercent = 0.
   * Нулевые оставлены осознанно: «здесь скидки нет» — это тоже ответ, и UI не
   * должен додумывать её отсутствие из отсутствия строки.
   */
  offers: FanOffer[];
  summary: {
    ring1: number;
    ring2: number;
    ring3: number;
    /** Сколько модулей реально идут со скидкой. */
    discounted: number;
    /** Сколько $/мес сэкономит покупатель, если возьмёт всё со скидкой. */
    maxSavingMonthly: number;
  };
  currency: CurrencyCode;
  /** Оплачиваемые модули без строки в projects.ts и без кластера — дефект данных. */
  taxonomyGap: string[];
  notes: string[];
}

export interface FanInput {
  /** Тариф владельца — модули, входящие в тариф, из веера исключаются. */
  tierId?: TierId;
  /** Что уже куплено (module ids). */
  owned?: string[];
  /** ISO-дата последней покупки. Нет → окно считаем от now (свежая покупка). */
  lastPurchaseAt?: string;
  currency?: CurrencyCode;
  /** Явное «сейчас» — чтобы тесты не зависели от календаря. */
  now?: Date;
}

/**
 * Ставка кольца на данном уровне. Три потолка подряд, все обязательные:
 * потолок кольца → общий потолок скидок → (для COGS-модулей) потолок COGS.
 * Последний применяется в computeFan, где известен конкретный модуль.
 */
export function ringRatio(ring: FanRing, level: number): number {
  const lvl = Math.max(1, Math.min(FAN_MAX_LEVEL, level));
  const raw = FAN_RING_BASE[ring] + (lvl - 1) * FAN_LEVEL_STEP;
  if (FAN_RING_BASE[ring] === 0) return 0; // кольцо без скидки лестницей не «оживает»
  return Math.min(raw, FAN_RING_CAP[ring], FAN_MAX_DISCOUNT_RATIO);
}

/** Ставка для конкретного модуля: кольцо + потолок COGS, если он применим. */
export function moduleRatio(moduleId: string, ring: FanRing, level: number): number {
  const byRing = ringRatio(ring, level);
  return FAN_COGS_SENSITIVE.has(moduleId)
    ? Math.min(byRing, FAN_COGS_SENSITIVE_MAX_RATIO)
    : byRing;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Курс валюты — со вторым слоем защиты, а не «вызывающий проверил».
 *
 * `CURRENCY_RATES[currency].rate` напрямую держится только на дисциплине
 * вызывающего: `currency` приходит из тела HTTP-запроса, а прототипный ключ
 * (`"constructor"`, `"__proto__"`) даёт функцию, у которой нет `.rate` — курс
 * становится `undefined`, и ВСЯ смета уезжает в `NaN` при HTTP 200. Ровно это
 * и было найдено 2026-07-26 в `routes/pricing.ts` и починено там `parseCurrency`.
 *
 * Сегодня все четыре вызывающих безопасны (три ручки нормализуют вход,
 * checkout передаёт литерал `"USD"`) — то есть живого дефекта здесь нет.
 * Слой всё равно нужен: эти функции экспортированы и стоят на денежном пути,
 * а правило после того разбора записано прямо — защищать в ДВУХ слоях, потому
 * что функцию зовут из нескольких мест и следующий вызывающий про
 * `parseCurrency` знать не обязан.
 */
function normalizeCurrency(currency: unknown): CurrencyCode {
  return typeof currency === "string" &&
    Object.prototype.hasOwnProperty.call(CURRENCY_RATES, currency) &&
    typeof CURRENCY_RATES[currency as CurrencyCode]?.rate === "number"
    ? (currency as CurrencyCode)
    : "USD";
}

/**
 * Главный расчёт: что и на сколько дешевеет для владельца набора `owned`.
 *
 * Возвращает ТОЛЬКО предложения — ничего не списывает и не сохраняет.
 * Все ставки детерминированы от (owned, tierId, now) — одинаковый вход даёт
 * одинаковый выход, поэтому это можно кэшировать на edge.
 */
export function computeFan(input: FanInput = {}): FanState {
  const now = input.now ?? new Date();
  const currency: CurrencyCode = normalizeCurrency(input.currency);
  const rate = CURRENCY_RATES[currency].rate;
  const tier = input.tierId ? getTier(input.tierId) : null;
  const notes: string[] = [];

  // Вход считаем ВРАЖДЕБНЫМ: сюда приходит тело HTTP-запроса, а эта функция
  // стоит на денежном пути (buildQuoteWithFan → /checkout/session). Найдено
  // 2026-07-26 прогоном кривых входов: число/null/объект в массиве роняли
  // `.trim()`, а не-массив — `.map()`, то есть чекаут отвечал 500 на
  // некорректный запрос вместо того, чтобы его пережить.
  const ownedInput = Array.isArray(input.owned) ? input.owned : [];
  const ownedRaw = [
    ...new Set(
      ownedInput
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const ownedKnown: string[] = [];
  for (const id of ownedRaw) {
    if (getModulePrice(id)) ownedKnown.push(id);
    else notes.push(`Модуль "${id}" не найден в MODULES_PRICING — в расчёте веера не учтён`);
  }

  /** Уровень считаем по платным модулям: бесплатные (0) веер не поднимают. */
  const ownedPaid = ownedKnown.filter((id) => {
    const m = getModulePrice(id);
    return !!m && typeof m.addonMonthly === "number" && m.addonMonthly > 0;
  });

  const level = Math.max(1, Math.min(FAN_MAX_LEVEL, ownedPaid.length));
  const ringRatios: Record<FanRing, number> = {
    1: ringRatio(1, level),
    2: ringRatio(2, level),
    3: ringRatio(3, level),
  };

  // Окно веера
  let status: FanStatus = "active";
  let validUntil: string | null = null;
  if (ownedPaid.length === 0) {
    status = "inactive";
    notes.push("Веер включается после первой покупки платного модуля");
  } else {
    const anchorTs = input.lastPurchaseAt ? Date.parse(input.lastPurchaseAt) : now.getTime();
    if (Number.isNaN(anchorTs)) {
      notes.push(`lastPurchaseAt="${input.lastPurchaseAt}" не разобрана — окно считаем от сейчас`);
    }
    const base = Number.isNaN(anchorTs) ? now.getTime() : anchorTs;
    const until = base + FAN_WINDOW_DAYS * 86_400_000;
    if (until <= now.getTime()) {
      status = "expired";
      notes.push(
        `Окно веера закрылось ${new Date(until).toISOString()} — любая новая покупка открывает его снова на ${FAN_WINDOW_DAYS} дней`,
      );
    } else {
      validUntil = new Date(until).toISOString();
    }
  }

  const coveredByTier: string[] = [];
  const taxonomyGap: string[] = [];
  const offers: FanOffer[] = [];

  for (const m of MODULES_PRICING) {
    const list = m.addonMonthly;
    if (typeof list !== "number" || list <= 0) continue; // бесплатные и on_request
    if (ownedKnown.includes(m.id)) continue; // уже куплен
    if (tier && m.includedIn.includes(tier.id)) {
      coveredByTier.push(m.id);
      continue;
    }
    if (tagsOf(m.id).size === 0 && clusterMatesOf(m.id).size === 0) taxonomyGap.push(m.id);

    const res = resolveRing(m.id, ownedPaid);
    const ratio = status === "active" ? moduleRatio(m.id, res.ring, level) : 0;
    const cogsCapped =
      status === "active" && FAN_COGS_SENSITIVE.has(m.id) && ringRatios[res.ring] > ratio;
    const priceUsd = list * (1 - ratio);
    offers.push({
      module: m.id,
      ring: res.ring,
      anchor: res.anchor,
      reason: res.reason,
      listMonthly: round2(list * rate),
      discountRatio: ratio,
      discountPercent: Math.round(ratio * 100),
      priceMonthly: round2(priceUsd * rate),
      savingMonthly: round2((list - priceUsd) * rate),
      availability: m.availability,
      cogsCapped,
    });
  }

  offers.sort((a, b) => a.ring - b.ring || b.savingMonthly - a.savingMonthly);

  return {
    status,
    level,
    ownedPaid,
    coveredByTier,
    windowDays: FAN_WINDOW_DAYS,
    validUntil,
    ringRatios,
    offers,
    summary: {
      ring1: offers.filter((o) => o.ring === 1).length,
      ring2: offers.filter((o) => o.ring === 2).length,
      ring3: offers.filter((o) => o.ring === 3).length,
      discounted: offers.filter((o) => o.discountRatio > 0).length,
      maxSavingMonthly: round2(offers.reduce((s, o) => s + o.savingMonthly, 0)),
    },
    currency,
    taxonomyGap,
    notes,
  };
}

/* ───── Витрина «что подешевеет, если купить X» (до покупки) ───── */

export interface FanPreviewRow {
  module: string;
  listMonthly: number;
  ring1: string[];
  ring2Count: number;
  ring3Count: number;
  /** Сколько $/мес экономит владелец, если добавит все ring-1 модули. */
  ring1SavingMonthly: number;
}

/**
 * Для каждого платного модуля: какой веер он открывает, если купить его первым.
 * Это марketинговая витрина («купи один — вот что подешевеет»), тот же приём,
 * которым Higgsfield показывает список unlimited-моделей ДО оплаты плана.
 */
export function fanPreview(currencyInput: CurrencyCode = "USD"): FanPreviewRow[] {
  const currency = normalizeCurrency(currencyInput);
  const rate = CURRENCY_RATES[currency].rate;
  const rows: FanPreviewRow[] = [];
  for (const m of MODULES_PRICING) {
    if (typeof m.addonMonthly !== "number" || m.addonMonthly <= 0) continue;
    const fan = computeFan({ owned: [m.id], currency });
    const ring1 = fan.offers.filter((o) => o.ring === 1);
    rows.push({
      module: m.id,
      listMonthly: round2(m.addonMonthly * rate),
      ring1: ring1.map((o) => o.module),
      ring2Count: fan.offers.filter((o) => o.ring === 2).length,
      ring3Count: fan.offers.filter((o) => o.ring === 3).length,
      ring1SavingMonthly: round2(ring1.reduce((s, o) => s + o.savingMonthly, 0)),
    });
  }
  rows.sort((a, b) => b.ring1.length - a.ring1.length || b.ring1SavingMonthly - a.ring1SavingMonthly);
  return rows;
}

/* ───── Смета с веером ───── */

export interface FanQuoteLineDiscount {
  module: string;
  ring: FanRing;
  discountPercent: number;
  /** Скидка в валюте сметы. */
  applied: number;
}

export interface QuoteWithFan extends Quote {
  fan: {
    status: FanStatus;
    level: number;
    validUntil: string | null;
    /** Сколько веер снял с этой сметы (в валюте сметы). */
    applied: number;
    lines: FanQuoteLineDiscount[];
    /** true — промо пришлось урезать, чтобы общая скидка не превысила потолок. */
    promoTrimmedByCap: boolean;
    notes: string[];
  };
}

export interface QuoteWithFanInput {
  tierId: TierId;
  modules?: string[];
  seats?: number;
  period?: BillingPeriod;
  currency?: CurrencyCode;
  promoCode?: string;
  /** Уже купленные модули — источник веера. */
  ownedModules?: string[];
  lastPurchaseAt?: string;
  now?: Date;
}

/**
 * Единственная точка, где веерная скидка попадает в деньги.
 *
 * Порядок: базовая смета (buildQuote) → веер на add-on строки → добор промо
 * так, чтобы (веер + промо) ≤ FAN_MAX_DISCOUNT_RATIO от базы после годовой
 * скидки. Именно этот совместный потолок не даёт «промо 50% + веер 50% = 0».
 *
 * Веер НЕ трогает строки tier/seat (см. шапку файла).
 */
export function buildQuoteWithFan(input: QuoteWithFanInput): QuoteWithFan {
  // Второй слой защиты на самой денежной точке входа.
  //
  // Обе ручки сегодня нормализуют вход до вызова (`parseCurrency`, `seats`
  // через `Number.isFinite` + зажим 1..1000) — живого дефекта нет. Но
  // `buildQuote` внутри делает `CURRENCY_RATES[currency].rate` и
  // `Math.max(1, input.seats ?? 1)`, а оба выражения тихо дают мусор, а не
  // отказ: прототипный ключ валюты уводит курс в `undefined` и всю смету в
  // `NaN`, а `Math.max(1, NaN)` — это `NaN`, а не 1 (тот же капкан, что был
  // найден в `?limit=`). Полагаться на дисциплину вызывающего там, где
  // считаются деньги, — ровно та ошибка, из-за которой «смета ≠ списание»
  // уже случалось.
  const currency: CurrencyCode = normalizeCurrency(input.currency);
  const seats =
    typeof input.seats === "number" && Number.isFinite(input.seats)
      ? Math.min(1000, Math.max(1, Math.floor(input.seats)))
      : 1;
  const base = buildQuote({
    tierId: input.tierId,
    modules: input.modules,
    seats,
    period: input.period,
    currency,
    promoCode: input.promoCode,
  });

  const notes: string[] = [];
  const fan = computeFan({
    tierId: input.tierId,
    owned: input.ownedModules,
    lastPurchaseAt: input.lastPurchaseAt,
    currency: "USD", // считаем в USD, конвертируем один раз в конце
    now: input.now,
  });
  notes.push(...fan.notes);

  const ratioByModule = new Map<string, { ring: FanRing; ratio: number }>();
  for (const o of fan.offers) {
    if (o.discountRatio > 0) ratioByModule.set(o.module, { ring: o.ring, ratio: o.discountRatio });
  }

  // Веер на add-on строки. base.lines уже в валюте сметы — считаем в ней же.
  const lines: FanQuoteLineDiscount[] = [];
  let fanApplied = 0;
  if (fan.status === "active") {
    for (const line of base.lines) {
      if (line.kind !== "addon" || !line.moduleId) continue;
      // moduleId проставляет buildQuote — намеренно не парсим label и не
      // повторяем здесь его правила пропуска (lite-слоты, includedIn,
      // on_request): дубль этих правил и есть источник расхождения
      // «смета ≠ списание».
      const id = line.moduleId;
      const hit = ratioByModule.get(id);
      if (!hit) continue;
      const applied = Math.round(line.total * hit.ratio * 100) / 100;
      if (applied <= 0) continue;
      fanApplied += applied;
      lines.push({ module: id, ring: hit.ring, discountPercent: Math.round(hit.ratio * 100), applied });
    }
  }
  fanApplied = Math.round(fanApplied * 100) / 100;

  // Совместный потолок «веер + промо».
  const promoApplied = base.promo?.applied ?? 0;
  // base.discount = годовая скидка + промо (в валюте сметы). Годовая часть —
  // это не скидка-стимул, а цена периода, поэтому в потолок не входит.
  const annualDiscount = Math.round((base.discount - promoApplied) * 100) / 100;
  const capBase = Math.max(0, base.subtotal - annualDiscount);
  const cap = Math.round(capBase * FAN_MAX_DISCOUNT_RATIO * 100) / 100;

  let fanFinal = Math.min(fanApplied, cap);
  if (fanFinal < fanApplied) {
    notes.push(`Веер урезан потолком ${Math.round(FAN_MAX_DISCOUNT_RATIO * 100)}% от суммы заказа`);
  }
  let promoFinal = promoApplied;
  let promoTrimmedByCap = false;
  if (fanFinal + promoFinal > cap) {
    promoFinal = Math.max(0, Math.round((cap - fanFinal) * 100) / 100);
    promoTrimmedByCap = true;
    notes.push(
      `Промокод урезан: суммарная скидка (веер + промо) не превышает ${Math.round(FAN_MAX_DISCOUNT_RATIO * 100)}% от суммы заказа`,
    );
  }

  const discount = Math.round((annualDiscount + promoFinal + fanFinal) * 100) / 100;
  const total = Math.max(0, Math.round((base.subtotal - discount) * 100) / 100);

  return {
    ...base,
    discount,
    total,
    notes: [...base.notes, ...notes],
    promo: base.promo ? { ...base.promo, applied: promoFinal } : null,
    fan: {
      status: fan.status,
      level: fan.level,
      validUntil: fan.validUntil,
      applied: fanFinal,
      lines,
      promoTrimmedByCap,
      notes,
    },
  };
}
