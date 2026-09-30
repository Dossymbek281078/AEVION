/**
 * QSpace — спецификация материалов из модели (черновик).
 *
 * Числа выводятся ИЗ ПЛАНА и сгенерированных слоёв, а не набиты руками:
 * поменяется план — поменяется спецификация. Все допущения названы в
 * подписях на странице: площадь пола — по габариту плана, площадь стен —
 * по осям, одна сторона; это черновик для разговора о закупке, не смета
 * под подпись.
 */

import type { Plan, PlumbingDraft, WiringDraft } from "./planModel";
import { planBounds } from "./planModel";
import { CUT_WASTE, PAINT_COATS, PAINT_LITRES_PER_M2 } from "./roomSpec";

export type WallAreaSource = "rooms" | "axes";

export interface Estimate {
  /** площадь пола, м² — основание см. в `floorAreaSource` */
  floorArea: number;
  /**
   * Откуда взята площадь пола. Ярлык на экране обязан следовать за
   * основанием: подпись «по габариту плана» пережила саму правку на габарит и
   * сутки врала бы человеку про способ, которым посчитано его покрытие.
   */
  floorAreaSource: WallAreaSource;
  /** площадь стен, м² — основание см. в `wallAreaSource` */
  wallArea: number;
  /**
   * Откуда взята площадь стен. Число несёт свою родословную само: подпись на
   * экране обязана называть основание, иначе человек прочтёт «стены» и не
   * узнает, что это осевые линии, а не то, что он будет красить.
   */
  wallAreaSource: WallAreaSource;
  /** краска на два слоя при расходе 0.12 л/м², л */
  paintLitres: number;
  /** напольное покрытие с запасом 5 % на подрезку, м² */
  flooringArea: number;
  outlets: number;
  switches: number;
  /** кабель: сумма магистралей и спусков, м */
  cableMeters: number;
  /** трубы воды (ХВС + ГВС), м */
  pipeMeters: number;
  /** канализация, м */
  drainMeters: number;
  ceilingLights: number;
}

function runLen(run: Array<[number, number, number]>): number {
  let s = 0;
  for (let i = 0; i + 1 < run.length; i++) {
    s += Math.hypot(
      run[i + 1][0] - run[i][0],
      run[i + 1][1] - run[i][1],
      run[i + 1][2] - run[i][2],
    );
  }
  return s;
}

export function estimatePlan(
  plan: Plan,
  wiring: WiringDraft,
  plumbing: PlumbingDraft,
  ceilingLights: number,
  /**
   * Сумма площадей ПОМЕЩЕНИЙ, м². Когда известна — считаем по ней.
   *
   * Прежде площадь пола бралась габаритом плана, и это было написано до того,
   * как модуль научился выделять помещения. Замер на демо-квартире: габарит
   * 48 м² против 41.1 м² по комнатам — покрытия человек купил бы на 17 %
   * больше, а это деньги. Стены не застилают.
   *
   * Габарит остаётся запасным путём: если помещения не выделились (открытый
   * контур, картинка с разрывами), лучше завышенная оценка, чем никакой.
   */
  roomArea?: number,
  /**
   * Площадь стен ПО КОМНАТАМ (сумма периметр × высоту), м².
   *
   * Замер 08.09.2026 на демо-квартире: по осям стен выходило 86.7 м² и 20.8 л
   * краски, по комнатам — 115.3 м² и 27.7 л. Расхождение 33 %, и оба числа
   * стояли на ОДНОМ экране: список по комнатам выше, общая смета ниже.
   *
   * Верна комнатная сторона: красят ВНУТРЕННИЕ поверхности, и перегородка
   * попадает дважды — по разу на каждую соседнюю комнату. Счёт по осям берёт
   * её один раз, а наружную стену меряет по осевой линии, а не по грани.
   * Занижение краски дороже завышения: не хватит посреди работы, а
   * докупленная партия ляжет другим оттенком.
   */
  roomWallArea?: number,
): Estimate {
  const b = planBounds(plan);
  const поКомнатам = Boolean(roomArea && roomArea > 0);
  const floorArea = поКомнатам
    ? (roomArea as number)
    : (b.maxX - b.minX) * (b.maxY - b.minY);
  const floorAreaSource: WallAreaSource = поКомнатам ? "rooms" : "axes";

  // Проёмы вычитаются ТОЛЬКО на запасном пути. Комнатная сторона их намеренно
  // не вычитает (положение проёмов по комнатам неизвестно, а завышение здесь
  // безопаснее), и вычесть их тут значило бы вернуть расхождение с другой
  // стороны: числа опять перестали бы сходиться.
  let wallArea: number;
  let wallAreaSource: WallAreaSource;
  if (roomWallArea && roomWallArea > 0) {
    wallArea = roomWallArea;
    wallAreaSource = "rooms";
  } else {
    let byAxes = 0;
    for (const w of plan.walls) {
      if (w.glass) continue; // витраж не штукатурят и не красят
      byAxes += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * w.height;
    }
    for (const o of plan.openings) {
      byAxes -= o.width * o.height;
    }
    wallArea = Math.max(0, byAxes);
    wallAreaSource = "axes";
  }

  const cableMeters = wiring.runs.reduce((s, r) => s + runLen(r), 0);
  const pipeMeters =
    plumbing.cold.reduce((s, r) => s + runLen(r), 0) +
    plumbing.hot.reduce((s, r) => s + runLen(r), 0);
  const drainMeters = plumbing.drain.reduce((s, r) => s + runLen(r), 0);

  return {
    floorArea,
    floorAreaSource,
    wallArea,
    wallAreaSource,
    // Ставки берутся ИЗ roomSpec, а не повторяются здесь: две копии одной
    // ставки — готовая причина для двух таблиц разойтись снова.
    paintLitres: wallArea * PAINT_LITRES_PER_M2 * PAINT_COATS,
    flooringArea: floorArea * CUT_WASTE,
    outlets: wiring.points.filter((p) => p.kind === "outlet").length,
    switches: wiring.points.filter((p) => p.kind === "switch").length,
    cableMeters,
    pipeMeters,
    drainMeters,
    ceilingLights,
  };
}

