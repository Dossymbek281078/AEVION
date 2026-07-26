import { describe, it, expect } from "vitest";
import {
  computeFan,
  fanPreview,
  ringRatio,
  resolveRing,
  buildQuoteWithFan,
  moduleRatio,
  FAN_COGS_SENSITIVE,
  FAN_COGS_SENSITIVE_MAX_RATIO,
  FAN_MAX_DISCOUNT_RATIO,
  FAN_MAX_LEVEL,
  FAN_WINDOW_DAYS,
  FAN_RING_BASE,
  FAN_RING_CAP,
  FAN_KNOWN_LONERS,
} from "../src/data/fanDiscounts";
import {
  CURRENCY_RATES,
  MODULES_PRICING,
  buildQuote,
  computePromoDiscountUsd,
  getModulePrice,
  resolvePromoCode,
} from "../src/data/pricing";

/**
 * Тесты идут по РЕАЛЬНОМУ каталогу (MODULES_PRICING + projects.ts), а не по
 * синтетическим фикстурам: зелёный тест на своих же выдуманных входах проверяет
 * только функцию, а не то, как она поведёт себя на живых данных.
 */

const NOW = new Date("2026-07-26T12:00:00Z");
const paidModules = MODULES_PRICING.filter(
  (m) => typeof m.addonMonthly === "number" && (m.addonMonthly as number) > 0,
);

describe("кольца веера на реальном каталоге", () => {
  it("qsign → qright: ring 1 (один контур документов/прав)", () => {
    expect(resolveRing("qright", ["qsign"]).ring).toBe(1);
  });

  it("qcoreai → qfusionai: ring 1 (AI-ядро)", () => {
    expect(resolveRing("qfusionai", ["qcoreai"]).ring).toBe(1);
  });

  it("healthai → qmelanin: ring 1, хотя строки в projects.ts у qmelanin нет", () => {
    // qmelanin/qrenew есть в MODULES_PRICING, но не в projects.ts (это ловит
    // scripts/projects-pricing-audit.js). Ручной кластер longevity даёт им
    // близость, не дожидаясь исправления реестра.
    expect(resolveRing("qmelanin", ["healthai"]).ring).toBe(1);
  });

  it("healthai → qcontract: не ring 1 (разные домены)", () => {
    expect(resolveRing("qcontract", ["healthai"]).ring).toBeGreaterThan(1);
  });

  it("владелец без общих тегов и кластеров даёт ring 3", () => {
    expect(resolveRing("qevents", ["veilnetx"]).ring).toBe(3);
  });

  it("берётся ЛУЧШЕЕ кольцо по всем владельцам, а не первое", () => {
    // veilnetx даёт qright ring 3, qsign — ring 1. Порядок не должен влиять.
    expect(resolveRing("qright", ["veilnetx", "qsign"]).ring).toBe(1);
    expect(resolveRing("qright", ["qsign", "veilnetx"]).ring).toBe(1);
  });
});

