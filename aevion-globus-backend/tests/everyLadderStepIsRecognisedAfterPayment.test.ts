/**
 * Каждая ступень каждого приложения обязана ОПОЗНАВАТЬСЯ после оплаты.
 *
 * ПОЧЕМУ СВИП, А НЕ НЕСКОЛЬКО ПРИМЕРОВ. Цепочка «оплата → доступ» состоит из
 * трёх переводов имени: касса знает ссылку `app_<слаг>_<ступень>`, вебхук
 * пишет СЛАГ, а гейт спрашивает по ID МОДУЛЯ. Имена эти совпадают не всегда:
 * `ip_bureau` против `aevion-ip-bureau`, `multichat` против
 * `multichat-engine`, `startup_exchange` против `startup-exchange`.
 *
 * Дыра в любом из переводов означает буквально «деньги взяли, выдать нечего»:
 * человек платит, вебхук записывает право, а гейт этого права не находит.
 * Так уже было 20.09.2026 с Биржей стартапов — строку в таблицу имён добавляют
 * руками, и каталог её обогнал. Проверка по нескольким примерам такую дыру
 * не ловит по построению: ловит её только полный перебор.
 *
 * Знаменатель называется в самом тесте, чтобы «зелено» не значило «проверено
 * ноль позиций»: приложений столько-то, ступеней пять, произведение — вот оно.
 */

import { describe, it, expect } from "vitest";
import { STANDALONE_APPS, TERM_TIERS } from "../src/data/pricing";
import {
  appSlugForReference,
  appSlugForModuleId,
  moduleIdForAppSlug,
  appSlugHasOwnGate,
  type LemonSqueezyReference,
} from "../src/data/lemonSqueezyVariants";
import { isModuleEntitled, type ResolvedPlan } from "../src/lib/planGate";

const ступени = TERM_TIERS as readonly string[];
const позиции = STANDALONE_APPS.flatMap((a) =>
  ступени.map((t) => ({ app: a, ref: `app_${a.slug}_${t}` as LemonSqueezyReference, шаг: t })),
);

const планLite = (выбран: string): ResolvedPlan => ({
  tier: "lite",
  rawTier: "lite",
  email: "buyer@example.com",
  reason: "test",
  chosenModules: [выбран],
});

describe("оплата любой ступени опознаётся гейтом", () => {
  it("перебор не пустой и знаменатель назван", () => {
    // Свип, который ничего не перебрал, зелёный по той же причине, по какой
    // зелён свип без дефектов. Называем числа.
    expect(STANDALONE_APPS.length).toBeGreaterThan(5);
    expect(ступени.length).toBe(5);
    expect(позиции.length).toBe(STANDALONE_APPS.length * 5);
  });

  it.each(позиции)("$ref → слаг приложения", ({ app, ref }) => {
    expect(appSlugForReference(ref), `ссылка ${ref} не опознана`).toBe(app.slug);
  });

  it.each(позиции)("$ref: слаг ↔ id модуля замыкаются", ({ app }) => {
    const id = moduleIdForAppSlug(app.slug);
    expect(id, `у слага ${app.slug} нет id модуля`).toBeTruthy();
    // Обратный перевод обязан вернуться к тому же слагу — иначе вебхук и гейт
    // говорят о разных вещах, каждый по-своему правильно.
    expect(appSlugForModuleId(id), `обратный перевод ${id} не вернулся к ${app.slug}`).toBe(app.slug);
  });

  it.each(позиции)("$ref: купивший опознаётся гейтом", ({ app }) => {
    // Модули со своим гейтом (DevHub) сюда не входят: у них доступ открывает
    // не planGate, и требовать от него «да» значило бы проверять не тот путь.
    if (appSlugHasOwnGate(app.slug)) return;
    const id = moduleIdForAppSlug(app.slug);
    // В запись подписки попадает СЛАГ (так пишет вебхук), а гейт спрашивает по
    // ID. Обе формы обязаны опознаваться — иначе заплативший упрётся в стену.
    expect(isModuleEntitled(планLite(app.slug), id), `слаг ${app.slug} не опознан гейтом`).toBe(true);
    expect(isModuleEntitled(планLite(id), id), `id ${id} не опознан гейтом`).toBe(true);
  });

  it("контроль: чужой модуль по ступени Lite НЕ открывается", () => {
    // Без этого контроля все проверки выше прошли бы и у гейта,
    // который отвечает «да» на что угодно.
    const чужой = STANDALONE_APPS.find((a) => !appSlugHasOwnGate(a.slug))!;
    const id = moduleIdForAppSlug(чужой.slug);
    expect(isModuleEntitled(планLite("совершенно-другой-модуль"), id)).toBe(false);
  });
});
