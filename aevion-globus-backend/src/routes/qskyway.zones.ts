// QSkyway Phase 4 — no-fly zones + layered wind, per city.
//
// ⚠️ No-fly зоны здесь — иллюстративные данные, НЕ авторитетный источник
// ограничений. Реальные запретные зоны берутся из официальных публикаций
// регулятора (FAA UAS / NOTAM, EASA U-space, CAAC) — ещё не подключено.
//
// WindConfig ниже — fallback-модель, используется только когда живой METAR
// (qskyway.metar.ts, aviationweather.gov) недоступен для города. При
// доступном METAR наземный ветер (fromDeg/baseMs) реальный; perBandMs
// (рост с высотой) остаётся иллюстративным всегда — METAR не сообщает ветер
// на высоте.

export interface NoFlyZone {
  id: string;
  name: string;
  kind: "permanent" | "temporary";
  center: [number, number]; // [lon, lat]
  radiusM: number;
  until?: string; // ISO-8601 для temporary
  /**
   * What the regulator actually publishes for this spot, where we know it.
   *
   * A demo circle named after a real restriction is worse than an unnamed one:
   * the name makes it look sourced. Astana's "government quarter" placeholder
   * understated the published prohibition fourteenfold in radius and nothing on
   * screen said so. Where a real rule is known, it is named here.
   */
  realityNote?: string;
  realityNoteEn?: string;
}

export interface WindConfig {
  // Метеорологическое направление — ОТКУДА дует ветер, градусы (0=N,90=E).
  fromDeg: number;
  baseMs: number; // у земли
  perBandMs: number; // прирост на каждую высотную полосу
}