describe("лестница уровней", () => {
  it("уровень 1 = базовые ставки кольца", () => {
    expect(ringRatio(1, 1)).toBeCloseTo(FAN_RING_BASE[1]);
    expect(ringRatio(2, 1)).toBeCloseTo(FAN_RING_BASE[2]);
  });

  it("каждый уровень добавляет 5 п.п.", () => {
    expect(ringRatio(2, 3)).toBeCloseTo(FAN_RING_BASE[2] + 0.1);
  });

  it("ring 3 — прайс без скидки на любом уровне", () => {
    // Замер 2026-07-26: при уровне 1 в ring3 попадало 27 из 31 модуля. Скидка
    // «на всё» обесценивает прайс, поэтому ring3 = 0 и лестницей не оживает.
    for (let lvl = 0; lvl <= FAN_MAX_LEVEL + 5; lvl++) expect(ringRatio(3, lvl)).toBe(0);
  });

  it("НИ ОДНА комбинация (кольцо × уровень) не пробивает потолки", () => {
    for (const ring of [1, 2, 3] as const) {
      for (let lvl = 0; lvl <= FAN_MAX_LEVEL + 5; lvl++) {
        expect(ringRatio(ring, lvl)).toBeLessThanOrEqual(FAN_MAX_DISCOUNT_RATIO);
        expect(ringRatio(ring, lvl)).toBeLessThanOrEqual(FAN_RING_CAP[ring]);
      }
    }
  });

  it("выше FAN_MAX_LEVEL лестница не растёт", () => {
    expect(ringRatio(1, FAN_MAX_LEVEL)).toBeCloseTo(ringRatio(1, FAN_MAX_LEVEL + 7));
  });

  it("модуль с переменным COGS не уходит глубже потолка COGS ни на каком уровне", () => {
    for (const id of FAN_COGS_SENSITIVE) {
      for (let lvl = 1; lvl <= FAN_MAX_LEVEL + 3; lvl++) {
        expect(moduleRatio(id, 1, lvl)).toBeLessThanOrEqual(FAN_COGS_SENSITIVE_MAX_RATIO);
      }
    }
    // Не-COGS модуль до потолка кольца доходит — иначе лестница бессмысленна.
    expect(moduleRatio("qcontract", 1, FAN_MAX_LEVEL)).toBeCloseTo(FAN_RING_CAP[1]);
  });

  it("каждый id в FAN_COGS_SENSITIVE существует в каталоге", () => {
    // Опечатка в этом списке = тихо снятый потолок себестоимости.
    for (const id of FAN_COGS_SENSITIVE) expect(getModulePrice(id), id).toBeTruthy();
  });
});

describe("окно веера", () => {
  it("свежая покупка → active, validUntil = +FAN_WINDOW_DAYS", () => {
    const fan = computeFan({ owned: ["qsign"], now: NOW });
    expect(fan.status).toBe("active");
    const until = Date.parse(fan.validUntil!);
    expect(until - NOW.getTime()).toBe(FAN_WINDOW_DAYS * 86_400_000);
  });

  it("покупка старше окна → expired и ВСЕ ставки нулевые", () => {
    const old = new Date(NOW.getTime() - (FAN_WINDOW_DAYS + 1) * 86_400_000).toISOString();
    const fan = computeFan({ owned: ["qsign"], lastPurchaseAt: old, now: NOW });
    expect(fan.status).toBe("expired");
    expect(fan.validUntil).toBeNull();
    expect(fan.offers.every((o) => o.discountRatio === 0)).toBe(true);
    // Цена при закрытом окне равна прайсу — никаких «почти скидок».
    expect(fan.offers.every((o) => o.priceMonthly === o.listMonthly)).toBe(true);
  });

  it("ровно на границе окна веер уже закрыт (без «ещё секундочку»)", () => {
    const edge = new Date(NOW.getTime() - FAN_WINDOW_DAYS * 86_400_000).toISOString();
    expect(computeFan({ owned: ["qsign"], lastPurchaseAt: edge, now: NOW }).status).toBe("expired");
  });

  it("без покупок веер inactive и ничего не предлагает со скидкой", () => {
    const fan = computeFan({ owned: [], now: NOW });
    expect(fan.status).toBe("inactive");
    expect(fan.offers.every((o) => o.discountRatio === 0)).toBe(true);
  });
});

