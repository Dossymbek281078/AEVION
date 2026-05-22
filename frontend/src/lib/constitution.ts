/**
 * Constitution simulator — shared core.
 *
 * Pure data + pure functions. No React, no fetch, no DOM.
 * Imported by:
 *   - app/constitution/page.tsx (full UI)
 *   - components/ConstitutionEmbed.tsx (read-only widget)
 *   - app/constitution/opengraph-image.tsx (OG renderer)
 *
 * Keep this file dependency-free so it can be used in Edge runtime
 * (where opengraph-image runs).
 */

export type Sliders = {
  floor: number;
  ruleOfLaw: number;
  rotation: number;
  transparency: number;
  multiStatus: number;
  skinInGame: number;
  polycentricity: number;
  positiveSum: number;
};

export const DEFAULT_SLIDERS: Sliders = {
  floor: 30,
  ruleOfLaw: 50,
  rotation: 20,
  transparency: 40,
  multiStatus: 30,
  skinInGame: 30,
  polycentricity: 30,
  positiveSum: 60,
};

export type SliderMeta = {
  key: keyof Sliders;
  label: string;
  hint: string;
  low: string;
  high: string;
};

export const SLIDER_META: SliderMeta[] = [
  {
    key: "floor",
    label: "Пол снизу",
    hint: "Гарантированный минимум: базовый доход / образование / здоровье",
    low: "Каждый сам за себя",
    high: "Никто не падает ниже пола",
  },
  {
    key: "ruleOfLaw",
    label: "Закон обязателен и для верха",
    hint: "Олигарх тоже может проиграть в суде",
    low: "Закон для бедных",
    high: "Все равны под законом",
  },
  {
    key: "rotation",
    label: "Ротация / жребий",
    hint: "Случайные граждане в палатах, советах, жюри",
    low: "Пожизненные касты",
    high: "Регулярная смена через жребий",
  },
  {
    key: "transparency",
    label: "Прозрачность элит",
    hint: "Открытые декларации, публичный учёт решений",
    low: "Тёмные комнаты",
    high: "Стеклянные коридоры",
  },
  {
    key: "multiStatus",
    label: "Множественные статусы",
    hint: "Уважение через науку, ремесло, заботу, искусство — не только деньги",
    low: "Одна ось — деньги/власть",
    high: "Много легитимных арен",
  },
  {
    key: "skinInGame",
    label: "Skin in the game",
    hint: "Кто принимает решение — несёт последствия лично (Талеб)",
    low: "Решают одни, отвечают другие",
    high: "Каждый при своих ставках",
  },
  {
    key: "polycentricity",
    label: "Полицентричность",
    hint: "Реальный суверенитет локальных юрисдикций (Остром)",
    low: "Сверх-государство",
    high: "Федерация локальностей",
  },
  {
    key: "positiveSum",
    label: "Положительная сумма",
    hint: "Реально и видимо растущий пирог (Acemoglu/Robinson)",
    low: "Распил фиксированного",
    high: "Растущая экономика для всех",
  },
];

export const SLIDER_SHORT_LABELS: Record<keyof Sliders, string> = {
  floor: "Пол",
  ruleOfLaw: "Закон",
  rotation: "Ротация",
  transparency: "Прозр.",
  multiStatus: "Multi-status",
  skinInGame: "Skin",
  polycentricity: "Полицентр.",
  positiveSum: "Pos-sum",
};

export type Metrics = {
  eliteFear: number;
  intraConflict: number;
  resentment: number;
  innovation: number;
  stability: number;
  legitimacy: number;
};

export function computeMetrics(s: Sliders): Metrics {
  const inv = (x: number) => 100 - x;
  return {
    eliteFear: Math.round(
      inv(s.floor) * 0.3 +
        inv(s.ruleOfLaw) * 0.3 +
        inv(s.transparency) * 0.2 +
        inv(s.positiveSum) * 0.2,
    ),
    intraConflict: Math.round(
      inv(s.rotation) * 0.4 + inv(s.multiStatus) * 0.4 + inv(s.ruleOfLaw) * 0.2,
    ),
    resentment: Math.round(
      inv(s.floor) * 0.4 + inv(s.transparency) * 0.3 + inv(s.skinInGame) * 0.3,
    ),
    innovation: Math.round(
      s.positiveSum * 0.5 + s.polycentricity * 0.25 + s.multiStatus * 0.25,
    ),
    stability: Math.round(
      s.ruleOfLaw * 0.4 + s.floor * 0.3 + s.transparency * 0.2 + s.rotation * 0.1,
    ),
    legitimacy: Math.round(
      s.transparency * 0.3 + s.ruleOfLaw * 0.3 + s.floor * 0.2 + s.rotation * 0.2,
    ),
  };
}

