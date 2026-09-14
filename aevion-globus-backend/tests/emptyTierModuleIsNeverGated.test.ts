import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Модуль без единого тарифа НЕЛЬЗЯ закрывать стеной.
 *
 * Шлюз требует тариф из includedIn. Если список пуст, подходящего тарифа нет
 * ни у кого — отказ получают ВСЕ, включая платящих. Это хуже «бесплатных с
 * 402»: доступа не остаётся вовсе.
 *
 * Латентность и есть опасность: пока стена выключена, дефект невидим, а
 * включается он одной переменной окружения. Проверка стоит здесь, чтобы
 * решение основателя «включить стену» не обернулось отказом всем.
 *
 * 14.09.2026: ПРЕДМЕТ ПРОВЕРКИ БОЛЬШЕ НЕ ЗАВИСИТ ОТ СОСТАВА КАТАЛОГА. Раньше
 * тест искал в реальном каталоге модуль с пустым includedIn. На проде таким был
 * один devhub, на соседней ветке — один qskyway; цикл 17 дал тарифы qskyway,
 * решение основателя «DevHub входит в Full» — devhub, и на слитой ветке их
 * стало ноль: каждая ветка зелёная, вместе красные. Хуже того, проверка
 * «звёздочка» при отсутствии предмета делала `return` и не выполняла ни одного
 * утверждения. Теперь предмет — синтетическая запись с пустым списком тарифов,
 * положенная в СВЕЖИЙ экземпляр каталога до загрузки planGate (PRICING_BY_ID
 * строится при загрузке, а для неизвестного id действует запасной список
 * ["full","enterprise"] — выдуманный id проверил бы не тот путь). Реальные
 * модули без тарифов, если появятся, проверяются тоже.
 */

const ПЕРЕМЕННЫЕ = ["PAYWALL_MODULES", "PAYWALL_DISABLED"];
const СИНТЕТИЧЕСКИЙ = "zz-empty-tiers-probe";

type Запись = { id: string; includedIn?: string[] };

/** Свежий каталог с синтетическим модулем без тарифов и planGate поверх него. */
async function сПредметом() {
  vi.resetModules();
  const pricing = await import("../src/data/pricing");
  const каталог = pricing.MODULES_PRICING as unknown as Array<Record<string, unknown>>;
  if (!каталог.some((m) => m.id === СИНТЕТИЧЕСКИЙ)) {
    каталог.push({
      id: СИНТЕТИЧЕСКИЙ,
      addonMonthly: null,
      includedIn: [],
      availability: "live",
      oneLiner: "синтетический модуль сторожа: без единого тарифа",
      name: "Probe",
    });
  }
  const gate = await import("../src/lib/planGate");
  const безТарифов = (каталог as unknown as Запись[])
    .filter((m) => (m.includedIn?.length ?? 0) === 0)
    .map((m) => m.id);
  return { paywallEnabledFor: gate.paywallEnabledFor, каталог: каталог as unknown as Запись[], безТарифов };
}

describe("модуль без тарифов не закрывается стеной", () => {
  const было: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ПЕРЕМЕННЫЕ) { было[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ПЕРЕМЕННЫЕ) {
      if (было[k] === undefined) delete process.env[k];
      else process.env[k] = было[k];
    }
  });

  it("контроль: прибор видит закрытие модуля, у которого тарифы ЕСТЬ", async () => {
    const { paywallEnabledFor, каталог } = await сПредметом();
    const сТарифами = каталог.find(
      (m) => (m.includedIn?.length ?? 0) > 0 && !["qcoreai", "qright", "qsign"].includes(m.id),
    );
    expect(сТарифами, "в каталоге нет ни одного модуля с тарифами — проверять нечем").toBeTruthy();
    process.env.PAYWALL_MODULES = сТарифами!.id;
    expect(
      paywallEnabledFor(сТарифами!.id),
      "контроль: модуль С тарифами не закрылся — значит проверка меряет не то",
    ).toBe(true);
  });

  it("контроль: синтетический модуль без тарифов действительно попал в каталог шлюза", async () => {
    const { безТарифов } = await сПредметом();
    expect(безТарифов, "синтетический предмет не виден шлюзу — проверка ниже была бы пустой").toContain(СИНТЕТИЧЕСКИЙ);
  });

  it("модуль с пустым includedIn НЕ закрывается, даже если назван явно", async () => {
    const { paywallEnabledFor, безТарифов } = await сПредметом();
    expect(безТарифов.length).toBeGreaterThan(0);
    for (const id of безТарифов) {
      process.env.PAYWALL_MODULES = id;
      expect(
        paywallEnabledFor(id),
        `${id}: закрыт стеной при пустом списке тарифов — откажут ВСЕМ, включая платящих`,
      ).toBe(false);
    }
  });

  it("звёздочка тоже не закрывает модуль без тарифов", async () => {
    const { paywallEnabledFor, безТарифов } = await сПредметом();
    expect(безТарифов.length).toBeGreaterThan(0);
    process.env.PAYWALL_MODULES = "*";
    for (const id of безТарифов) {
      expect(
        paywallEnabledFor(id),
        `${id}: «закрыть всё» закрыло и модуль без тарифов`,
      ).toBe(false);
    }
  });
});