describe("состав предложений", () => {
  it("уже купленный модуль в предложениях не появляется", () => {
    const fan = computeFan({ owned: ["qsign", "qright"], now: NOW });
    expect(fan.offers.map((o) => o.module)).not.toContain("qsign");
    expect(fan.offers.map((o) => o.module)).not.toContain("qright");
  });

  it("модуль, уже входящий в тариф, не продаётся повторно", () => {
    const fan = computeFan({ owned: ["qsign"], tierId: "full", now: NOW });
    // qright входит в full → в оферах его быть не должно, он в coveredByTier
    expect(fan.coveredByTier).toContain("qright");
    expect(fan.offers.map((o) => o.module)).not.toContain("qright");
  });

  it("on_request и бесплатные модули не попадают в веер", () => {
    const fan = computeFan({ owned: ["qsign"], now: NOW });
    const ids = new Set(fan.offers.map((o) => o.module));
    for (const m of MODULES_PRICING) {
      if (m.addonMonthly === null || m.addonMonthly === 0) expect(ids.has(m.id)).toBe(false);
    }
  });

  it("ни одна цена в веере не падает ниже половины прайса — на ВСЕХ уровнях", () => {
    // Прогон по реальному каталогу: владелец набирает модули один за другим.
    const owned: string[] = [];
    for (const m of paidModules.slice(0, FAN_MAX_LEVEL + 3)) {
      owned.push(m.id);
      const fan = computeFan({ owned, now: NOW });
      for (const o of fan.offers) {
        expect(o.discountRatio).toBeLessThanOrEqual(FAN_MAX_DISCOUNT_RATIO);
        expect(o.priceMonthly).toBeGreaterThanOrEqual(o.listMonthly * (1 - FAN_MAX_DISCOUNT_RATIO) - 0.01);
        expect(o.priceMonthly + o.savingMonthly).toBeCloseTo(o.listMonthly, 2);
      }
    }
  });

  it("неизвестный module id не роняет расчёт и попадает в notes", () => {
    const fan = computeFan({ owned: ["qsign", "нет-такого-модуля"], now: NOW });
    expect(fan.status).toBe("active");
    expect(fan.notes.join(" ")).toContain("нет-такого-модуля");
  });

  it("бесплатный модуль уровень веера не поднимает", () => {
    // globus/ventures/revenue-hub стоят 0 — покупкой их считать нельзя.
    const fan = computeFan({ owned: ["globus", "ventures"], now: NOW });
    expect(fan.status).toBe("inactive");
    expect(fan.ownedPaid).toEqual([]);
  });

  it("канарейка таксономии: у каждого платного модуля есть теги или кластер", () => {
    // Пусто — значит новый платный модуль не появился без строки в projects.ts
    // и без кластера. Если тест покраснел — не «поправь ожидание», а добавь
    // модулю строку в реестр или кластер в FAN_EXTRA_CLUSTERS.
    expect(computeFan({ owned: ["qsign"], now: NOW }).taxonomyGap).toEqual([]);
  });
});

describe("веер не должен быть пустым без причины", () => {
  it("у каждого платного модуля есть ring 1, кроме известных одиночек", () => {
    // Пустой ring1 = покупка НИЧЕГО не открывает, т.е. веер для этого модуля
    // не работает как механика. Чаще всего причина не в кластерах, а в том, что
    // сосед остался без цены (addonMonthly: null) и в веер не попадает.
    const empty = fanPreview()
      .filter((r) => r.ring1.length === 0)
      .map((r) => r.module)
      .sort();
    expect(empty).toEqual([...FAN_KNOWN_LONERS].sort());
  });

  it("флагманский cyberchess открывает веер (релиз 25.07.2026)", () => {
    const row = fanPreview().find((r) => r.module === "cyberchess")!;
    expect(row.ring1.length).toBeGreaterThan(0);
  });
});

describe("витрина «купи один — вот что подешевеет»", () => {
  it("покрывает все платные модули", () => {
    expect(fanPreview().length).toBe(paidModules.length);
  });

  it("у каждой строки ring-1 экономия равна сумме скидок ring-1 модулей", () => {
    for (const row of fanPreview()) {
      const fan = computeFan({ owned: [row.module] });
      const ring1 = fan.offers.filter((o) => o.ring === 1);
      expect(row.ring1.sort()).toEqual(ring1.map((o) => o.module).sort());
      expect(row.ring1SavingMonthly).toBeCloseTo(
        ring1.reduce((s, o) => s + o.savingMonthly, 0),
        2,
      );
    }
  });
});

