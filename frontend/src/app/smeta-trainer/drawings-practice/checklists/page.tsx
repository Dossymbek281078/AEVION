"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Checklist {
  id: string;
  icon: string;
  title: string;
  shortTitle: string;
  norm: string;
  items: string[];
}

const CHECKLISTS: Checklist[] = [
  {
    id: "excavation",
    icon: "🔶",
    title: "Котлован",
    shortTitle: "земляных",
    norm: "СНиП РК 5.01-03-2002, СНиП РК 1.03-05-2001",
    items: [
      "Соответствие плановых отметок проекту (по нивелиру ±5 см)",
      "Зачистка дна от воды и мусора",
      "Категория грунта на дне соответствует проекту (геологии)",
      "Откосы устойчивы (трещины, осыпание отсутствуют)",
      "Уплотнение дна (если предусмотрено) — Ку≥0.95",
      "Геодезические отметки (репер закреплён, журнал ведётся)",
      "Защита от подтопления (ливневая канализация если необходимо)",
      "Ограждение котлована (если глубина >1.5 м)",
      "Спуск/подъём для работников (лестница или сходня)",
      "Освещение (если работы в тёмное время суток)",
    ],
  },
  {
    id: "rebar",
    icon: "🏗",
    title: "Армирование фундамента",
    shortTitle: "арматурных",
    norm: "СП РК 5.03-106, ГОСТ 14098",
    items: [
      "Класс арматуры соответствует проекту (А500С / Вр-1)",
      "Сечения соответствуют проекту (Ø10/12/14/16)",
      "Шаг арматуры по горизонтали и вертикали соответствует проекту",
      "Защитный слой бетона: 25 мм для рабочей арматуры, 50 мм для нижней",
      "Анкеровка стержней (длина перепуска ≥ 30·Ø)",
      "Сварные соединения по проекту (с просвечиванием для нагруженных)",
      "Привязка к опалубке (бортики, фиксаторы)",
      "Чистота арматуры (без ржавчины, грязи, масла)",
      "Связка арматуры (вязальная проволока 1.0-1.2 мм)",
      "Контроль кривизны и смещений (макс. 2 мм/м длины)",
      "Сертификаты на арматуру и приёмные документы поставки",
      "Подписан АОСР перед началом бетонирования",
    ],
  },
  {
    id: "formwork",
    icon: "▭",
    title: "Опалубка перекрытия",
    shortTitle: "опалубочных",
    norm: "ГОСТ Р 52085-2003",
    items: [
      "Тип опалубки соответствует проекту (Doka / PERI / самосбор)",
      "Стойки расставлены равномерно по плану",
      "Толщина и тип фанеры (18 мм ламинированная)",
      "Щели между щитами замазаны герметиком/уплотнены",
      "Геометрия проверена нивелиром (отклонения ≤±5 мм)",
      "Бортики высотой ≥ толщины перекрытия + 50 мм",
      "Стяжки и распорки (для боковых сил)",
      "Лестницы и проходы для бетонирования",
      "Защита от падения (ограждение по периметру)",
      "Чистота поверхности (для качественного бетона)",
    ],
  },
  {
    id: "concrete",
    icon: "🟦",
    title: "Бетонирование монолита",
    shortTitle: "бетонных",
    norm: "СП РК 5.03-106, СНиП РК 5.03-37",
    items: [
      "Класс бетона соответствует проекту (М200 / М300 / М400)",
      "Класс водонепроницаемости (W2 / W4 / W6 / W8)",
      "Морозостойкость (F50 / F100 / F150)",
      "Подвижность смеси по проекту (П1 / П2 / П3 / П4)",
      "Документ качества бетонной смеси (паспорт)",
      "Транспортировка ≤ 2 часов от завода",
      "Виброуплотнение каждого слоя (без воздушных карманов)",
      "Контроль прочности через 7 / 28 дней (3 куба на каждое бетонирование)",
      "Уход за бетоном (полив 7-14 дней при +5...+25°C)",
      "Защита от осадков (если бетонируем на открытом)",
      "Зимние мероприятия (если t<+5°C — прогрев или добавки)",
      "Журнал бетонных работ (поэтапно ведётся)",
    ],
  },
  {
    id: "masonry",
    icon: "🧱",
    title: "Кладка кирпичная",
    shortTitle: "кладочных",
    norm: "СП РК 5.05-101, ГОСТ 530",
    items: [
      "Марка кирпича по проекту (М100 / М125 / М150)",
      "Тип кладочного раствора (М75 / М100)",
      "Толщина стен соответствует проекту (250 / 380 / 510 мм)",
      "Толщина горизонтальных швов 8-12 мм",
      "Толщина вертикальных швов 8-15 мм",
      "Перевязка швов соблюдена (минимум через 1 ряд)",
      "Вертикальность стен ≤±5 мм/2.5 м",
      "Горизонтальность рядов ≤±2 мм/м",
      "Армирование швов через 5-7 рядов (если в проекте)",
      "Связь с каркасом (анкеры или сетка)",
    ],
  },
  {
    id: "waterproof",
    icon: "💧",
    title: "Гидроизоляция",
    shortTitle: "гидроизоляционных",
    norm: "СНиП РК 2.04-01",
    items: [
      "Чистота и сухость основания",
      "Грунтовка нанесена (расход 250-350 г/м²)",
      "Тип гидроизоляции по проекту (рулонная / обмазочная / проникающая)",
      "Толщина соответствует проекту (1 слой 4 мм / 2 слоя 3+3 / и т.д.)",
      "Перехлёсты ≥100 мм с прижимом валиком",
      "Углы и примыкания усилены лентой",
      "Защитная стяжка ≥30 мм поверх гидроизоляции",
      "Тест на влагонепроницаемость (через 7 дней)",
      "Сертификат материала + протокол испытаний",
      "Подписан АОСР до закрытия конструкций",
    ],
  },
  {
    id: "windows",
    icon: "🪟",
    title: "Установка окон ПВХ",
    shortTitle: "по установке окон",
    norm: "ГОСТ 30674-99",
    items: [
      "Профиль 5-камерный по ГОСТ 30674",
      "Стеклопакет по проекту (2-камерный / 1-камерный)",
      "Монтажная пена с УФ-защитой 1-1.5 см периметра",
      "Гидроизоляция шва снаружи (паропроницаемая лента)",
      "Пароизоляция шва изнутри (пароизоляционная лента)",
      "Уровни и плоскостность (отклонение ≤2 мм/м)",
      "Зазоры между рамой и проёмом 5-10 мм",
      "Анкера крепления (по 3 на сторону для окна 1.5×1.8)",
      "Откосы установлены (внутри + снаружи)",
      "Подоконник установлен с уклоном 2-3°",
    ],
  },
  {
    id: "cables",
    icon: "⚡",
    title: "Прокладка кабельных сетей",
    shortTitle: "кабельных",
    norm: "ПУЭ 7-е изд. гл. 2.3",
    items: [
      "Глубина траншеи 0.7 м (по ПУЭ для до 35 кВ)",
      "Песчаная постель 100 мм + засыпка 100 мм над кабелем",
      "Расстояние между кабелями ≥100 мм",
      "Кирпич глиняный (НЕ силикатный!) поверх засыпки",
      "Сигнальная лента ЛСО-450 на h=400 мм",
      "Запас на «змейку» 1-3% к длине трассы",
      "Заземление кабелей и брони",
      "Концевые муфты по технологии (термоусадочные/литые)",
      "Маркировка кабелей бирками (адрес, сечение, начало/конец)",
      "Журнал прокладки кабелей + АОСР",
    ],
  },
  {
    id: "pipes",
    icon: "🚰",
    title: "Прокладка трубопроводов",
    shortTitle: "трубопроводных",
    norm: "СНиП РК 4.01-02 / СНиП РК 4.01-41 / СНиП РК 3.05.04",
    items: [
      "Тип трубы по проекту (ПЭ100/ПВХ/сталь)",
      "Глубина заложения по СНиП (для ХВС - hпром+0.5)",
      "Песчаное основание 100-150 мм",
      "Уклон трубы соответствует проекту (для канализации i≥0.005)",
      "Подсыпка над трубой ≥300 мм песком",
      "Сигнальная лента (для ХВС / ГВС / газа)",
      "Колодцы установлены (для каждых 35-50 м для канализации)",
      "Гидравлическое испытание (двукратное рабочее давление)",
      "Дезинфекция (для ХВС — раствор хлора 75-100 мг/л)",
      "АОСР подписан до засыпки",
    ],
  },
  {
    id: "ducts",
    icon: "🌬",
    title: "Монтаж воздуховодов",
    shortTitle: "по монтажу воздуховодов",
    norm: "СП РК 4.02-101",
    items: [
      "Класс плотности (Н — нормальный для общественных)",
      "Толщина стали 0.5-0.7 мм для размеров до 1000 мм",
      "Фланцевые соединения через 1.25-1.5 м",
      "Хомуты крепления через 1.5-3 м (по нагрузке)",
      "Изоляция магистрали (минвата 50 мм или по проекту)",
      "Покровный слой изоляции (ПЭ или фольга)",
      "Решётки и диффузоры по проекту",
      "Огнезадвижки на пересечении противопожарных стен",
      "Испытание на герметичность",
      "Подписан АОСР по системе ОВиК",
    ],
  },
  {
    id: "plaster",
    icon: "🎨",
    title: "Штукатурка",
    shortTitle: "штукатурных",
    norm: "СНиП РК 2.04-26",
    items: [
      "Чистота и сухость основания (влажность ≤5%)",
      "Грунтовка нанесена (для впитывающих оснований)",
      "Маяки выставлены на расстоянии 1.5-2 м",
      "Толщина соответствует проекту (15-25 мм для цементных, 5-15 для гипсовых)",
      "Вертикальность ≤2 мм/м",
      "Плоскостность правилом 2 м: ≤2 мм",
      "Углы наружные (45°-перфолент или штукат. угол)",
      "Углы внутренние ровные (по угольнику)",
      "Сплошность (без пустот, бугров)",
      "Окна и двери защищены от загрязнения",
    ],
  },
  {
    id: "roof",
    icon: "🏠",
    title: "Кровля плоская",
    shortTitle: "кровельных",
    norm: "СНиП РК 2.04-01, СН РК 3.02-22",
    items: [
      "Уклон кровли 1.5-3% (по проекту)",
      "Пароизоляция уложена с перехлёстом 100 мм",
      "Утеплитель по проекту (XPS / минвата плотностью ≥35 кг/м³)",
      "Толщина утеплителя по теплотехнике (для Алматы 200-250 мм)",
      "Стяжка с уклоном (керамзитобетон или цементно-песчаная)",
      "Гидроизоляция в 2 слоя с перехлёстом 100 мм",
      "Парапетные капельники / окантовка",
      "Водоприёмные воронки (через 200-400 м²)",
      "Примыкания к трубам и стенам уплотнены",
      "Тест на ливень после завершения (24 часа стоит вода)",
    ],
  },
];