export type Regime = {
  id: string;
  name: string;
  era: string;
  summary: string;
  pros: string;
  cons: string;
};

export function classify(s: Sliders): Regime {
  const hi = (x: number) => x >= 65;
  const md = (x: number) => x >= 35 && x < 65;
  const lo = (x: number) => x < 35;

  if (
    hi(s.floor) &&
    hi(s.ruleOfLaw) &&
    hi(s.transparency) &&
    hi(s.multiStatus) &&
    hi(s.rotation) &&
    hi(s.polycentricity) &&
    hi(s.positiveSum)
  ) {
    return {
      id: "open-access",
      name: "Открытый порядок (Open Access)",
      era: "Идеал — North / Wallis / Weingast",
      summary:
        "Все опоры закреплены: положительная сумма, закон для всех, пол снизу, ротация, прозрачность, разные оси статуса. Элиты конкурируют, но не уничтожают друг друга — большой пирог делает интригу дороже честной игры.",
      pros: "Низкая интра-элитная вражда, высокая легитимность, мощная инновация.",
      cons: "Хрупко в кризис: войну/пандемию проходит хуже мобилизационных режимов. Требует постоянного роста.",
    };
  }

  if (
    hi(s.floor) &&
    hi(s.ruleOfLaw) &&
    hi(s.transparency) &&
    !hi(s.polycentricity)
  ) {
    return {
      id: "nordic",
      name: "Скандинавская модель",
      era: "Швеция / Дания / Норвегия — после 1945",
      summary:
        "Высокий пол снизу, верховенство закона, прозрачность государства. Элита не боится низа — потому что низа в экзистенциальном смысле нет.",
      pros: "Минимальная социальная напряжённость, высокое доверие, низкая коррупция.",
      cons: "Дорого. Требует культурной однородности или сильной интеграции. Тормозит часть инновации.",
    };
  }

  if (
    lo(s.ruleOfLaw) &&
    lo(s.rotation) &&
    lo(s.transparency) &&
    lo(s.polycentricity)
  ) {
    return {
      id: "totalitarian",
      name: "Тоталитарная диктатура",
      era: "Сталинский СССР, маоистский Китай, КНДР",
      summary:
        "Одна партия, один лидер. Закона как защиты от власти нет, ротации нет, прозрачности нет. Элиты боятся друг друга и низа одинаково сильно.",
      pros: "Способность к экстремальной мобилизации.",
      cons: "Самоистребление верха (чистки), технологическая отсталость, наследование власти — катастрофа.",
    };
  }

  if (
    lo(s.ruleOfLaw) &&
    lo(s.transparency) &&
    lo(s.rotation) &&
    !lo(s.polycentricity)
  ) {
    return {
      id: "authoritarian",
      name: "Авторитарная вертикаль",
      era: "XX век — Латинская Америка, постсоветские режимы",
      summary:
        "Один центр, закон применим избирательно, прозрачности нет, ротации нет. Элита боится низа постоянно — между ними нет правил.",
      pros: "Быстрая мобилизация в кризис, видимая стабильность на горизонте десятилетия.",
      cons: "Постоянная паранойя верха. Любой кризис преемственности — революция или хаос.",
    };
  }

  if (lo(s.floor) && lo(s.ruleOfLaw) && lo(s.transparency) && hi(s.positiveSum)) {
    return {
      id: "extractive-boom",
      name: "Экстрактивный бум",
      era: "Бельгийское Конго; нефтяные циклы",
      summary:
        "Пирог реально растёт, но достаётся очень узкой группе. Без пола снизу, закона и прозрачности — растущее напряжение, отложенный взрыв.",
      pros: "Высокие темпы роста в краткосрок.",
      cons: "Взрывается на первой длинной просадке цены ресурса.",
    };
  }

  if (
    hi(s.polycentricity) &&
    hi(s.positiveSum) &&
    hi(s.multiStatus) &&
    md(s.ruleOfLaw)
  ) {
    return {
      id: "network-post-nation",
      name: "Сетевая постнация",
      era: "Гипотеза — конкурирующие юрисдикции 2030-х",
      summary:
        "Не одно государство, а лоскутное одеяло конкурирующих юрисдикций. Люди выбирают, под какие правила им встать.",
      pros: "Конкуренция систем, кто хочет — переезжает. Меньше захвата.",
      cons: "Слабые гарантии в кризис. Цифровое неравенство закрепляется юридически.",
    };
  }

  if (lo(s.floor) && md(s.ruleOfLaw) && lo(s.rotation) && lo(s.multiStatus)) {
    return {
      id: "feudalism",
      name: "Поздний феодализм",
      era: "Европа XIV–XVII в.; неофеодальные сценарии",
      summary:
        "Наследственная элита, низ привязан к земле/работодателю, закон уважает форму, но не суть. Бунт случается раз в поколение и обычно ничего не меняет.",
      pros: "Стабильность через инерцию.",
      cons: "Низкая инновация, технологическое отставание, рано или поздно сменяется силой.",
    };
  }

  if (hi(s.rotation) && !hi(s.floor) && lo(s.multiStatus)) {
    return {
      id: "ancient-polis",
      name: "Античный полис",
      era: "Афины V в. до н.э.",
      summary:
        "Жребий и ротация в основе устройства, но «полноправные» — это только узкая группа. Снаружи — рабы и метеки.",
      pros: "Минимальная грызня внутри гражданского круга.",
      cons: "Систематическое исключение большой части населения.",
    };
  }

  if (
    hi(s.ruleOfLaw) &&
    md(s.transparency) &&
    md(s.floor) &&
    md(s.multiStatus)
  ) {
    return {
      id: "modern-liberal",
      name: "Современная либеральная демократия",
      era: "ЕС / США / Япония / Канада — XXI век",
      summary:
        "Закон работает, прозрачность присутствует, пол снизу средний. Элиты грызутся, но в рамках процедур. Низ может голосовать, но редко участвует в реальных решениях.",
      pros: "Большинство в безопасности. Сильная инновация.",
      cons: "Растущее ощущение, что «они нас не слышат». Олигархизация политики через деньги.",
    };
  }

  return {
    id: "mixed",
    name: "Смешанный неустойчивый режим",
    era: "Гибрид — рано классифицировать",
    summary:
      "Параметры не складываются в чистую историческую модель. Система может качнуться в любую сторону — конкретный режим определит первый кризис.",
    pros: "Возможность настройки в желаемую сторону.",
    cons: "Неустойчиво. Доверие пока слабое в любую сторону.",
  };
}

