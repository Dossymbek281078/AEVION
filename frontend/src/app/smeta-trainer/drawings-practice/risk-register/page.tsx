"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type Category =
  | "weather"
  | "supply"
  | "labor"
  | "tech"
  | "legal"
  | "financial"
  | "design";

interface Risk {
  id: string;
  num: number;
  category: Category;
  name: string;
  description: string;
  probability: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  mitigation: string;
  reserve: string;
}

interface CategoryMeta {
  id: Category;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryMeta[] = [
  { id: "weather", label: "Погода", icon: "🌧" },
  { id: "supply", label: "Поставки", icon: "📦" },
  { id: "labor", label: "Кадры", icon: "👷" },
  { id: "tech", label: "Технические", icon: "🔧" },
  { id: "legal", label: "Юридические", icon: "⚖️" },
  { id: "financial", label: "Финансовые", icon: "💰" },
  { id: "design", label: "Проектные", icon: "📐" },
];

// ── Реестр рисков ────────────────────────────────────────────────────────────

const RISKS: Risk[] = [
  // ── Погода ─────────────────────────────────────────────
  {
    id: "w1",
    num: 1,
    category: "weather",
    name: "Дожди в строительный период",
    description:
      "Затопление котлована, остановка земляных и бетонных работ. Размывание открытых траншей, подмыв подушек.",
    probability: 3,
    impact: 2,
    mitigation: "Тенты над захватками, дренажные канавки, мониторинг прогноза 7 дней. Бетонирование — по защищённому графику.",
    reserve: "+5–10% к срокам",
  },
  {
    id: "w2",
    num: 2,
    category: "weather",
    name: "Заморозки в межсезонье",
    description:
      "Алматы октябрь–апрель, Астана сентябрь–май. Прекращение естественного твердения бетона, повреждение свежей кладки.",
    probability: 2,
    impact: 2,
    mitigation: "Зимние коэффициенты по СНиП РК 1.04-26-2011, противоморозные добавки (поташ, формиат), тепляки.",
    reserve: "+5% к стоимости бетона",
  },
  {
    id: "w3",
    num: 3,
    category: "weather",
    name: "Снежные бураны (Астана, северные регионы)",
    description:
      "Заносы стройплощадки, простой техники, невозможность доставки материалов. Видимость <50 м — все работы стоп.",
    probability: 2,
    impact: 3,
    mitigation: "Укрытие техники в боксах, перенос работ на закрытые участки, запасы материалов на 3–5 дней.",
    reserve: "+10% к срокам зимнего этапа",
  },
  {
    id: "w4",
    num: 4,
    category: "weather",
    name: "Сильный ветер (>15 м/с)",
    description:
      "По ПБ остановка крановых работ при ветре >15 м/с. Опасность срыва кровельных листов, лесов, ограждений.",
    probability: 2,
    impact: 2,
    mitigation: "Анемометр на кране, переход на наземные работы, дополнительное закрепление лесов.",
    reserve: "1% времени",
  },

  // ── Поставки ───────────────────────────────────────────
  {
    id: "s1",
    num: 5,
    category: "supply",
    name: "Задержка поставки бетона >2 часов",
    description:
      "Бетон схватывается в миксере (начало схватывания 1.5–2 ч). При срыве графика — слив, повторный заказ, холодный шов.",
    probability: 3,
    impact: 3,
    mitigation: "2 поставщика с действующими договорами, точный почасовой график, резервный миксер на площадке.",
    reserve: "0.5% объёма бетона",
  },
  {
    id: "s2",
    num: 6,
    category: "supply",
    name: "Срыв поставки арматуры",
    description:
      "Завод не отгружает в срок (загруженность, сырьё). Останавливаются арматурные работы → вся стройка стоп.",
    probability: 2,
    impact: 3,
    mitigation: "Страховой запас 7–10 дней по основным диаметрам (Ø12, Ø16, Ø20). Договор с 2 заводами.",
    reserve: "+5% арматуры на склад",
  },
  {
    id: "s3",
    num: 7,
    category: "supply",
    name: "Подмена материалов поставщиком (М300 вместо М400)",
    description:
      "Поставщик отгружает более низкую марку под видом заказанной. Грозит снижением несущей способности конструкций.",
    probability: 2,
    impact: 3,
    mitigation: "Входной контроль каждой партии, паспорта качества, выборочные испытания в независимой лаборатории.",
    reserve: "Стоимость повторных испытаний",
  },
  {
    id: "s4",
    num: 8,
    category: "supply",
    name: "Подорожание материалов в процессе строительства",
    description:
      "Инфляция, курсовые скачки. За 12 мес. цена арматуры может вырасти на 20–40%.",
    probability: 3,
    impact: 2,
    mitigation: "Фиксация цен в договоре на 6 мес., предоплата на ключевые позиции, форвардные контракты.",
    reserve: "5–10% бюджета материалов",
  },
  {
    id: "s5",
    num: 9,
    category: "supply",
    name: "Импорт-задержки (таможня, санкции)",
    description:
      "Импортные позиции (фасад, лифты, инженерия) застряли на границе. Риск +30–60 дней к сроку.",
    probability: 2,
    impact: 3,
    mitigation: "Импортозамещение там, где возможно. Заказ за 30 дней до планового монтажа. Альтернативные маршруты.",
    reserve: "+5% к общему сроку",
  },

  // ── Кадры ──────────────────────────────────────────────
  {
    id: "l1",
    num: 10,
    category: "labor",
    name: "Дефицит квалифицированных каменщиков/сварщиков",
    description:
      "В РК сезонный дефицит рабочих 4–5 разряда. Особенно остро в Алматы и Астане в пиковый сезон.",
    probability: 3,
    impact: 2,
    mitigation: "Предварительный найм за 2 мес. до этапа, доплаты за квалификацию, договоры с субподрядными бригадами.",
    reserve: "+10% к ФОТ",
  },
  {
    id: "l2",
    num: 11,
    category: "labor",
    name: "Травматизм на стройплощадке (3 категория опасности)",
    description:
      "По ТК РК — стройка относится к производству повышенной опасности. Падения с высоты, удары краном, поражение током.",
    probability: 2,
    impact: 3,
    mitigation: "ОТ-инструктажи, СИЗ (каски, страховочные пояса), ежедневные обходы, обучение по ОТ ТБ ПБ.",
    reserve: "Страхование 0.3% от ФОТ",
  },
  {
    id: "l3",
    num: 12,
    category: "labor",
    name: "Текучесть кадров (увольнения мигрантов)",
    description:
      "Мигранты из Узбекистана/Кыргызстана уезжают в сезон сбора урожая или из-за визовых проблем.",
    probability: 3,
    impact: 2,
    mitigation: "Договоры с агентствами по найму, помощь с легализацией, премирование за выполненный объект.",
    reserve: "1 неделя на замену бригады",
  },
  {
    id: "l4",
    num: 13,
    category: "labor",
    name: "Забастовка / простой по социальным причинам",
    description:
      "Невыплата зарплаты, плохие бытовые условия → остановка работ. Для прораба — репутационный риск.",
    probability: 1,
    impact: 3,
    mitigation: "Оплата строго в срок, нормальные бытовки, душевые, питание. Прозрачность по нарядам.",
    reserve: "1–2 дня на урегулирование",
  },

  // ── Технические ────────────────────────────────────────
  {
    id: "t1",
    num: 14,
    category: "tech",
    name: "Обнаружение коммуникаций при земляных работах",
    description:
      "Не указанные на топосъёмке кабели, газопровод, водопровод. Авария при зацеплении ковшом → штраф + ремонт.",
    probability: 2,
    impact: 3,
    mitigation: "Согласование с инжсетями ДО начала работ, шурфовка перед экскавацией, наряд-допуск.",
    reserve: "5–7 дней + стоимость ремонта",
  },
  {
    id: "t2",
    num: 15,
    category: "tech",
    name: "Просадка фундамента (грунт хуже чем по геологии)",
    description:
      "Геология сделана редкими скважинами; реальная картина может отличаться. Линзы слабых грунтов, плывуны.",
    probability: 1,
    impact: 3,
    mitigation: "Дополнительные шурфы перед бетонированием, привлечение геолога на этап разработки котлована.",
    reserve: "5% бюджета фундамента",
  },
  {
    id: "t3",
    num: 16,
    category: "tech",
    name: "Превышение проектной отметки грунтовых вод",
    description:
      "Фактический УГВ выше проектного на 0.5–1 м. Затопление котлована, мокрый грунт под фундамент.",
    probability: 2,
    impact: 2,
    mitigation: "Иглофильтры, открытое водопонижение, дополнительная обмазочная гидроизоляция.",
    reserve: "+5% бюджета подземной части",
  },
  {
    id: "t4",
    num: 17,
    category: "tech",
    name: "Брак строительной техники (поломка экскаватора)",
    description:
      "Поломка экскаватора/крана/бульдозера на сутки и более. Простой бригады, перенос графика.",
    probability: 2,
    impact: 2,
    mitigation: "Договор с 2 АТП, резервная машина в радиусе 30 км, ТО по графику.",
    reserve: "1–2 дня в графике",
  },

  // ── Юридические ────────────────────────────────────────
  {
    id: "j1",
    num: 18,
    category: "legal",
    name: "Отзыв разрешения на строительство",
    description:
      "Жалобы соседей, проверка ГАСК, выявление нарушений → приостановка работ до устранения.",
    probability: 1,
    impact: 3,
    mitigation: "Полная проектная документация, экспертиза, согласование по всем разделам ДО начала.",
    reserve: "Непредсказуем — до 30+ дней",
  },
  {
    id: "j2",
    num: 19,
    category: "legal",
    name: "Жалобы от жильцов соседних домов (шум, пыль)",
    description:
      "По нормам РК — работы 7:00–22:00, тихие часы 13:00–14:00. Нарушение → штрафы 50–500 МРП.",
    probability: 2,
    impact: 2,
    mitigation: "Согласование графика с акиматом, защитные сетки, мойка колёс, оповещение жильцов.",
    reserve: "1–3% на штрафы и компенсации",
  },
  {
    id: "j3",
    num: 20,
    category: "legal",
    name: "Изменение нормативов в процессе стройки",
    description:
      "Изменение СН РК или СНиП посреди стройки требует допроектирования и пересмотра решений.",
    probability: 1,
    impact: 3,
    mitigation: "Мониторинг изменений нормативной базы, переходные положения, диалог с экспертизой.",
    reserve: "5% на допроектирование",
  },

  // ── Финансовые ─────────────────────────────────────────
  {
    id: "f1",
    num: 21,
    category: "financial",
    name: "Задержка оплаты от заказчика",
    description:
      "Заказчик задерживает оплату КС-2 на 30–60 дней. Подрядчик финансирует стройку из своих средств.",
    probability: 2,
    impact: 3,
    mitigation: "Банковская гарантия, аккредитив, авансовый платёж 30%, поэтапная сдача.",
    reserve: "30 дней работы из собственных",
  },
  {
    id: "f2",
    num: 22,
    category: "financial",
    name: "Курсовая разница (импорт-материалы)",
    description:
      "Тенге к доллару может упасть на 10–20% за квартал. Импортные позиции дорожают пропорционально.",
    probability: 3,
    impact: 2,
    mitigation: "Фиксация цен в договоре в долларах/евро, форвардные контракты с банком.",
    reserve: "5–10% на курсовую разницу",
  },
  {
    id: "f3",
    num: 23,
    category: "financial",
    name: "Банкротство субподрядчика",
    description:
      "Субподрядчик исчезает с авансом или не может закончить свой объём. Поиск замены — 2–4 недели.",
    probability: 1,
    impact: 3,
    mitigation: "Проверка контрагента в реестре, аванс ≤30%, банковская гарантия возврата аванса.",
    reserve: "5% времени на замену",
  },

  // ── Проектные ──────────────────────────────────────────
  {
    id: "d1",
    num: 24,
    category: "design",
    name: "Изменения проекта в процессе (РД корректируется)",
    description:
      "Заказчик меняет планировку, отделку, инженерию по ходу стройки. Допсоглашения, переделки.",
    probability: 3,
    impact: 2,
    mitigation: "Оформление изменений через допсоглашения, фиксация цен на доп. работы по локальной смете.",
    reserve: "5–10% бюджета",
  },
  {
    id: "d2",
    num: 25,
    category: "design",
    name: "Ошибки в проекте (несовместимость разделов)",
    description:
      "АР и КР конфликтуют (балка проходит через дверь). ОВ и ВК пересекаются. Обнаруживается на стройке.",
    probability: 2,
    impact: 3,
    mitigation: "Внутренний аудит проекта до начала, BIM-координация (Navisworks), совещания ГИП+ГАП+смежники.",
    reserve: "3–5% бюджета на переделки",
  },
];

// ── Утилиты ──────────────────────────────────────────────────────────────────

function score(r: Risk): number {
  return r.probability * r.impact;
}

function riskLevel(s: number): "low" | "medium" | "high" {
  if (s <= 2) return "low";
  if (s <= 4) return "medium";
  return "high";
}

function levelLabel(s: number): string {
  if (s <= 2) return "НИЗКИЙ";
  if (s <= 4) return "СРЕДНИЙ";
  return "КРИТИЧЕСКИЙ";
}

function levelBorder(s: number): string {
  const lv = riskLevel(s);
  if (lv === "low") return "border-emerald-500/60";
  if (lv === "medium") return "border-amber-500/70";
  return "border-red-500/80";
}

function levelBadge(s: number): string {
  const lv = riskLevel(s);
  if (lv === "low") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (lv === "medium") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-red-500/20 text-red-300 border-red-500/50";
}

function levelCellBg(s: number): string {
  const lv = riskLevel(s);
  if (lv === "low") return "bg-emerald-600/30 text-emerald-100 border-emerald-500/50";
  if (lv === "medium") return "bg-amber-600/30 text-amber-100 border-amber-500/50";
  return "bg-red-600/40 text-red-100 border-red-500/60";
}

function probLabel(p: 1 | 2 | 3): string {
  return p === 1 ? "Низкая" : p === 2 ? "Средняя" : "Высокая";
}

function impactLabel(i: 1 | 2 | 3): string {
  return i === 1 ? "Незначит." : i === 2 ? "Среднее" : "Критич.";
}

function bars(level: 1 | 2 | 3, color: string): React.ReactElement {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`inline-block w-2 h-3 rounded-sm ${
            n <= level ? color : "bg-slate-700"
          }`}
        />
      ))}
    </span>
  );
}