describe("смета с веером", () => {
  it("веер снимает деньги с add-on строк и НЕ трогает тариф", () => {
    const q = buildQuoteWithFan({
      tierId: "medium",
      modules: ["qright"],
      ownedModules: ["qsign"],
      now: NOW,
    });
    const list = getModulePrice("qright")!.addonMonthly as number;
    expect(q.fan.status).toBe("active");
    expect(q.fan.lines).toHaveLength(1);
    expect(q.fan.lines[0].module).toBe("qright");
    expect(q.fan.lines[0].ring).toBe(1);
    expect(q.fan.applied).toBeCloseTo(list * FAN_RING_BASE[1], 2);
    // Тарифная строка осталась полной
    const tierLine = q.lines.find((l) => l.kind === "tier")!;
    expect(tierLine.total).toBe(39);
    expect(q.total).toBeCloseTo(q.subtotal - q.discount, 2);
  });

  it("add-on строки несут moduleId — контракт, на котором держится веер", () => {
    const q = buildQuote({ tierId: "medium", modules: ["qright", "qsign"] });
    const addons = q.lines.filter((l) => l.kind === "addon");
    expect(addons.length).toBeGreaterThan(0);
    for (const a of addons) expect(a.moduleId).toBeTruthy();
  });

  it("модуль, покрытый Lite-слотом, скидку не получает (его и так не тарифицируют)", () => {
    const q = buildQuoteWithFan({
      tierId: "lite",
      modules: ["qright"],
      ownedModules: ["qsign"],
      now: NOW,
    });
    expect(q.lines.filter((l) => l.kind === "addon")).toHaveLength(0);
    expect(q.fan.applied).toBe(0);
    expect(q.total).toBe(24);
  });

  it("веер без покупок ничего не меняет в смете", () => {
    const plain = buildQuote({ tierId: "medium", modules: ["qright"] });
    const withFan = buildQuoteWithFan({ tierId: "medium", modules: ["qright"], now: NOW });
    expect(withFan.total).toBe(plain.total);
    expect(withFan.fan.applied).toBe(0);
  });

  it("веер + промо вместе не пробивают общий потолок 50%", () => {
    // Уровень 2 → ring1 = 35%; плюс AEVION20 (20%) = 55% > 50% → потолок обязан
    // вмешаться. Без совместного потолка это был бы путь к «скидка 100%».
    const q = buildQuoteWithFan({
      tierId: "free",
      modules: ["qright"],
      ownedModules: ["qsign", "aevion-ip-bureau"],
      promoCode: "AEVION20",
      now: NOW,
    });
    const list = getModulePrice("qright")!.addonMonthly as number;
    expect(q.subtotal).toBe(list);
    expect(q.fan.level).toBe(2);
    expect(q.discount).toBeLessThanOrEqual(list * FAN_MAX_DISCOUNT_RATIO + 0.01);
    expect(q.total).toBeGreaterThanOrEqual(list * (1 - FAN_MAX_DISCOUNT_RATIO) - 0.01);
    expect(q.fan.promoTrimmedByCap).toBe(true);
    // Урезан именно промо, веер остался целым (он персональнее и адреснее)
    expect(q.fan.applied).toBeCloseTo(list * (FAN_RING_BASE[1] + 0.05), 2);
    expect(q.promo!.applied).toBeLessThan(list * 0.2);
  });

  it("ровно на потолке промо не урезается (потолок — не «>=», а «>»)", () => {
    // Уровень 1: веер 30% + промо 20% = ровно 50% → всё проходит целиком.
    const q = buildQuoteWithFan({
      tierId: "free",
      modules: ["qright"],
      ownedModules: ["qsign"],
      promoCode: "AEVION20",
      now: NOW,
    });
    const list = getModulePrice("qright")!.addonMonthly as number;
    expect(q.fan.promoTrimmedByCap).toBe(false);
    expect(q.discount).toBeCloseTo(list * 0.5, 2);
    expect(q.total).toBeCloseTo(list * 0.5, 2);
  });

  it("годовая скидка не съедается потолком стимулов", () => {
    const q = buildQuoteWithFan({
      tierId: "medium",
      period: "annual",
      modules: ["qright"],
      ownedModules: ["qsign"],
      now: NOW,
    });
    // Годовая скидка = 2 месяца тарифа (39*12 - 390 = 78)
    const annualPart = q.discount - q.fan.applied - (q.promo?.applied ?? 0);
    expect(annualPart).toBeCloseTo(78, 2);
  });
});