export const NOFLY: Record<string, NoFlyZone[]> = {
  astana: [
    {
      id: "nfz-gov", name: "Правительственный квартал (демо-геометрия)", kind: "permanent",
      center: [71.4418, 51.1268], radiusM: 320,
      realityNote:
        "Это НАША демо-окружность, а не опубликованная зона. Реально действует запретная зона UAP28 " +
        "(AIP KZ ENR 5.1): круг радиусом 4.5 км, от земли до 4800 ft, круглосуточно — он накрывает 100% " +
        "твина, то есть в 14 раз шире по радиусу, чем эта фигура. Демо-круг оставлен, чтобы показать " +
        "механику обхода; за реальным ограничением см. блок airspace.permission.",
      realityNoteEn:
        "This is OUR demo circle, not a published zone. The real restriction is prohibited "
        + "area UAP28 (AIP KZ ENR 5.1): a circle of 4.5 km radius, ground to 4800 ft, H24 - it "
        + "covers 100% of the twin, i.e. 14 times wider in radius than this figure. The demo "
        + "circle is kept to show the avoidance mechanics; for the real restriction see the "
        + "airspace.permission block.",
    },
    { id: "nfz-event", name: "Массовое мероприятие", kind: "temporary", center: [71.4270, 51.1240], radiusM: 240, until: "2026-07-13T20:00:00Z" },
  ],
  nyc: [
    { id: "nfz-crowd", name: "Плотная толпа — Таймс-сквер", kind: "temporary", center: [-73.9839, 40.7591], radiusM: 210, until: "2026-07-13T06:00:00Z" },
    { id: "nfz-sensitive", name: "Чувствительный объект", kind: "permanent", center: [-73.9800, 40.7520], radiusM: 200 },
  ],
  tokyo: [
    { id: "nfz-cluster", name: "Кластер небоскрёбов Ниси-Синдзюку — ограничение", kind: "permanent", center: [139.69569, 35.69335], radiusM: 220 },
    { id: "nfz-crowd", name: "Плотная толпа — станция Синдзюку", kind: "temporary", center: [139.70000, 35.68883], radiusM: 200, until: "2026-07-20T12:00:00Z" },
  ],
  singapore: [
    {
      // Сингапур, 15.09.2026. Реальный режим CAAS: запрет в 5 км от аэродромов,
      // в опасных/запретных/ограниченных зонах и в «охраняемых районах» по Air
      // Navigation Act (caas.gov.sg/unmanned-aircraft/no-fly-zones-and-ua-flying-areas).
      // Замер по нашему квадрату: ближайший аэродром — авиабаза Пая-Лебар,
      // ~10 км от центра твина; Селетар ~15 км; Чанги ~17 км — ни один 5-км круг
      // до твина не доходит. Список охраняемых районов CAAS публикует только
      // в OneMap (слой не вобран); вторичные источники называют Парламент —
      // он внутри квадрата. Круг ниже — НАША демо-геометрия вокруг него,
      // не опубликованный контур, и об этом сказано прямо.
      id: "nfz-parliament", name: "Парламент и Верховный суд (демо-геометрия)", kind: "permanent",
      center: [103.8506, 1.2891], radiusM: 250,
      realityNote:
        "Это НАША демо-окружность. CAAS запрещает полёты в «охраняемых районах» по Air Navigation Act, "
        + "но публикует их контуры только в OneMap, и этот слой в твин не вобран; по вторичным источникам "
        + "Парламент входит в такой район. 5-км круги аэродромов до квадрата не доходят (Пая-Лебар ~10 км). "
        + "За реальным режимом см. блок airspace.permission: любой нерекреационный (в том числе коммерческий) "
        + "полёт требует разрешения оператора и разрешения на деятельность CAAS.",
      realityNoteEn:
        "This is OUR demo circle. CAAS forbids flight in 'protected areas' under the Air Navigation Act, "
        + "but publishes their outlines only in OneMap, which is not ingested here; secondary sources name "
        + "Parliament House as one. The 5 km aerodrome circles do not reach this square (Paya Lebar Air Base "
        + "~10 km). For the real regime see airspace.permission: any non-recreational flight needs a CAAS "
        + "Operator Permit and an Activity Permit.",
    },
    { id: "nfz-crowd", name: "Плотная толпа — Марина-Бей (набережная)", kind: "temporary", center: [103.8590, 1.2830], radiusM: 200, until: "2026-12-31T16:00:00Z" },
  ],
  amsterdam: [
    {
      // Амстердам, 16.09.2026. Реальный режим: весь квадрат Зёйдаса лежит в CTR
      // Схипхола (eAIP NL, AD 2 EHAM 2.17: GND–3000 ft AMSL, класс C) — это
      // описано в блоке airspace.permission как разрешительный режим на 100 %
      // клеток, и кругом его не изобразить. Голландский слой «зоны запрета для
      // дронов» (PDOK) снят с публикации 30.06.2026, векторных запретных зон
      // внутри квадрата в eAIP нет. Круг ниже — НАША демо-геометрия над
      // станцией Амстердам-Зёйд (узел поездов, метро и автобусов), не
      // опубликованный контур, и об этом сказано прямо.
      id: "nfz-station", name: "Станция Амстердам-Зёйд (демо-геометрия)", kind: "permanent",
      center: [4.8728, 52.3389], radiusM: 220,
      realityNote:
        "Это НАША демо-окружность. Опубликованный режим над Зёйдасом один — CTR Схипхола (класс C, GND–3000 ft AMSL) "
        + "по eAIP NL AD 2 EHAM 2.17, и он покрывает квадрат целиком: см. блок airspace.permission. Слой запретных "
        + "зон для дронов PDOK снят с публикации 30.06.2026, векторных запретных зон внутри квадрата в eAIP нет.",
      realityNoteEn:
        "This is OUR demo circle. The only published regime over Zuidas is the Schiphol CTR (class C, GND–3000 ft "
        + "AMSL) per eAIP NL AD 2 EHAM 2.17, and it covers the whole square: see airspace.permission. The PDOK "
        + "drone no-fly layer was withdrawn on 2026-06-30; the eAIP publishes no vector prohibited areas inside the square.",
    },
    { id: "nfz-crowd", name: "Плотная толпа — Gustav Mahlerplein (площадь у ВТЦ)", kind: "temporary", center: [4.8737, 52.3400], radiusM: 180, until: "2026-12-31T16:00:00Z" },
  ],
  berlin: [
    {
      // Берлин, 16.09.2026. Реальный режим: весь квадрат Потсдамер-плац лежит в
      // ED-R 146 (круг 3 NM вокруг Рейхстага, GND–5000 ft MSL, AIP Germany
      // ENR 5.1) и в его внутреннем ярусе 1 NM — это блок airspace.permission на
      // 100 % клеток, кругом его не изобразить. Круг ниже — НАША демо-геометрия
      // над форумом Sony Center (крытая площадь под куполом), не опубликованный
      // контур, и об этом сказано прямо.
      id: "nfz-sony", name: "Форум Sony Center (демо-геометрия)", kind: "permanent",
      center: [13.3733, 52.5100], radiusM: 150,
      realityNote:
        "Это НАША демо-окружность. Опубликованный режим над Потсдамер-плац один — ED-R 146 (круг 3 NM вокруг "
        + "Рейхстага, GND–5000 ft MSL, AIP Germany ENR 5.1), и он покрывает квадрат целиком, во внутреннем ярусе 1 NM: "
        + "см. блок airspace.permission. Отдельных запретных зон внутри квадрата AIP не публикует.",
      realityNoteEn:
        "This is OUR demo circle. The only published regime over Potsdamer Platz is ED-R 146 (3 NM circle around "
        + "the Reichstag, GND–5000 ft MSL, AIP Germany ENR 5.1), and it covers the whole square within its inner 1 NM "
        + "tier: see airspace.permission. The AIP publishes no separate prohibited areas inside the square.",
    },
    { id: "nfz-crowd", name: "Плотная толпа — Потсдамер-плац (площадь у станции)", kind: "temporary", center: [13.3760, 52.5096], radiusM: 180, until: "2026-12-31T16:00:00Z" },
  ],
  vienna: [
    {
      // Вена, 16.09.2026. Реальный режим: весь квадрат внутри CTR LOWW (полигон
      // из WFS Austro Control, GND–2500 ft AMSL, класс D) — это блок
      // airspace.permission на 100 % клеток. Постоянных запретных зон в Австрии
      // нет (ENR 5.1). Круг ниже — НАША демо-геометрия над собором Св. Стефана
      // (136 м, самое высокое в квадрате), не опубликованный контур.
      id: "nfz-stephansdom", name: "Собор Св. Стефана (демо-геометрия)", kind: "permanent",
      center: [16.3726, 48.2086], radiusM: 150,
      realityNote:
        "Это НАША демо-окружность. Опубликованный режим над Внутренним городом один — CTR LOWW (полигон из WFS "
        + "Austro Control: GND–2500 ft AMSL, класс D, Wien Tower), и он покрывает квадрат целиком: см. блок "
        + "airspace.permission. Постоянных запретных зон в Австрии нет (ENR 5.1).",
      realityNoteEn:
        "This is OUR demo circle. The only published regime over the Innere Stadt is the LOWW CTR (polygon from "
        + "Austro Control's WFS: GND–2500 ft AMSL, class D, Wien Tower), and it covers the whole square: see "
        + "airspace.permission. Austria publishes no permanent prohibited areas (ENR 5.1).",
    },
    { id: "nfz-crowd", name: "Плотная толпа — Штефансплац и Грабен", kind: "temporary", center: [16.3705, 48.2088], radiusM: 160, until: "2026-12-31T16:00:00Z" },
  ],
};
export const WIND: Record<string, WindConfig> = {
  // Астана — открытая степь, преобладающий юго-западный/южный ветер, сильный.
  astana: { fromDeg: 210, baseMs: 4, perBandMs: 1.6 },
  // Нью-Йорк — преобладающий западный/северо-западный.
  nyc: { fromDeg: 290, baseMs: 3, perBandMs: 1.3 },
  // Токио — летний тихоокеанский муссон, преобладающий южный ветер, умеренный.
  tokyo: { fromDeg: 180, baseMs: 3, perBandMs: 1.2 },
  // Сингапур — экватор, слабые ветры; северо-восточный муссон (дек–март)
  // преобладает по силе. Живой METAR WSSS (Чанги) перекрывает это значение.
  singapore: { fromDeg: 45, baseMs: 2.5, perBandMs: 1.0 },
  // Амстердам — приморская равнина, преобладающий юго-западный ветер, свежий.
  // Живой METAR EHAM (Схипхол, ~7 км от Зёйдаса) перекрывает это значение.
  amsterdam: { fromDeg: 230, baseMs: 4, perBandMs: 1.4 },
  // Берлин — равнина, преобладающий западный/юго-западный ветер, умеренный.
  // Живой METAR EDDB (Бранденбург, ~20 км к юго-востоку) перекрывает это значение.
  berlin: { fromDeg: 250, baseMs: 3.5, perBandMs: 1.3 },
  // Вена — Венская котловина, преобладающий западный/северо-западный ветер.
  // Живой METAR LOWW (Швехат, ~17 км) перекрывает это значение.
  vienna: { fromDeg: 300, baseMs: 3.5, perBandMs: 1.3 },
};