export type Preset = { name: string; sliders: Sliders };

export const PRESETS: Preset[] = [
  { name: "Open Access (идеал)", sliders: { floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80, multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80 } },
  { name: "Скандинавская",       sliders: { floor: 80, ruleOfLaw: 85, rotation: 40, transparency: 80, multiStatus: 55, skinInGame: 50, polycentricity: 30, positiveSum: 65 } },
  { name: "США XXI века",        sliders: { floor: 35, ruleOfLaw: 65, rotation: 25, transparency: 60, multiStatus: 50, skinInGame: 35, polycentricity: 55, positiveSum: 70 } },
  { name: "Авторитарная",        sliders: { floor: 30, ruleOfLaw: 25, rotation: 10, transparency: 15, multiStatus: 25, skinInGame: 25, polycentricity: 15, positiveSum: 50 } },
  { name: "Феодализм",           sliders: { floor: 15, ruleOfLaw: 35, rotation: 5,  transparency: 20, multiStatus: 25, skinInGame: 60, polycentricity: 70, positiveSum: 25 } },
  { name: "Сингапур",            sliders: { floor: 65, ruleOfLaw: 80, rotation: 15, transparency: 65, multiStatus: 40, skinInGame: 55, polycentricity: 10, positiveSum: 85 } },
  { name: "ОАЭ",                 sliders: { floor: 55, ruleOfLaw: 50, rotation: 5,  transparency: 25, multiStatus: 30, skinInGame: 40, polycentricity: 15, positiveSum: 80 } },
  { name: "Саудовская Аравия",   sliders: { floor: 60, ruleOfLaw: 30, rotation: 5,  transparency: 15, multiStatus: 20, skinInGame: 25, polycentricity: 10, positiveSum: 55 } },
  { name: "СССР 1980",           sliders: { floor: 65, ruleOfLaw: 20, rotation: 10, transparency: 10, multiStatus: 30, skinInGame: 35, polycentricity: 10, positiveSum: 35 } },
  { name: "Кочевая Степь",       sliders: { floor: 40, ruleOfLaw: 45, rotation: 60, transparency: 70, multiStatus: 65, skinInGame: 90, polycentricity: 85, positiveSum: 35 } },
];