function categoryMeta(id: Category): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

// ── Страница ─────────────────────────────────────────────────────────────────

export default function RiskRegisterPage() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [sort, setSort] = useState<"score-desc" | "score-asc" | "num">(
    "score-desc",
  );

  const filtered = useMemo(() => {
    const base =
      filter === "all" ? RISKS : RISKS.filter((r) => r.category === filter);
    const sorted = [...base];
    if (sort === "score-desc") sorted.sort((a, b) => score(b) - score(a));
    else if (sort === "score-asc") sorted.sort((a, b) => score(a) - score(b));
    else sorted.sort((a, b) => a.num - b.num);
    return sorted;
  }, [filter, sort]);

  const counts = useMemo(() => {
    const high = RISKS.filter((r) => score(r) >= 6).length;
    const med = RISKS.filter((r) => {
      const s = score(r);
      return s >= 3 && s <= 4;
    }).length;
    const low = RISKS.filter((r) => score(r) <= 2).length;
    return { high, med, low };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-orange-900/40 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-orange-300 hover:text-orange-200 text-sm flex items-center gap-1"
          >
            <span>←</span>
            <span>К разделам</span>
          </Link>
          <div className="text-xs text-slate-400 hidden sm:block">
            Реестр рисков — модуль ПОС/ППР
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-orange-200">
            🎲 Реестр рисков строительства — план реагирования
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Матрица вероятность × влияние, типовые риски РК, план митигации и
            расчёт резерва в смету.
          </p>
        </div>

        {/* Введение */}
        <div className="rounded-xl border-2 border-orange-500/60 bg-orange-950/30 p-5">
          <div className="text-orange-200 font-semibold mb-3">
            📌 О реестре рисков
          </div>
          <div className="text-sm text-slate-200 space-y-2 leading-relaxed">
            <p>
              <span className="text-orange-300 font-medium">Реестр рисков</span>{" "}
              — обязательная часть ПОС/ППР для крупных объектов. Каждый риск
              оценивается по матрице:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
              <li>
                <strong className="text-slate-100">Вероятность:</strong> Низкая
                / Средняя / Высокая = 1 / 2 / 3
              </li>
              <li>
                <strong className="text-slate-100">Влияние:</strong>{" "}
                Незначительное / Среднее / Критическое = 1 / 2 / 3
              </li>
              <li>
                <strong className="text-slate-100">Балл</strong> = Вероятность ×
                Влияние = от 1 до 9
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-orange-900/40">
              <div className="text-orange-300 font-medium mb-1">
                План реагирования по баллам:
              </div>
              <div className="grid sm:grid-cols-3 gap-2 mt-2">
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs">
                  <div className="font-semibold text-emerald-300">
                    1–2 НИЗКИЙ
                  </div>
                  <div className="text-slate-300 mt-1">Мониторинг</div>
                </div>
                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <div className="font-semibold text-amber-300">
                    3–4 СРЕДНИЙ
                  </div>
                  <div className="text-slate-300 mt-1">
                    Митигация — план снижения
                  </div>
                </div>
                <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
                  <div className="font-semibold text-red-300">
                    6–9 КРИТИЧЕСКИЙ
                  </div>
                  <div className="text-slate-300 mt-1">
                    Отказ от риска или резерв в смете
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Нормативный блок */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="text-slate-100 font-semibold mb-3">
            📘 Нормативная база
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="font-mono text-orange-300 whitespace-nowrap">
                СН РК 1.03-04-2015
              </span>
              <span className="text-slate-300">
                Управление рисками в строительстве
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="font-mono text-orange-300 whitespace-nowrap">
                ИСО 31000:2018
              </span>
              <span className="text-slate-300">
                Риск-менеджмент — общие принципы и руководящие указания
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="font-mono text-orange-300 whitespace-nowrap">
                МДС 81-25.2004 п. 4.96
              </span>
              <span className="text-slate-300">
                Резерв на непредвиденные работы и затраты —{" "}
                <strong className="text-orange-200">2–3% от СМР</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Матрица 3x3 */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="text-slate-100 font-semibold mb-4">
            🎯 Матрица рисков 3 × 3
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs text-slate-400 font-normal">
                    Вероятность ↓ / Влияние →
                  </th>
                  <th className="p-2 text-center text-xs text-slate-300 font-medium">
                    Низкое (1)
                  </th>
                  <th className="p-2 text-center text-xs text-slate-300 font-medium">
                    Среднее (2)
                  </th>
                  <th className="p-2 text-center text-xs text-slate-300 font-medium">
                    Критическое (3)
                  </th>
                </tr>
              </thead>
              <tbody>
                {([3, 2, 1] as const).map((p) => (
                  <tr key={p}>
                    <td className="p-2 text-xs text-slate-300 font-medium whitespace-nowrap">
                      {probLabel(p)} ({p})
                    </td>
                    {([1, 2, 3] as const).map((i) => {
                      const s = p * i;
                      return (
                        <td key={i} className="p-1">
                          <div
                            className={`rounded-lg border-2 px-3 py-4 text-center font-bold text-lg ${levelCellBg(
                              s,
                            )}`}
                          >
                            <div>{s}</div>
                            <div className="text-[10px] font-normal opacity-80 mt-1">
                              {levelLabel(s)}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Сводка по реестру */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-3 text-center">
            <div className="text-2xl font-bold text-red-300">{counts.high}</div>
            <div className="text-xs text-slate-400 mt-1">критических (6–9)</div>
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-center">
            <div className="text-2xl font-bold text-amber-300">
              {counts.med}
            </div>
            <div className="text-xs text-slate-400 mt-1">средних (3–4)</div>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-300">
              {counts.low}
            </div>
            <div className="text-xs text-slate-400 mt-1">низких (1–2)</div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <div>
            <div className="text-xs text-slate-400 mb-2">
              Фильтр по категории:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  filter === "all"
                    ? "bg-orange-500/20 border-orange-500/60 text-orange-200"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                Все ({RISKS.length})
              </button>
              {CATEGORIES.map((c) => {
                const cnt = RISKS.filter((r) => r.category === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                      filter === c.id
                        ? "bg-orange-500/20 border-orange-500/60 text-orange-200"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {c.icon} {c.label} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-2">Сортировка:</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSort("score-desc")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  sort === "score-desc"
                    ? "bg-orange-500/20 border-orange-500/60 text-orange-200"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                Балл ↓ (опасные первыми)
              </button>
              <button
                onClick={() => setSort("score-asc")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  sort === "score-asc"
                    ? "bg-orange-500/20 border-orange-500/60 text-orange-200"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                Балл ↑
              </button>
              <button
                onClick={() => setSort("num")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  sort === "num"
                    ? "bg-orange-500/20 border-orange-500/60 text-orange-200"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                По № в реестре
              </button>
            </div>
          </div>
        </div>

        {/* Список рисков */}
        <div className="space-y-3">
          {filtered.map((r) => {
            const s = score(r);
            const meta = categoryMeta(r.category);
            const lv = riskLevel(s);
            const probColor =
              r.probability === 3
                ? "bg-red-500"
                : r.probability === 2
                  ? "bg-amber-500"
                  : "bg-emerald-500";
            const impColor =
              r.impact === 3
                ? "bg-red-500"
                : r.impact === 2
                  ? "bg-amber-500"
                  : "bg-emerald-500";

            return (
              <div
                key={r.id}
                className={`rounded-xl border-2 ${levelBorder(
                  s,
                )} bg-slate-900/60 p-4`}
              >
                {/* Header строки */}
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-mono">
                      #{r.num}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300">
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded border font-bold ${levelBadge(
                      s,
                    )}`}
                  >
                    Балл {s} — {levelLabel(s)}
                  </span>
                </div>

                <div className="text-base font-semibold text-slate-100 mb-2">
                  {r.name}
                </div>
                <div className="text-sm text-slate-300 mb-3 leading-relaxed">
                  {r.description}
                </div>

                {/* Шкалы */}
                <div className="grid sm:grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24">Вероятность:</span>
                    {bars(r.probability, probColor)}
                    <span className="text-slate-300">
                      {probLabel(r.probability)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24">Влияние:</span>
                    {bars(r.impact, impColor)}
                    <span className="text-slate-300">
                      {impactLabel(r.impact)}
                    </span>
                  </div>
                </div>

                {/* Митигация и резерв */}
                <div className="grid md:grid-cols-2 gap-2">
                  <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                      🛡 Митигация
                    </div>
                    <div className="text-sm text-slate-200">
                      {r.mitigation}
                    </div>
                  </div>
                  <div
                    className={`rounded border p-3 ${
                      lv === "high"
                        ? "border-red-500/40 bg-red-950/20"
                        : lv === "medium"
                          ? "border-amber-500/40 bg-amber-950/20"
                          : "border-emerald-500/40 bg-emerald-950/20"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                      💰 Резерв в смете
                    </div>
                    <div className="text-sm text-slate-100 font-medium">
                      {r.reserve}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
              По выбранному фильтру рисков не найдено.
            </div>
          )}
        </div>

        {/* Суммарный резерв */}
        <div className="rounded-xl border-2 border-orange-500/60 bg-gradient-to-br from-orange-950/40 to-red-950/30 p-5">
          <div className="text-orange-200 font-semibold mb-3 text-lg">
            📊 Суммарный резерв для проекта
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-2 border-b border-orange-900/30">
              <span className="text-slate-300">
                Если применить ВСЕ митигации
              </span>
              <span className="text-orange-200 font-bold whitespace-nowrap">
                5–12% бюджета СМР
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-2 border-b border-orange-900/30">
              <span className="text-slate-300">
                Минимальный резерв (МДС 81-25 п. 4.96)
              </span>
              <span className="text-emerald-300 font-bold whitespace-nowrap">
                2–3%
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-2 border-b border-orange-900/30">
              <span className="text-slate-300">
                Рекомендуемый для типового объекта
              </span>
              <span className="text-amber-300 font-bold whitespace-nowrap">
                5–7%
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <span className="text-slate-300">
                Для сложных объектов (бассейн, реконструкция)
              </span>
              <span className="text-red-300 font-bold whitespace-nowrap">
                8–12%
              </span>
            </div>
          </div>
        </div>

        {/* Фактоид */}
        <div className="rounded-xl border-l-4 border-orange-500 bg-orange-950/20 p-4">
          <div className="text-orange-200 font-semibold mb-1 text-sm">
            💡 Важно: реестр — живой документ
          </div>
          <div className="text-sm text-slate-200 leading-relaxed">
            Реестр рисков должен <strong>вестись во время стройки</strong>, не
            только в начале. Каждый месяц — пересмотр статуса (произошёл /
            закрыт / новый риск). Это часть системы менеджмента качества по{" "}
            <span className="font-mono text-orange-300">ИСО 9001</span>.
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