describe("веер в валютах — KZT это единственный живой канал, который спишет нашу сумму", () => {
  // PayBox (тенге) и PayPal — единственные каналы, которые списывают
  // ПРОИЗВОЛЬНУЮ сумму (docs §3). То есть до настройки LS веер превращается в
  // реальные деньги именно там, и конвертация обязана быть точной.
  const args = { tierId: "medium" as const, modules: ["qright", "qcontract"], ownedModules: ["qsign"], now: NOW };

  it("итог в тенге == итог в долларах × курс (без потерь на округлениях)", () => {
    const usd = buildQuoteWithFan({ ...args, currency: "USD" });
    const kzt = buildQuoteWithFan({ ...args, currency: "KZT" });
    const rate = CURRENCY_RATES.KZT.rate;
    expect(kzt.total).toBeCloseTo(usd.total * rate, 0);
    expect(kzt.subtotal).toBeCloseTo(usd.subtotal * rate, 0);
  });

  it("доля скидки не зависит от валюты", () => {
    const usd = buildQuoteWithFan({ ...args, currency: "USD" });
    const kzt = buildQuoteWithFan({ ...args, currency: "KZT" });
    expect(kzt.discount / kzt.subtotal).toBeCloseTo(usd.discount / usd.subtotal, 4);
  });

  it("веер реально уменьшает сумму к списанию в тенге", () => {
    const withFan = buildQuoteWithFan({ ...args, currency: "KZT" });
    const without = buildQuoteWithFan({ ...args, ownedModules: [], currency: "KZT" });
    expect(withFan.total).toBeLessThan(without.total);
    expect(without.total - withFan.total).toBeCloseTo(withFan.fan.applied, 0);
  });

  it("на ГОДОВОМ периоде веер считается от суммы за 12 месяцев, а не за один", () => {
    // При месячной оплате unitPrice == total, и ошибка «взяли не ту базу»
    // остаётся невидимой. На годовом qty=12, и разница в 12 раз сразу видна —
    // проверено мутацией: подмена базы на unitPrice роняет именно этот тест.
    const annual = buildQuoteWithFan({ ...args, period: "annual", currency: "USD" });
    const addonTotal = annual.lines
      .filter((l) => l.kind === "addon")
      .reduce((sum, l) => sum + l.total, 0);
    expect(addonTotal).toBeGreaterThan(0);
    // Оба add-on модуля в ring1 первого уровня → 30% от годовой суммы add-on'ов.
    expect(annual.fan.applied).toBeCloseTo(addonTotal * FAN_RING_BASE[1], 1);
  });

  it("в EUR и RUB та же пропорция — валюта не создаёт скидку и не съедает её", () => {
    const usd = buildQuoteWithFan({ ...args, currency: "USD" });
    for (const cur of ["EUR", "RUB"] as const) {
      const q = buildQuoteWithFan({ ...args, currency: cur });
      expect(q.total).toBeCloseTo(usd.total * CURRENCY_RATES[cur].rate, 0);
      expect(q.fan.applied).toBeCloseTo(usd.fan.applied * CURRENCY_RATES[cur].rate, 0);
    }
  });
});

describe("промо-скидка: одна реализация на смету и на списание", () => {
  it("процент считается до цента, а не до доллара", () => {
    // Регрессия 2026-07-26: buildQuote округлял до доллара ($18), checkout — до
    // цента ($17.80), при заявленном инварианте «смета == списание».
    const { promo } = resolvePromoCode("AEVION20", "full");
    expect(computePromoDiscountUsd(89, promo!, "monthly")).toBeCloseTo(17.8, 2);
    const q = buildQuote({ tierId: "full", promoCode: "AEVION20" });
    expect(q.total).toBeCloseTo(71.2, 2);
  });

  it("потолок 50% встроен в саму функцию, а не в вызывающий код", () => {
    const { promo } = resolvePromoCode("TEAM100", "full");
    expect(computePromoDiscountUsd(89, promo!, "monthly")).toBeCloseTo(44.5, 2);
    expect(computePromoDiscountUsd(890, promo!, "annual")).toBeCloseTo(445, 2);
  });
});