export type Country = { code: string; flag: string; name: string; sliders: Sliders };

export const COUNTRIES: Country[] = [
  { code: "us", flag: "🇺🇸", name: "США",          sliders: { floor: 35, ruleOfLaw: 65, rotation: 25, transparency: 60, multiStatus: 60, skinInGame: 35, polycentricity: 65, positiveSum: 75 } },
  { code: "de", flag: "🇩🇪", name: "Германия",     sliders: { floor: 75, ruleOfLaw: 85, rotation: 40, transparency: 75, multiStatus: 60, skinInGame: 50, polycentricity: 65, positiveSum: 65 } },
  { code: "no", flag: "🇳🇴", name: "Норвегия",     sliders: { floor: 90, ruleOfLaw: 90, rotation: 50, transparency: 90, multiStatus: 60, skinInGame: 55, polycentricity: 30, positiveSum: 70 } },
  { code: "jp", flag: "🇯🇵", name: "Япония",       sliders: { floor: 70, ruleOfLaw: 80, rotation: 25, transparency: 65, multiStatus: 65, skinInGame: 50, polycentricity: 30, positiveSum: 60 } },
  { code: "sg", flag: "🇸🇬", name: "Сингапур",     sliders: { floor: 65, ruleOfLaw: 80, rotation: 15, transparency: 65, multiStatus: 40, skinInGame: 55, polycentricity: 10, positiveSum: 85 } },
  { code: "ae", flag: "🇦🇪", name: "ОАЭ",          sliders: { floor: 55, ruleOfLaw: 50, rotation: 5,  transparency: 25, multiStatus: 30, skinInGame: 40, polycentricity: 15, positiveSum: 80 } },
  { code: "sa", flag: "🇸🇦", name: "Сауд. Аравия", sliders: { floor: 60, ruleOfLaw: 30, rotation: 5,  transparency: 15, multiStatus: 20, skinInGame: 25, polycentricity: 10, positiveSum: 55 } },
  { code: "ru", flag: "🇷🇺", name: "Россия",       sliders: { floor: 35, ruleOfLaw: 25, rotation: 10, transparency: 20, multiStatus: 30, skinInGame: 30, polycentricity: 25, positiveSum: 50 } },
  { code: "cn", flag: "🇨🇳", name: "Китай",        sliders: { floor: 50, ruleOfLaw: 35, rotation: 10, transparency: 20, multiStatus: 35, skinInGame: 35, polycentricity: 30, positiveSum: 80 } },
  { code: "ir", flag: "🇮🇷", name: "Иран",         sliders: { floor: 30, ruleOfLaw: 25, rotation: 15, transparency: 15, multiStatus: 30, skinInGame: 30, polycentricity: 25, positiveSum: 35 } },
  { code: "kp", flag: "🇰🇵", name: "КНДР",         sliders: { floor: 15, ruleOfLaw: 5,  rotation: 0,  transparency: 5,  multiStatus: 10, skinInGame: 15, polycentricity: 5,  positiveSum: 20 } },
  { code: "ve", flag: "🇻🇪", name: "Венесуэла",    sliders: { floor: 25, ruleOfLaw: 15, rotation: 10, transparency: 15, multiStatus: 25, skinInGame: 25, polycentricity: 25, positiveSum: 25 } },
  { code: "in", flag: "🇮🇳", name: "Индия",        sliders: { floor: 35, ruleOfLaw: 55, rotation: 30, transparency: 50, multiStatus: 55, skinInGame: 40, polycentricity: 70, positiveSum: 65 } },
  { code: "br", flag: "🇧🇷", name: "Бразилия",     sliders: { floor: 40, ruleOfLaw: 45, rotation: 25, transparency: 50, multiStatus: 50, skinInGame: 35, polycentricity: 60, positiveSum: 50 } },
  { code: "kz", flag: "🇰🇿", name: "Казахстан",    sliders: { floor: 50, ruleOfLaw: 40, rotation: 10, transparency: 30, multiStatus: 30, skinInGame: 35, polycentricity: 25, positiveSum: 60 } },
];

export function countryByCode(code: string): Country | undefined {
  const lc = code.toLowerCase();
  return COUNTRIES.find((c) => c.code === lc);
}

export function countryByName(name: string): Country | undefined {
  const lc = name.toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === lc);
}
