/**
 * QSpace — подбор сплит-системы: какая мощность нужна комнате.
 *
 * Основатель назвал «сплит системы кондиционирования» отдельным пунктом. В
 * каталоге сплит-система была ПРЕДМЕТОМ — коробкой на стене, — но на главный
 * вопрос, с которым идут в магазин, модуль не отвечал: какая мощность нужна.
 * Воздух и влажность считались, а холод нет.
 *
 * Откуда числа. Базовая прикидка, которой пользуются продавцы и монтажники:
 * Q = S × h × q, где q — удельная теплопритока на кубометр. Для жилой комнаты
 * берут 30–40 Вт/м³ в зависимости от того, сколько солнца в окна. Дальше
 * добавляют тепло от людей и техники — это уже не про геометрию, поэтому
 * человек говорит об этом сам.
 *
 * Мощность переводится в «БТЕ» и в привычные названия «семёрка», «девятка»:
 * в магазине спрашивают именно так, и человек, пришедший с ваттами, получает
 * не тот прибор.
 *
 * 🔴 ГРАНИЦА, и она пишется на странице: это подбор по объёму, а не
 * теплотехнический расчёт. Настоящий учитывает утепление стен, тип
 * остекления, этаж и соседей сверху-снизу — ничего этого мы не знаем.
 * Ошибиться в меньшую сторону дороже: слабый кондиционер работает без
 * остановки и всё равно не охлаждает, поэтому при сомнении берут больший.
 */

import type { Room } from "./rooms";

/** Сколько солнца попадает в комнату — главный множитель в прикидке. */
export type SunLoad = "shade" | "normal" | "sunny";

/** Удельные теплопритоки, Вт на кубометр объёма. */
const WATT_PER_M3: Record<SunLoad, number> = {
  shade: 30,   // окна на север, комната в тени
  normal: 35,  // обычная комната
  sunny: 40,   // юг и запад, большие окна, верхний этаж
};

export const SUN_LABEL: Record<SunLoad, string> = {
  shade: "север, мало солнца",
  normal: "обычная комната",
  sunny: "юг или запад, много солнца",
};

/** Тепло от человека в покое, Вт. */
const WATT_PER_PERSON = 100;
/** Тепло от техники: компьютер, телевизор, холодильник — усреднённо, Вт. */
const WATT_PER_APPLIANCE = 200;

/**
 * Типоразмеры сплит-систем, которые реально стоят на полке.
 * `btu` — то, как их называют в магазине; `watt` — холодопроизводительность.
 */
const SIZES: Array<{ btu: number; watt: number; name: string }> = [
  { btu: 7000, watt: 2100, name: "«семёрка» (07)" },
  { btu: 9000, watt: 2600, name: "«девятка» (09)" },
  { btu: 12000, watt: 3500, name: "«двенашка» (12)" },
  { btu: 18000, watt: 5300, name: "«восемнадцать» (18)" },
  { btu: 24000, watt: 7000, name: "«двадцать четыре» (24)" },
];

export interface CoolingRoom {
  index: number;
  area: number;
  /** требуемая холодопроизводительность, Вт */
  needWatt: number;
  /** подобранный типоразмер; null — не хватает даже самого большого */
  pick: { btu: number; watt: number; name: string } | null;
  /** объяснение человеческими словами */
  how: string;
}

export interface CoolingResult {
  rooms: CoolingRoom[];
  warnings: string[];
  notes: string[];
}

/**
 * Подбор по комнатам.
 *
 * `people` и `appliances` — по номеру помещения; не указано — считаем одного
 * человека и одну единицу техники. Умолчание намеренно НЕ нулевое: ноль людей
 * в жилой комнате занизил бы мощность, а занижение здесь дороже завышения.
 */
export function coolingPlan(
  rooms: Room[],
  opts: {
    height?: number;
    sun?: Record<number, SunLoad>;
    people?: Record<number, number>;
    appliances?: Record<number, number>;
  } = {},
): CoolingResult {
  const h = opts.height ?? 2.7;
  const out: CoolingRoom[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  for (const r of rooms) {
    const sun = opts.sun?.[r.index] ?? "normal";
    const people = opts.people?.[r.index] ?? 1;
    const appliances = opts.appliances?.[r.index] ?? 1;

    const volume = r.area * h;
    const base = volume * WATT_PER_M3[sun];
    const extra = people * WATT_PER_PERSON + appliances * WATT_PER_APPLIANCE;
    const needWatt = Math.round(base + extra);

    const pick = SIZES.find((s) => s.watt >= needWatt) ?? null;
    if (!pick) {
      warnings.push(
        `Помещение ${r.index}: нужно ${(needWatt / 1000).toFixed(1)} кВт — это больше`
        + " самого крупного бытового сплита. Ставят два прибора или"
        + " полупромышленный; такой подбор делает проектировщик.",
      );
    }

    out.push({
      index: r.index,
      area: r.area,
      needWatt,
      pick,
      how:
        `${r.area.toFixed(1)} м² × ${h} м = ${volume.toFixed(1)} м³`
        + ` × ${WATT_PER_M3[sun]} Вт/м³ + ${extra} Вт (люди и техника)`,
    });
  }

  notes.push(
    "Мощность округляется ВВЕРХ до типоразмера. Слабый кондиционер не"
    + " экономит: он работает без остановки, шумит и всё равно не охлаждает.",
  );
  notes.push(
    "Это подбор по объёму, а не теплотехнический расчёт: утепление стен, тип"
    + " остекления и этаж мы не знаем, а они меняют результат на четверть.",
  );

  return { rooms: out, warnings, notes };
}

/** Суммарная мощность всех подобранных приборов, Вт — для прикидки нагрузки. */
export function totalPickedWatt(res: CoolingResult): number {
  return res.rooms.reduce((s, r) => s + (r.pick?.watt ?? 0), 0);
}
