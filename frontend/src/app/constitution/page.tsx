"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API = "/api-backend/api/constitution";
const STORAGE_KEY = "constitution.draft";

type Sliders = {
  floor: number;
  ruleOfLaw: number;
  rotation: number;
  transparency: number;
  multiStatus: number;
  skinInGame: number;
  polycentricity: number;
  positiveSum: number;
};

const DEFAULT_SLIDERS: Sliders = {
  floor: 30,
  ruleOfLaw: 50,
  rotation: 20,
  transparency: 40,
  multiStatus: 30,
  skinInGame: 30,
  polycentricity: 30,
  positiveSum: 60,
};

type SliderMeta = {
  key: keyof Sliders;
  label: string;
  hint: string;
  low: string;
  high: string;
};

const SLIDER_META: SliderMeta[] = [
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

type Metrics = {
  eliteFear: number;
  intraConflict: number;
  resentment: number;
  innovation: number;
  stability: number;
  legitimacy: number;
};

function computeMetrics(s: Sliders): Metrics {
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

type Regime = {
  id: string;
  name: string;
  era: string;
  summary: string;
  pros: string;
  cons: string;
};

function classify(s: Sliders): Regime {
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

type Preset = { name: string; sliders: Sliders };

const PRESETS: Preset[] = [
  {
    name: "Open Access (идеал)",
    sliders: {
      floor: 75,
      ruleOfLaw: 85,
      rotation: 70,
      transparency: 80,
      multiStatus: 75,
      skinInGame: 70,
      polycentricity: 65,
      positiveSum: 80,
    },
  },
  {
    name: "Скандинавская",
    sliders: {
      floor: 80,
      ruleOfLaw: 85,
      rotation: 40,
      transparency: 80,
      multiStatus: 55,
      skinInGame: 50,
      polycentricity: 30,
      positiveSum: 65,
    },
  },
  {
    name: "США XXI века",
    sliders: {
      floor: 35,
      ruleOfLaw: 65,
      rotation: 25,
      transparency: 60,
      multiStatus: 50,
      skinInGame: 35,
      polycentricity: 55,
      positiveSum: 70,
    },
  },
  {
    name: "Авторитарная",
    sliders: {
      floor: 30,
      ruleOfLaw: 25,
      rotation: 10,
      transparency: 15,
      multiStatus: 25,
      skinInGame: 25,
      polycentricity: 15,
      positiveSum: 50,
    },
  },
  {
    name: "Феодализм",
    sliders: {
      floor: 15,
      ruleOfLaw: 35,
      rotation: 5,
      transparency: 20,
      multiStatus: 25,
      skinInGame: 60,
      polycentricity: 70,
      positiveSum: 25,
    },
  },
  {
    name: "Сингапур",
    sliders: {
      floor: 65,
      ruleOfLaw: 80,
      rotation: 15,
      transparency: 65,
      multiStatus: 40,
      skinInGame: 55,
      polycentricity: 10,
      positiveSum: 85,
    },
  },
  {
    name: "ОАЭ",
    sliders: {
      floor: 55,
      ruleOfLaw: 50,
      rotation: 5,
      transparency: 25,
      multiStatus: 30,
      skinInGame: 40,
      polycentricity: 15,
      positiveSum: 80,
    },
  },
  {
    name: "Саудовская Аравия",
    sliders: {
      floor: 60,
      ruleOfLaw: 30,
      rotation: 5,
      transparency: 15,
      multiStatus: 20,
      skinInGame: 25,
      polycentricity: 10,
      positiveSum: 55,
    },
  },
  {
    name: "СССР 1980",
    sliders: {
      floor: 65,
      ruleOfLaw: 20,
      rotation: 10,
      transparency: 10,
      multiStatus: 30,
      skinInGame: 35,
      polycentricity: 10,
      positiveSum: 35,
    },
  },
  {
    name: "Кочевая Степь",
    sliders: {
      floor: 40,
      ruleOfLaw: 45,
      rotation: 60,
      transparency: 70,
      multiStatus: 65,
      skinInGame: 90,
      polycentricity: 85,
      positiveSum: 35,
    },
  },
];

type Country = { flag: string; name: string; sliders: Sliders };

const COUNTRIES: Country[] = [
  { flag: "🇺🇸", name: "США",         sliders: { floor: 35, ruleOfLaw: 65, rotation: 25, transparency: 60, multiStatus: 60, skinInGame: 35, polycentricity: 65, positiveSum: 75 } },
  { flag: "🇩🇪", name: "Германия",    sliders: { floor: 75, ruleOfLaw: 85, rotation: 40, transparency: 75, multiStatus: 60, skinInGame: 50, polycentricity: 65, positiveSum: 65 } },
  { flag: "🇳🇴", name: "Норвегия",    sliders: { floor: 90, ruleOfLaw: 90, rotation: 50, transparency: 90, multiStatus: 60, skinInGame: 55, polycentricity: 30, positiveSum: 70 } },
  { flag: "🇯🇵", name: "Япония",      sliders: { floor: 70, ruleOfLaw: 80, rotation: 25, transparency: 65, multiStatus: 65, skinInGame: 50, polycentricity: 30, positiveSum: 60 } },
  { flag: "🇸🇬", name: "Сингапур",    sliders: { floor: 65, ruleOfLaw: 80, rotation: 15, transparency: 65, multiStatus: 40, skinInGame: 55, polycentricity: 10, positiveSum: 85 } },
  { flag: "🇦🇪", name: "ОАЭ",         sliders: { floor: 55, ruleOfLaw: 50, rotation: 5,  transparency: 25, multiStatus: 30, skinInGame: 40, polycentricity: 15, positiveSum: 80 } },
  { flag: "🇸🇦", name: "Сауд. Аравия", sliders: { floor: 60, ruleOfLaw: 30, rotation: 5,  transparency: 15, multiStatus: 20, skinInGame: 25, polycentricity: 10, positiveSum: 55 } },
  { flag: "🇷🇺", name: "Россия",      sliders: { floor: 35, ruleOfLaw: 25, rotation: 10, transparency: 20, multiStatus: 30, skinInGame: 30, polycentricity: 25, positiveSum: 50 } },
  { flag: "🇨🇳", name: "Китай",       sliders: { floor: 50, ruleOfLaw: 35, rotation: 10, transparency: 20, multiStatus: 35, skinInGame: 35, polycentricity: 30, positiveSum: 80 } },
  { flag: "🇮🇷", name: "Иран",        sliders: { floor: 30, ruleOfLaw: 25, rotation: 15, transparency: 15, multiStatus: 30, skinInGame: 30, polycentricity: 25, positiveSum: 35 } },
  { flag: "🇰🇵", name: "КНДР",        sliders: { floor: 15, ruleOfLaw: 5,  rotation: 0,  transparency: 5,  multiStatus: 10, skinInGame: 15, polycentricity: 5,  positiveSum: 20 } },
  { flag: "🇻🇪", name: "Венесуэла",   sliders: { floor: 25, ruleOfLaw: 15, rotation: 10, transparency: 15, multiStatus: 25, skinInGame: 25, polycentricity: 25, positiveSum: 25 } },
  { flag: "🇮🇳", name: "Индия",       sliders: { floor: 35, ruleOfLaw: 55, rotation: 30, transparency: 50, multiStatus: 55, skinInGame: 40, polycentricity: 70, positiveSum: 65 } },
  { flag: "🇧🇷", name: "Бразилия",    sliders: { floor: 40, ruleOfLaw: 45, rotation: 25, transparency: 50, multiStatus: 50, skinInGame: 35, polycentricity: 60, positiveSum: 50 } },
  { flag: "🇰🇿", name: "Казахстан",   sliders: { floor: 50, ruleOfLaw: 40, rotation: 10, transparency: 30, multiStatus: 30, skinInGame: 35, polycentricity: 25, positiveSum: 60 } },
];

type SavedScenario = {
  id: string;
  title: string;
  regime: string;
  createdAt: string;
};

export default function ConstitutionPage() {
  const [sliders, setSliders] = useState<Sliders>(DEFAULT_SLIDERS);
  const [title, setTitle] = useState<string>("");
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [savedTotal, setSavedTotal] = useState<number>(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Sliders>;
        if (parsed && typeof parsed === "object") {
          setSliders({ ...DEFAULT_SLIDERS, ...parsed });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sliders));
    } catch {
      /* ignore */
    }
  }, [sliders]);

  const loadRecent = useCallback(async () => {
    try {
      const r = await fetch(`${API}/scenarios?limit=10`);
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j?.items)) {
        const items = j.items as Array<{
          id: string;
          title: string;
          summary?: string | null;
          createdAt: string;
        }>;
        setSaved(
          items.map((it) => ({
            id: it.id,
            title: it.title,
            regime: it.summary ?? "",
            createdAt: it.createdAt,
          })),
        );
        setSavedTotal(typeof j.total === "number" ? j.total : items.length);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const metrics = useMemo(() => computeMetrics(sliders), [sliders]);
  const regime = useMemo(() => classify(sliders), [sliders]);

  const setSlider = useCallback(
    (k: keyof Sliders, v: number) => setSliders((s) => ({ ...s, [k]: v })),
    [],
  );

  const reset = useCallback(() => setSliders(DEFAULT_SLIDERS), []);

  const save = useCallback(async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sliders,
          regime: regime.name,
          metrics,
          tags: ["governance", regime.id],
        }),
      });
      if (r.ok) {
        setTitle("");
        await loadRecent();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [title, sliders, regime, metrics, loadRecent]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <Link href="/" className="text-[#d4af37] hover:underline text-sm">
            ← AEVION
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            Constitution — Лаборатория устройства мира
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">
            Восемь параметров — четыре опоры, на которых элиты перестают бояться низа и грызться между собой.
            Двигай ползунки, смотри, в какой исторический режим скатывается система. Сохрани сценарий — увидишь,
            что выбрали другие.
          </p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#f5d27a]">Восемь параметров</h2>
              <button
                type="button"
                onClick={reset}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                Сброс
              </button>
            </div>

            <div className="space-y-4">
              {SLIDER_META.map((m) => {
                const val = sliders[m.key];
                return (
                  <div key={m.key}>
                    <div className="flex justify-between items-baseline">
                      <label htmlFor={`s-${m.key}`} className="font-medium">
                        {m.label}
                      </label>
                      <span className="text-[#d4af37] font-mono text-sm">{val}</span>
                    </div>
                    <input
                      id={`s-${m.key}`}
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => setSlider(m.key, Number(e.target.value))}
                      className="w-full accent-[#d4af37]"
                    />
                    <div className="flex justify-between text-xs text-[#9aa3c0] mt-1">
                      <span>{m.low}</span>
                      <span>{m.high}</span>
                    </div>
                    <p className="text-xs text-[#9aa3c0] italic mt-1">{m.hint}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-[#d4af37]/20">
              <div className="text-xs text-[#9aa3c0] mb-2">Пресеты:</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSliders(p.sliders)}
                    className="text-xs px-3 py-1 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wide text-[#9aa3c0]">
                Получившийся режим
              </div>
              <h3 className="text-2xl font-bold text-[#d4af37] mt-1">{regime.name}</h3>
              <div className="text-sm text-[#9aa3c0] italic">{regime.era}</div>
              <p className="mt-3">{regime.summary}</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="border border-emerald-500/30 rounded p-3 bg-emerald-500/5">
                  <div className="text-emerald-300 text-xs uppercase mb-1">Плюсы</div>
                  <div>{regime.pros}</div>
                </div>
                <div className="border border-rose-500/30 rounded p-3 bg-rose-500/5">
                  <div className="text-rose-300 text-xs uppercase mb-1">Минусы</div>
                  <div>{regime.cons}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-3">Шесть индексов</h3>
              <MetricBar label="Страх элит перед низом" value={metrics.eliteFear} invert />
              <MetricBar label="Грызня внутри элит" value={metrics.intraConflict} invert />
              <MetricBar label="Обида низа на верх" value={metrics.resentment} invert />
              <MetricBar label="Инновация / драйв" value={metrics.innovation} />
              <MetricBar label="Устойчивость" value={metrics.stability} />
              <MetricBar label="Легитимность" value={metrics.legitimacy} />
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-3">
                Сохранить сценарий{savedTotal > 0 ? ` (всего: ${savedTotal})` : ""}
              </h3>
              <div className="flex gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название (например, «Казахстан-2050»)"
                  className="flex-1 bg-[#050a1a] border border-[#d4af37]/30 rounded px-3 py-2 text-sm"
                  maxLength={120}
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !title.trim()}
                  className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold disabled:opacity-40"
                >
                  {busy ? "..." : "Сохранить"}
                </button>
              </div>
              {saved.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-[#9aa3c0] mb-2">Недавние сценарии:</div>
                  <ul className="space-y-1 text-sm">
                    {saved.slice(0, 8).map((it) => (
                      <li
                        key={it.id}
                        className="flex justify-between border-b border-[#d4af37]/10 py-1"
                      >
                        <span className="truncate flex-1">{it.title}</span>
                        <span className="text-[#9aa3c0] text-xs ml-2 truncate max-w-[40%]">
                          {it.regime}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <WorldMapScatter sliders={sliders} />
        </section>

        <footer className="mt-8 text-xs text-[#9aa3c0] max-w-3xl">
          <p>
            Теоретическая основа: North / Wallis / Weingast «Violence and Social Orders»,
            Acemoglu / Robinson «Why Nations Fail», Elinor Ostrom «Governing the Commons»,
            Nassim Taleb «Skin in the Game».
          </p>
        </footer>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const color = invert
    ? value > 60
      ? "bg-rose-500"
      : value > 30
        ? "bg-amber-500"
        : "bg-emerald-500"
    : value > 60
      ? "bg-emerald-500"
      : value > 30
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="text-[#d4af37] font-mono">{value}</span>
      </div>
      <div className="w-full h-2 bg-[#050a1a] rounded">
        <div className={`h-full rounded ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function WorldMapScatter({ sliders }: { sliders: Sliders }) {
  const currentMetrics = computeMetrics(sliders);
  const W = 720;
  const H = 480;
  const PAD = 56;
  const xFor = (v: number) => PAD + ((100 - v) / 100) * (W - 2 * PAD); // invert: low elite-fear → right
  const yFor = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD); // high innovation → top

  const points = COUNTRIES.map((c) => {
    const m = computeMetrics(c.sliders);
    return { ...c, eliteFear: m.eliteFear, innovation: m.innovation };
  });

  const cx = xFor(currentMetrics.eliteFear);
  const cy = yFor(currentMetrics.innovation);

  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">
          Где ты на карте мира
        </h3>
        <div className="text-xs text-[#9aa3c0]">
          ось X — страх элит перед низом (←&nbsp;выше) · ось Y — инновация / драйв (↑&nbsp;выше)
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-w-full"
          style={{ minWidth: 480 }}
        >
          {/* axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.4} />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.4} />
          {/* gridlines at 50 */}
          <line x1={xFor(50)} y1={PAD} x2={xFor(50)} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.12} strokeDasharray="4 6" />
          <line x1={PAD} y1={yFor(50)} x2={W - PAD} y2={yFor(50)} stroke="#d4af37" strokeOpacity={0.12} strokeDasharray="4 6" />
          {/* quadrant labels */}
          <text x={W - PAD - 8} y={PAD + 14} textAnchor="end" fill="#10b981" fontSize="11" opacity={0.7}>
            ↗ свобода + рост
          </text>
          <text x={PAD + 8} y={PAD + 14} fill="#f97316" fontSize="11" opacity={0.7}>
            страх + рост
          </text>
          <text x={W - PAD - 8} y={H - PAD - 8} textAnchor="end" fill="#9aa3c0" fontSize="11" opacity={0.7}>
            свобода + застой
          </text>
          <text x={PAD + 8} y={H - PAD - 8} fill="#ef4444" fontSize="11" opacity={0.7}>
            ↙ страх + застой
          </text>
          {/* axis ticks */}
          <text x={PAD} y={H - PAD + 18} fill="#9aa3c0" fontSize="10">100</text>
          <text x={W - PAD} y={H - PAD + 18} textAnchor="end" fill="#9aa3c0" fontSize="10">0</text>
          <text x={PAD - 6} y={PAD + 4} textAnchor="end" fill="#9aa3c0" fontSize="10">100</text>
          <text x={PAD - 6} y={H - PAD} textAnchor="end" fill="#9aa3c0" fontSize="10">0</text>
          <text x={W / 2} y={H - PAD + 32} textAnchor="middle" fill="#d4af37" fontSize="12">
            страх элит перед низом ←
          </text>
          <text
            x={PAD - 28}
            y={H / 2}
            textAnchor="middle"
            fill="#d4af37"
            fontSize="12"
            transform={`rotate(-90 ${PAD - 28} ${H / 2})`}
          >
            ↑ инновация / драйв
          </text>

          {/* country points */}
          {points.map((p) => (
            <g key={p.name}>
              <circle cx={xFor(p.eliteFear)} cy={yFor(p.innovation)} r={4} fill="#d4af37" opacity={0.55} />
              <text
                x={xFor(p.eliteFear) + 8}
                y={yFor(p.innovation) + 4}
                fontSize="14"
              >
                {p.flag}
              </text>
              <text
                x={xFor(p.eliteFear) + 28}
                y={yFor(p.innovation) + 4}
                fill="#9aa3c0"
                fontSize="10"
              >
                {p.name}
              </text>
            </g>
          ))}

          {/* current scenario — glowing dot */}
          <circle cx={cx} cy={cy} r={14} fill="#22d3ee" opacity={0.18}>
            <animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={7} fill="#22d3ee" stroke="#0b1736" strokeWidth={2} />
          <text x={cx + 12} y={cy + 4} fill="#22d3ee" fontSize="12" fontWeight="bold">
            ты сейчас
          </text>
        </svg>
      </div>
      <p className="text-xs text-[#9aa3c0] mt-3">
        Точка «ты сейчас» считается из текущих ползунков. Чем правее — тем меньше элиты боятся низа.
        Чем выше — тем больше драйва и инновации. Страны — приближённая оценка по шкале 0-100; не научный
        рейтинг, а инструмент для интуиции.
      </p>
    </div>
  );
}
