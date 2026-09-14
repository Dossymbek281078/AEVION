/**
 * QSpace — вентиляция и влажность.
 *
 * Основатель просил «сплит-системы кондиционирования, воздуха, влажности».
 * Кондиционер в каталоге есть; здесь — вторая половина: сколько воздуха
 * помещению нужно и куда девать влагу.
 *
 * Откуда числа. Для жилых комнат норма считается по площади (3 м³/ч на м²),
 * для кухни и санузла — вытяжкой с фиксированным расходом, потому что там
 * важен не объём комнаты, а источник запаха и пара. Это те цифры, по которым
 * подбирают вентилятор в магазине.
 *
 * 🔴 ГРАНИЦА, и она пишется человеку: это подбор оборудования, а не расчёт
 * системы вентиляции. Настоящий расчёт учитывает число жильцов, этажность,
 * тягу общедомового канала и герметичность окон — ничего этого мы не знаем.
 * Модуль не знает и НАЗНАЧЕНИЯ комнат: их называет человек.
 */

export type RoomKind = "living" | "kitchen" | "bath" | "toilet" | "corridor";

/** Расход воздуха для помещения, м³/ч. */
export interface AirNeed {
  index: number;
  kind: RoomKind;
  area: number;
  /** требуемый расход, м³/ч */
  flow: number;
  /** чем обеспечивается */
  how: string;
  /** нужна ли принудительная вытяжка */
  needsFan: boolean;
}

export interface VentResult {
  rooms: AirNeed[];
  /** суммарный приток, который надо откуда-то взять, м³/ч */
  totalFlow: number;
  warnings: string[];
  notes: string[];
}

/** Норма на жилую комнату: 3 м³/ч на квадратный метр. */
const LIVING_PER_M2 = 3;
/** Вытяжка кухни с электроплитой, м³/ч. */
const KITCHEN_FLOW = 60;
/** Вытяжка совмещённого санузла, м³/ч. */
const BATH_FLOW = 50;
/** Вытяжка отдельного туалета, м³/ч. */
const TOILET_FLOW = 25;

export const KIND_LABEL: Record<RoomKind, string> = {
  living: "жилая",
  kitchen: "кухня",
  bath: "санузел",
  toilet: "туалет",
  corridor: "коридор",
};

/**
 * Расчёт воздухообмена.
 *
 * `kinds` — назначение по номеру помещения. Не указано — считаем жилой: это
 * безопасная сторона, у жилой нормы расход растёт с площадью, а у вытяжки он
 * фиксированный, и занизить страшнее.
 */
export function ventilationPlan(
  rooms: Array<{ index: number; area: number }>,
  kinds: Record<number, RoomKind> = {},
): VentResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const out: AirNeed[] = [];

  for (const r of rooms) {
    const kind = kinds[r.index] ?? "living";
    let flow: number;
    let how: string;
    let needsFan = false;

    switch (kind) {
      case "kitchen":
        flow = KITCHEN_FLOW;
        // Число подставляется из константы, а не переписывается словами: под
        // строкой ниже такая же подпись уже сделана правильно, а эти три жили
        // копиями. Поменяй норму — и подпись врала бы, не уронив ни одного теста.
        how = `вытяжка над плитой, ${KITCHEN_FLOW} м³/ч (электроплита)`;
        needsFan = true;
        break;
      case "bath":
        flow = BATH_FLOW;
        how = `вытяжной вентилятор, ${BATH_FLOW} м³/ч`;
        needsFan = true;
        break;
      case "toilet":
        flow = TOILET_FLOW;
        how = `вытяжной вентилятор, ${TOILET_FLOW} м³/ч`;
        needsFan = true;
        break;
      case "corridor":
        flow = 0;
        how = "своего расхода нет — воздух проходит транзитом";
        break;
      default:
        flow = r.area * LIVING_PER_M2;
        how = `приток ${LIVING_PER_M2} м³/ч на м² — клапан в окне или стене`;
    }

    out.push({ index: r.index, kind, area: r.area, flow, how, needsFan });
  }

  const totalFlow = out.reduce((s, r) => s + r.flow, 0);

  // Проверки, которые ловят настоящие ошибки планировки
  const wet = out.filter((r) => r.kind === "bath" || r.kind === "toilet" || r.kind === "kitchen");
  if (wet.length === 0) {
    warnings.push(
      "Ни одно помещение не отмечено как кухня или санузел — вытяжка не посчитана. "
      + "Укажите назначение комнат, иначе расчёт будет только по притоку.",
    );
  }
  const baths = out.filter((r) => r.kind === "bath" || r.kind === "toilet");
  if (baths.some((r) => !r.needsFan)) {
    warnings.push("У влажного помещения не назначена вытяжка — пар пойдёт в квартиру.");
  }

  notes.push(
    "Приток и вытяжка должны сходиться: сколько воздуха уходит через кухню и "
    + "санузел, столько же обязано прийти через окна и клапаны. Иначе вытяжка "
    + "работает вхолостую, а зимой тянет из подъезда.",
  );
  if (totalFlow > 0) {
    notes.push(
      `Суммарно нужно ${Math.round(totalFlow)} м³/ч. Если окна с уплотнителями и `
      + "приточных клапанов нет, столько воздуха взять неоткуда.",
    );
  }

  return { rooms: out, totalFlow, warnings, notes };
}

/**
 * Влажность: нужен ли осушитель в санузле без окна.
 *
 * Простое правило, которое реально помогает: санузел без окна и без вытяжки —
 * гарантированная плесень. С вытяжкой достаточно её.
 */
export function humidityAdvice(
  rooms: AirNeed[],
  windowlessRooms: number[] = [],
): string[] {
  const out: string[] = [];
  for (const r of rooms) {
    if (r.kind !== "bath" && r.kind !== "toilet") continue;
    const noWindow = windowlessRooms.includes(r.index);
    if (noWindow && !r.needsFan) {
      out.push(
        `Помещение ${r.index}: влажное, без окна и без вытяжки — это плесень. `
        + "Вытяжной вентилятор здесь обязателен.",
      );
    } else if (noWindow) {
      out.push(
        `Помещение ${r.index}: без окна, вытяжка есть. Поставьте её на выключатель `
        + "света с задержкой 5–10 минут — иначе пар не успевает уйти.",
      );
    }
  }
  return out;
}