const STORAGE_KEY = "smeta-checklists-v1";

type ChecksState = Record<string, Record<number, boolean>>;

export default function ChecklistsPage() {
  const [activeId, setActiveId] = useState<string>(CHECKLISTS[0].id);
  const [checks, setChecks] = useState<ChecksState>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChecksState;
        setChecks(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
    } catch {
      /* ignore */
    }
  }, [checks, hydrated]);

  const active = CHECKLISTS.find((c) => c.id === activeId) ?? CHECKLISTS[0];
  const activeChecks = checks[active.id] ?? {};
  const doneCount = active.items.reduce(
    (acc, _, i) => acc + (activeChecks[i] ? 1 : 0),
    0,
  );
  const total = active.items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  let verdict: { label: string; bg: string; text: string; border: string; bar: string };
  if (pct === 100) {
    verdict = {
      label: "ПОЛНОСТЬЮ СООТВЕТСТВУЕТ",
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-900 dark:text-emerald-200",
      border: "border-emerald-500",
      bar: "bg-emerald-500",
    };
  } else if (pct >= 80) {
    verdict = {
      label: "УСЛОВНО ПРИНЯТЬ",
      bg: "bg-green-100 dark:bg-green-900/40",
      text: "text-green-900 dark:text-green-200",
      border: "border-green-500",
      bar: "bg-green-500",
    };
  } else if (pct >= 50) {
    verdict = {
      label: "УСТРАНИТЬ ЗАМЕЧАНИЯ",
      bg: "bg-yellow-100 dark:bg-yellow-900/40",
      text: "text-yellow-900 dark:text-yellow-200",
      border: "border-yellow-500",
      bar: "bg-yellow-500",
    };
  } else {
    verdict = {
      label: "КРИТИЧЕСКИЕ НЕДОДЕЛКИ",
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-900 dark:text-red-200",
      border: "border-red-500",
      bar: "bg-red-500",
    };
  }

  function toggle(i: number) {
    setChecks((prev) => {
      const cur = { ...(prev[active.id] ?? {}) };
      cur[i] = !cur[i];
      return { ...prev, [active.id]: cur };
    });
  }

  function resetActive() {
    setChecks((prev) => {
      const next = { ...prev };
      delete next[active.id];
      return next;
    });
  }

  function checkAll() {
    setChecks((prev) => {
      const cur: Record<number, boolean> = {};
      active.items.forEach((_, i) => (cur[i] = true));
      return { ...prev, [active.id]: cur };
    });
  }

  function printAct() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-page {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            page-break-inside: avoid;
          }
          .print-item {
            color: black !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      {/* Header (no-print) */}
      <header className="bg-emerald-700 text-white no-print">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-emerald-100 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              📋 Чек-листы приёмки работ — 12 видов работ
            </h1>
            <p className="text-[10px] text-emerald-200">
              Прорабам и тех. надзору · основа для АОСР и КС-2 · печать как акт приёмки
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-5 print-page">
        {/* Описание (no-print) */}
        <section className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm no-print">
          <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
            ✓ ИНТЕРАКТИВНЫЕ ЧЕК-ЛИСТЫ
          </h2>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
            Для приёмки работ перед оформлением акта{" "}
            <b>АОСР (скрытые работы)</b> или <b>КС-2 (выполненные работы)</b>.
            <br />
            Каждый список — реальная процедура из практики тех. надзора РК.
            Отмечай выполненные пункты, в конце увидишь % соответствия.
          </p>
        </section>

        {/* Выбор чек-листа (no-print) */}
        <section className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 shadow-sm no-print">
          <h2 className="text-base font-bold text-emerald-800 dark:text-emerald-300 mb-3">
            Выбор вида работ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {CHECKLISTS.map((c) => {
              const cs = checks[c.id] ?? {};
              const done = c.items.reduce(
                (acc, _, i) => acc + (cs[i] ? 1 : 0),
                0,
              );
              const isFull = done === c.items.length;
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`text-left text-[11px] px-2 py-2 rounded border-2 font-semibold transition-colors ${
                    isActive
                      ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-400"
                      : isFull
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{c.icon}</span>
                    <span className="leading-tight">{c.title}</span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-70">
                    {done}/{c.items.length} {isFull ? "✓" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Чек-лист (печатается) */}
        <section className="bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-5 shadow-sm print-card">
          {/* Печатная шапка (только при печати) */}
          <div className="print-only mb-4 text-center">
            <div className="text-lg font-bold uppercase">
              Акт приёмки {active.shortTitle} работ
            </div>
            <div className="text-sm mt-1">
              «{active.title}»
            </div>
            <div className="text-xs mt-2">
              Дата: {today}
            </div>
          </div>

          {/* Заголовок (no-print) */}
          <div className="flex items-start justify-between mb-4 gap-3 no-print">
            <div>
              <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <span className="text-2xl">{active.icon}</span>
                Чек-лист: {active.title}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Норматив: {active.norm}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={checkAll}
                className="text-[10px] px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/60 font-semibold"
              >
                ☑ Отметить всё
              </button>
              <button
                onClick={resetActive}
                className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
              >
                ↺ Сбросить
              </button>
            </div>
          </div>

          {/* Печатная норматив-строка */}
          <div className="print-only text-[11px] mb-3 print-item">
            <b>Норматив:</b> {active.norm}
          </div>

          {/* Прогресс-бар (no-print) */}
          <div className="mb-4 no-print">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {doneCount} из {total} пунктов выполнено
              </span>
              <span className={`text-xs font-bold ${verdict.text}`}>
                {pct}%
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${verdict.bar} transition-all duration-300`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Вердикт (no-print) */}
          <div
            className={`mb-4 ${verdict.bg} ${verdict.text} border-l-4 ${verdict.border} rounded p-3 text-xs font-bold no-print`}
          >
            {verdict.label}
          </div>

          {/* Список пунктов */}
          <ul className="space-y-1">
            {active.items.map((item, i) => {
              const checked = !!activeChecks[i];
              return (
                <li key={i}>
                  <button
                    onClick={() => toggle(i)}
                    className="flex items-start gap-2.5 text-left w-full hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded px-2 py-1.5 no-print-hover"
                  >
                    <span
                      className={`flex-shrink-0 w-5 h-5 mt-0.5 border-2 rounded text-xs font-bold flex items-center justify-center ${
                        checked
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-emerald-400 dark:border-emerald-600"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span
                      className={`text-xs leading-relaxed flex-1 print-item ${
                        checked
                          ? "text-slate-500 dark:text-slate-500 line-through"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                        {(i + 1).toString().padStart(2, "0")}.
                      </span>
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Печатный итог */}
          <div className="print-only mt-5 pt-3 border-t border-slate-400">
            <div className="text-sm">
              <b>Выполнено:</b> {doneCount} из {total} пунктов ({pct}%)
            </div>
            <div className="text-sm mt-1">
              <b>Заключение:</b> {verdict.label}
            </div>
          </div>

          {/* Печатные подписи */}
          <div className="print-only mt-8 grid grid-cols-2 gap-8 text-xs">
            <div>
              <div className="border-b border-black pb-1 mb-1">&nbsp;</div>
              <div>Производитель работ (Ф.И.О., подпись)</div>
              <div className="mt-6 border-b border-black pb-1 mb-1">&nbsp;</div>
              <div>Технический надзор (Ф.И.О., подпись)</div>
            </div>
            <div>
              <div className="border-b border-black pb-1 mb-1">&nbsp;</div>
              <div>Представитель заказчика (Ф.И.О., подпись)</div>
              <div className="mt-6 border-b border-black pb-1 mb-1">&nbsp;</div>
              <div>Дата: {today}</div>
            </div>
          </div>

          {/* Кнопка печати (no-print) */}
          <div className="mt-5 flex gap-2 no-print">
            <button
              onClick={printAct}
              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
            >
              🖨 Сохранить как акт (печать / PDF)
            </button>
          </div>
        </section>

        {/* Фактоид (no-print) */}
        <section className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm no-print">
          <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
            💡 ВАЖНО
          </h2>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
            Эти чек-листы — основа <b>АОСР и КС-2</b>. Не подписывай акты приёмки,
            пока не ВСЕ пункты выполнены. Один невыполненный пункт — это
            потенциальный спор с заказчиком на стоимость переделки.
          </p>
        </section>
      </div>
    </div>
  );
}