/**
 * Спецификация таблицей — чтобы список закупки можно было УНЕСТИ с экрана.
 *
 * Скопировать со страницы можно было только построчную разбивку по комнатам;
 * весь список — кабель, трубы, розетки, светильники — оставался на экране, и в
 * магазин человек шёл с телефоном в руке.
 *
 * 🔴 Колонки «Цена за единицу» и «Сумма» оставлены ПУСТЫМИ намеренно. Цен мы не
 * знаем: они зависят от города, поставщика и дня. Подставить сюда правдоподобное
 * число значило бы выдать догадку за расчёт — а число без источника хуже
 * отсутствующего. Человек вписывает свои, и сумма считается формулой, которую
 * он видит.
 *
 * Формулы намеренно БЕЗ имён функций (`=B2*D2`, а итог — сложением): имена
 * функций в таблицах переводятся, и `=SUM(...)` в русском Excel не сработает,
 * а умножение и сложение работают в любом.
 */
/** Строка разбивки по помещению — ровно то, что даёт roomSpec. */
export interface RoomCsvLine {
  index: number;
  area: number;
  flooring: number;
  wallArea: number;
  paint: number;
  skirting: number;
}

/** Строка списка к покупке по материалу — считается в materialTotals.ts. */
export interface MaterialCsvLine {
  surface: "floor" | "wall";
  name: string;
  area: number;
  rooms: number[];
}

/**
 * Инженерия для выгрузки.
 *
 * 30.09.2026: тёплый пол, вентиляция и кондиционирование считались и
 * показывались на странице (три таблицы, 5000 px), а в файл НЕ попадали —
 * человек уносил подрядчику половину расчёта, и именно ту половину, по
 * которой считают котёл, вытяжку и сплиты. Поля необязательные: у файла
 * есть смысл и без инженерии, но если она посчитана — она едет с ним.
 */
export interface EngineeringCsv {
  heating?: { rooms: Array<{ index: number; heatedArea: number; pipeLength: number; loops: number; power: number }>;
              totals: { heatedArea: number; pipeLength: number; loops: number; power: number } };
  vent?: { rooms: Array<{ index: number; kind: string; area: number; flow: number; needsFan: boolean }>; totalFlow: number };
  cooling?: { rooms: Array<{ index: number; area: number; needWatt: number; pick: { btu: number; name: string } | null }> };
  /** Что расставлено в сцене: имя и количество. */
  items?: Array<{ name: string; count: number }>;
}

export function estimateCsv(
  est: Estimate,
  planName: string,
  rooms: RoomCsvLine[] = [],
  materials: MaterialCsvLine[] = [],
  engineering: EngineeringCsv = {},
): string {
  const NL = String.fromCharCode(13) + String.fromCharCode(10);
  // Десятичная ЗАПЯТАЯ и разделитель «;» — пара, которую ждёт русский Excel.
  // С точкой он прочитает числа как текст, и сумма не посчитается.
  const ч = (n: number, знаков = 1) => n.toFixed(знаков).replace(".", ",");

  /**
   * Строка, начинающаяся с =, +, - или @, в таблице ИСПОЛНЯЕТСЯ как формула.
   * Имя плана приходит из файла человека, то есть это чужой ввод. Гасим его
   * апострофом — Excel покажет текст и ничего не выполнит.
   */
  const безопасно = (s: string) =>
    (/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""').replace(/[\r\n;]/g, " ");

  const строки: Array<[string, string, string]> = [
    ["Пол", ч(est.floorArea), "м²"],
    ["Покрытие пола (с запасом на подрезку)", ч(est.flooringArea), "м²"],
    ["Стены под отделку", ч(est.wallArea), "м²"],
    ["Краска", ч(est.paintLitres), "л"],
    ["Розетки", String(est.outlets), "шт"],
    ["Выключатели", String(est.switches), "шт"],
    ["Кабель (магистрали + спуски)", ч(est.cableMeters, 0), "м"],
    ["Трубы воды (ХВС + ГВС)", ч(est.pipeMeters), "м"],
    ["Канализация", ч(est.drainMeters), "м"],
    ["Светильники", String(est.ceilingLights), "шт"],
  ];

  const out: string[] = [];
  out.push(`"Спецификация: ${безопасно(planName)}"`);
  out.push('"Цены впишите свои — мы их не знаем и не придумываем"');
  out.push("");
  out.push("Позиция;Объём;Единица;Цена за единицу;Сумма");
  const перваяСтрока = out.length + 1; // строки в таблице считаются с единицы
  строки.forEach(([имя, объём, ед], i) => {
    const r = перваяСтрока + i;
    out.push(`"${безопасно(имя)}";${объём};${ед};;=B${r}*D${r}`);
  });
  const первая = перваяСтрока;
  const последняя = перваяСтрока + строки.length - 1;
  const слагаемые = [];
  for (let r = первая; r <= последняя; r++) слагаемые.push(`E${r}`);
  out.push(`"ИТОГО";;;;=${слагаемые.join("+")}`);
  // Разбивка по помещениям — отдельным блоком и БЕЗ колонок цены.
  //
  // Она нужна для другого: плитку и обои покупают по комнатам, а не на всю
  // квартиру. Ставить сюда цену значило бы предложить посчитать одно и то же
  // дважды — итог уже посчитан выше, и два ответа об одном на одном листе
  // расходятся первыми.
  if (rooms.length > 0) {
    out.push("");
    out.push('"Разбивка по помещениям — по ней покупают плитку и обои"');
    out.push("Помещение;Пол, м²;Покрытие, м²;Стены, м²;Краска, л;Плинтус, м");
    for (const r of rooms) {
      out.push(
        `${r.index};${ч(r.area)};${ч(r.flooring)};${ч(r.wallArea)};`
        + `${ч(r.paint)};${ч(r.skirting)}`,
      );
    }
  }

  // Материалы к покупке — по одному на строку, без цен (итог уже выше):
  // плитку в санузел и ламинат в спальню покупают отдельно, и продавцу нужны
  // именно эти числа, а не «пол 36 м²».
  if (materials.length > 0) {
    out.push("");
    out.push('"Материалы к покупке — площадь пола с запасом на подрезку, стены чистые"');
    out.push("Поверхность;Материал;Площадь;Единица;Помещения");
    for (const m of materials) {
      out.push(
        `${m.surface === "floor" ? "Пол" : "Стены"};"${безопасно(m.name)}";${ч(m.area)};м²;${m.rooms.join(", ")}`,
      );
    }
  }

  // ИНЖЕНЕРИЯ. Каждая таблица повторяет ту, что человек видел на странице:
  // расходится файл со страницей — расходится и разговор с подрядчиком.
  const { heating, vent, cooling, items } = engineering;

  if (heating && heating.rooms.length > 0) {
    out.push("");
    out.push('"Тёплый пол — по мощности подбирают котёл или маты"');
    out.push("Помещение;Площадь обогрева, м²;Труба, м;Контуров;Мощность, Вт");
    for (const r of heating.rooms) {
      out.push(`"Помещение ${r.index}";${ч(r.heatedArea)};${ч(r.pipeLength, 0)};${r.loops};${ч(r.power, 0)}`);
    }
    out.push(`"ИТОГО";${ч(heating.totals.heatedArea)};${ч(heating.totals.pipeLength, 0)};${heating.totals.loops};${ч(heating.totals.power, 0)}`);
  }

  if (vent && vent.rooms.length > 0) {
    out.push("");
    out.push('"Вентиляция — по расходу подбирают вытяжку и приток"');
    out.push("Помещение;Назначение;Площадь, м²;Расход, м³/ч;Нужна принудительная вытяжка");
    for (const r of vent.rooms) {
      out.push(`"Помещение ${r.index}";"${безопасно(r.kind)}";${ч(r.area)};${ч(r.flow, 0)};${r.needsFan ? "да" : "нет"}`);
    }
    out.push(`"ИТОГО";;;${ч(vent.totalFlow, 0)};`);
  }

  if (cooling && cooling.rooms.length > 0) {
    out.push("");
    out.push('"Кондиционирование — требуемая мощность и подобранный типоразмер"');
    out.push("Помещение;Площадь, м²;Требуется, Вт;Подобрано");
    for (const r of cooling.rooms) {
      // Пустой подбор называется словами, а не пустой клеткой: пустая клетка
      // читается как «не нужно», а значит здесь «не хватает даже самого мощного».
      const подбор = r.pick ? `${r.pick.name} (${r.pick.btu} BTU)` : "типоразмера не хватает — нужны два блока";
      out.push(`"Помещение ${r.index}";${ч(r.area)};${ч(r.needWatt, 0)};"${безопасно(подбор)}"`);
    }
  }

  if (items && items.length > 0) {
    out.push("");
    out.push('"Оборудование и мебель, расставленные в модели"');
    out.push("Предмет;Количество;Единица");
    for (const i of items) out.push(`"${безопасно(i.name)}";${i.count};шт`);
  }

  // BOM: без него Excel читает файл как cp1251 и вместо русских слов
  // показывает кракозябры — проверено, это не теория.
  return "\uFEFF" + out.join(NL) + NL;
}
