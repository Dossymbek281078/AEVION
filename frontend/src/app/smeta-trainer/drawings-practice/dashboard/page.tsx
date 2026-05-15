"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/* ───────────────────────── ТИПЫ И КОНСТАНТЫ ───────────────────────── */

type Category =
  | "theory"
  | "earth"
  | "structure"
  | "finishing"
  | "utilities"
  | "special"
  | "process"
  | "practice"
  | "tools";

interface ModuleDef {
  id: string;
  href: string;
  name: string;
  category: Category;
  exercises: number;
  /** ключ в DrawingsProgress, чей done > 0 означает «есть прогресс» */
  progressKey?: "basicDone" | "advancedDone" | "errorsDone";
  progressTotalKey?: "basicTotal" | "advancedTotal" | "errorsTotal";
}

interface CategoryDef {
  id: Category;
  icon: string;
  title: string;
}

interface DrawingsProgress {
  basicDone: number;   basicTotal: number;
  advancedDone: number; advancedTotal: number;
  errorsDone: number;   errorsTotal: number;
  lastUpdated: number;
}

interface DashboardData {
  /** XP — суммарный опыт студента */
  xp: number;
  /** Время в тренажёре (секунды) */
  timeSec: number;
  /** Какие модули студент явно отметил как пройденные */
  completedModules: string[];
  /** Какие инструменты использовал */
  toolsUsed: string[];
  lastUpdated: number;
}

interface QuizBest {
  scoreCorrect: number;
  scoreTotal: number;
  pct: number;
  /** слабые категории квиза (для рекомендаций) */
  weakCategories?: string[];
}

interface ChecklistsData {
  /** Сколько чек-листов с >80% соответствия */
  highScoreCount: number;
  /** Всего чек-листов с какими-то отметками */
  startedCount: number;
}

const KEY_DRAWINGS  = "aevion-smeta-drawings-v1";
const KEY_QUIZ_BEST = "aevion-smeta-quiz-best-v1";
const KEY_CHECKLISTS = "smeta-checklists-v1";
const KEY_DASHBOARD = "aevion-smeta-dashboard-v1";

const DEFAULT_DRAWINGS: DrawingsProgress = {
  basicDone: 0, basicTotal: 5,
  advancedDone: 0, advancedTotal: 6,
  errorsDone: 0, errorsTotal: 3,
  lastUpdated: 0,
};

const DEFAULT_DASHBOARD: DashboardData = {
  xp: 0,
  timeSec: 0,
  completedModules: [],
  toolsUsed: [],
  lastUpdated: 0,
};

const CATEGORIES: CategoryDef[] = [
  { id: "theory",    icon: "📚", title: "Теория и справочники" },
  { id: "earth",     icon: "⛏",  title: "Земляные работы" },
  { id: "structure", icon: "🏛", title: "Конструктив" },
  { id: "finishing", icon: "🖌", title: "Отделка и фасады" },
  { id: "utilities", icon: "🔌", title: "Инженерные сети" },
  { id: "special",   icon: "🛠", title: "Специальные работы" },
  { id: "process",   icon: "📋", title: "Производство работ" },
  { id: "practice",  icon: "🎯", title: "Практика и кейсы" },
  { id: "tools",     icon: "🧰", title: "Инструменты сметчика" },
];

const ALL_MODULES: ModuleDef[] = [
  // ── Теория и справочники (4) ──
  { id: "normatives",      href: "/smeta-trainer/drawings-practice/normatives",      name: "Нормативная база",                category: "theory",    exercises: 2 },
  { id: "rate-selector",   href: "/smeta-trainer/drawings-practice/rate-selector",   name: "Задачник: выбери расценку ЭСН",   category: "theory",    exercises: 10 },
  { id: "glossary",        href: "/smeta-trainer/drawings-practice/glossary",        name: "Глоссарий терминов",              category: "theory",    exercises: 0 },
  { id: "index-history",   href: "/smeta-trainer/drawings-practice/index-history",   name: "Динамика индексов 2001-2025",     category: "theory",    exercises: 3 },

  // ── Земляные работы (2) ──
  { id: "excavation",      href: "/smeta-trainer/drawings-practice/excavation",      name: "Котлован",                        category: "earth",     exercises: 4, progressKey: "basicDone", progressTotalKey: "basicTotal" },
  { id: "trenches",        href: "/smeta-trainer/drawings-practice/trenches",        name: "Траншеи под сети",                category: "earth",     exercises: 4 },

  // ── Конструктив (5) ──
  { id: "foundation",      href: "/smeta-trainer/drawings-practice/foundation",      name: "Фундаменты",                      category: "structure", exercises: 3 },
  { id: "walls",           href: "/smeta-trainer/drawings-practice/walls",           name: "Стены",                           category: "structure", exercises: 4 },
  { id: "slabs",           href: "/smeta-trainer/drawings-practice/slabs",           name: "Перекрытия",                      category: "structure", exercises: 3 },
  { id: "stairs",          href: "/smeta-trainer/drawings-practice/stairs",          name: "Лестницы",                        category: "structure", exercises: 3 },
  { id: "roof-flat",       href: "/smeta-trainer/drawings-practice/roof-flat",       name: "Кровля",                          category: "structure", exercises: 4 },

  // ── Отделка и фасады (3) ──
  { id: "windows-doors",   href: "/smeta-trainer/drawings-practice/windows-doors",   name: "Окна и двери",                    category: "finishing", exercises: 3 },
  { id: "finishing",       href: "/smeta-trainer/drawings-practice/finishing",       name: "Отделка",                         category: "finishing", exercises: 5 },
  { id: "facade-svtk",     href: "/smeta-trainer/drawings-practice/facade-svtk",     name: "Фасады — СФТК и НВФ",             category: "finishing", exercises: 4 },

  // ── Инженерные сети (7) ──
  { id: "sewage",          href: "/smeta-trainer/drawings-practice/sewage",          name: "Канализация — наружные сети",     category: "utilities", exercises: 3 },
  { id: "water",           href: "/smeta-trainer/drawings-practice/water",           name: "Водоснабжение",                   category: "utilities", exercises: 4 },
  { id: "heating",         href: "/smeta-trainer/drawings-practice/heating",         name: "Тепловые сети",                   category: "utilities", exercises: 4 },
  { id: "gas",             href: "/smeta-trainer/drawings-practice/gas",             name: "Газоснабжение",                   category: "utilities", exercises: 3 },
  { id: "cables",          href: "/smeta-trainer/drawings-practice/cables",          name: "Кабельные трассы",                category: "utilities", exercises: 4 },
  { id: "ventilation",     href: "/smeta-trainer/drawings-practice/ventilation",     name: "Вентиляция",                      category: "utilities", exercises: 4 },
  { id: "utilities",       href: "/smeta-trainer/drawings-practice/utilities",       name: "Инженерные системы (внутр.)",     category: "utilities", exercises: 3 },

  // ── Спец. работы (4) ──
  { id: "roads",           href: "/smeta-trainer/drawings-practice/roads",           name: "Дороги и благоустройство",        category: "special",   exercises: 4 },
  { id: "landscape",       href: "/smeta-trainer/drawings-practice/landscape",       name: "Озеленение и МАФ",                category: "special",   exercises: 4 },
  { id: "demolition",      href: "/smeta-trainer/drawings-practice/demolition",      name: "Демонтаж",                        category: "special",   exercises: 3 },
  { id: "reconstruction",  href: "/smeta-trainer/drawings-practice/reconstruction",  name: "Реконструкция",                   category: "special",   exercises: 4 },

  // ── Производство работ (4) ──
  { id: "inspections",     href: "/smeta-trainer/drawings-practice/inspections",     name: "Приёмка работ",                   category: "process",   exercises: 0 },
  { id: "safety",          href: "/smeta-trainer/drawings-practice/safety",          name: "Охрана труда",                    category: "process",   exercises: 3 },
  { id: "winter",          href: "/smeta-trainer/drawings-practice/winter",          name: "Зимние работы",                   category: "process",   exercises: 3 },
  { id: "best-practices",  href: "/smeta-trainer/drawings-practice/best-practices",  name: "Лучшие практики и ошибки",        category: "process",   exercises: 0 },

  // ── Практика и кейсы (4) ──
  { id: "self-study",      href: "/smeta-trainer/drawings-practice/self-study",      name: "Самостоятельная работа",          category: "practice",  exercises: 3 },
  { id: "advanced",        href: "/smeta-trainer/drawings-practice/advanced",        name: "Сложные объёмы",                  category: "practice",  exercises: 3, progressKey: "advancedDone", progressTotalKey: "advancedTotal" },
  { id: "errors",          href: "/smeta-trainer/drawings-practice/errors",          name: "Найди ошибку в ВОР",              category: "practice",  exercises: 3, progressKey: "errorsDone", progressTotalKey: "errorsTotal" },
  { id: "case-school47",   href: "/smeta-trainer/drawings-practice/case-school47",   name: "КЕЙС: Школа №47",                 category: "practice",  exercises: 8 },

  // ── Инструменты (12) ──
  { id: "cost-engine",     href: "/smeta-trainer/drawings-practice/cost-engine",     name: "Калькулятор стоимости",           category: "tools",     exercises: 0 },
  { id: "forms-acts",      href: "/smeta-trainer/drawings-practice/forms-acts",      name: "Формы КС-2, КС-3, Ф-3",           category: "tools",     exercises: 0 },
  { id: "pos-ppr",         href: "/smeta-trainer/drawings-practice/pos-ppr",         name: "ПОС и ППР",                       category: "tools",     exercises: 0 },
  { id: "quiz",            href: "/smeta-trainer/drawings-practice/quiz",            name: "Адаптивный квиз",                 category: "tools",     exercises: 40 },
  { id: "materials",       href: "/smeta-trainer/drawings-practice/materials",       name: "Цены на материалы",               category: "tools",     exercises: 0 },
  { id: "labor-norms",     href: "/smeta-trainer/drawings-practice/labor-norms",     name: "Нормы труда",                     category: "tools",     exercises: 4 },
  { id: "equipment",       href: "/smeta-trainer/drawings-practice/equipment",       name: "Эксплуатация машин",              category: "tools",     exercises: 4 },
  { id: "transport",       href: "/smeta-trainer/drawings-practice/transport",       name: "Транспортные расходы",            category: "tools",     exercises: 4 },
  { id: "individual-rates",href: "/smeta-trainer/drawings-practice/individual-rates",name: "Индивидуальные расценки",         category: "tools",     exercises: 3 },
  { id: "case-house",      href: "/smeta-trainer/drawings-practice/case-house",      name: "КЕЙС: 9-этажный жилой дом",       category: "tools",     exercises: 8 },
  { id: "case-pool",       href: "/smeta-trainer/drawings-practice/case-pool",       name: "КЕЙС: Крытый бассейн",            category: "tools",     exercises: 8 },
  { id: "checklists",      href: "/smeta-trainer/drawings-practice/checklists",      name: "Чек-листы приёмки",               category: "tools",     exercises: 0 },
];

/* ───────────────────────── localStorage ХЕЛПЕРЫ ───────────────────────── */

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...(fallback as any), ...JSON.parse(raw) } as T;
  } catch { return fallback; }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function loadChecklistsRaw(): ChecklistsData {
  if (typeof window === "undefined") return { highScoreCount: 0, startedCount: 0 };
  try {
    const raw = localStorage.getItem(KEY_CHECKLISTS);
    if (!raw) return { highScoreCount: 0, startedCount: 0 };
    const parsed = JSON.parse(raw);
    // ожидаемый формат: { [checklistId]: { items: { [itemId]: bool }, totalItems?: number } }
    let high = 0;
    let started = 0;
    if (parsed && typeof parsed === "object") {
      for (const id of Object.keys(parsed)) {
        const cl = parsed[id];
        if (!cl) continue;
        const items = cl.items || cl.checks || cl;
        if (typeof items !== "object") continue;
        const vals = Object.values(items).filter(v => typeof v === "boolean") as boolean[];
        if (vals.length === 0) continue;
        started += 1;
        const okPct = vals.filter(Boolean).length / vals.length;
        if (okPct >= 0.8) high += 1;
      }
    }
    return { highScoreCount: high, startedCount: started };
  } catch {
    return { highScoreCount: 0, startedCount: 0 };
  }
}

function loadQuizBest(): QuizBest {
  if (typeof window === "undefined") return { scoreCorrect: 0, scoreTotal: 20, pct: 0 };
  try {
    const raw = localStorage.getItem(KEY_QUIZ_BEST);
    if (!raw) return { scoreCorrect: 0, scoreTotal: 20, pct: 0 };
    const p = JSON.parse(raw);
    const correct = Number(p.scoreCorrect ?? p.correct ?? p.best ?? 0) || 0;
    const total = Number(p.scoreTotal ?? p.total ?? 20) || 20;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { scoreCorrect: correct, scoreTotal: total, pct, weakCategories: p.weakCategories };
  } catch {
    return { scoreCorrect: 0, scoreTotal: 20, pct: 0 };
  }
}

/* ───────────────────────── ОСНОВНОЙ КОМПОНЕНТ ───────────────────────── */

export default function DrawingsDashboard() {
  const [drawings, setDrawings] = useState<DrawingsProgress>(DEFAULT_DRAWINGS);
  const [dashboard, setDashboard] = useState<DashboardData>(DEFAULT_DASHBOARD);
  const [quizBest, setQuizBest] = useState<QuizBest>({ scoreCorrect: 0, scoreTotal: 20, pct: 0 });
  const [checklists, setChecklists] = useState<ChecklistsData>({ highScoreCount: 0, startedCount: 0 });
  const [openCats, setOpenCats] = useState<Record<Category, boolean>>({
    theory: true, earth: true, structure: false, finishing: false,
    utilities: false, special: false, process: false, practice: true, tools: false,
  });
  const [toast, setToast] = useState<string>("");
  const importRef = useRef<HTMLInputElement>(null);

  /* — загрузка из localStorage — */
  useEffect(() => {
    const refresh = () => {
      setDrawings(loadJson<DrawingsProgress>(KEY_DRAWINGS, DEFAULT_DRAWINGS));
      setDashboard(loadJson<DashboardData>(KEY_DASHBOARD, DEFAULT_DASHBOARD));
      setQuizBest(loadQuizBest());
      setChecklists(loadChecklistsRaw());
    };
    refresh();
    const onUpd = () => refresh();
    window.addEventListener("aevion-smeta-progress-update", onUpd);
    window.addEventListener("storage", onUpd);
    return () => {
      window.removeEventListener("aevion-smeta-progress-update", onUpd);
      window.removeEventListener("storage", onUpd);
    };
  }, []);

  /* — статус каждого модуля — */
  const moduleStatus = useMemo(() => {
    const map: Record<string, { status: "done" | "partial" | "todo"; current?: number; total?: number }> = {};
    for (const m of ALL_MODULES) {
      // явно отмечен пройденным
      if (dashboard.completedModules.includes(m.id)) {
        map[m.id] = { status: "done" };
        continue;
      }
      // прогресс из drawings (basic/advanced/errors)
      if (m.progressKey && m.progressTotalKey) {
        const cur = drawings[m.progressKey] ?? 0;
        const tot = drawings[m.progressTotalKey] ?? m.exercises;
        if (cur > 0 && cur >= tot) map[m.id] = { status: "done", current: cur, total: tot };
        else if (cur > 0) map[m.id] = { status: "partial", current: cur, total: tot };
        else map[m.id] = { status: "todo", current: 0, total: tot };
        continue;
      }
      // спец. модули — чек-листы / квиз
      if (m.id === "checklists" && checklists.startedCount > 0) {
        map[m.id] = checklists.highScoreCount >= 10
          ? { status: "done" }
          : { status: "partial", current: checklists.startedCount, total: 12 };
        continue;
      }
      if (m.id === "quiz" && quizBest.scoreCorrect > 0) {
        map[m.id] = quizBest.pct >= 70
          ? { status: "done" }
          : { status: "partial", current: quizBest.scoreCorrect, total: quizBest.scoreTotal };
        continue;
      }
      map[m.id] = { status: "todo" };
    }
    return map;
  }, [drawings, dashboard, quizBest, checklists]);

  /* — KPI — */
  const totalModules = ALL_MODULES.length;
  const doneModules = useMemo(
    () => Object.values(moduleStatus).filter(s => s.status === "done").length,
    [moduleStatus]
  );
  const donePct = totalModules ? Math.round((doneModules / totalModules) * 100) : 0;

  /* — XP: автоматически считаем от прогресса — */
  const computedXp = useMemo(() => {
    let xp = dashboard.xp; // сохранённое
    // +50 XP за каждый явно пройденный модуль
    xp += dashboard.completedModules.length * 50;
    // +20 XP за каждое выполненное упражнение (basic/advanced/errors)
    xp += (drawings.basicDone + drawings.advancedDone + drawings.errorsDone) * 20;
    // +квиз: 10 XP за каждый правильный
    xp += quizBest.scoreCorrect * 10;
    // +чек-листы: 30 XP за каждый «качественный»
    xp += checklists.highScoreCount * 30;
    return xp;
  }, [dashboard, drawings, quizBest, checklists]);

  const timeStr = formatTime(dashboard.timeSec);

  /* — прогресс по категориям — */
  const catProgress = useMemo(() => {
    return CATEGORIES.map(c => {
      const mods = ALL_MODULES.filter(m => m.category === c.id);
      const done = mods.filter(m => moduleStatus[m.id]?.status === "done").length;
      return { ...c, done, total: mods.length };
    });
  }, [moduleStatus]);

  /* — БЕЙДЖИ — */
  const badges = useMemo(() => {
    const allCats = new Set(CATEGORIES.map(c => c.id));
    const catsWithProgress = new Set<Category>();
    for (const m of ALL_MODULES) {
      const s = moduleStatus[m.id];
      if (s && s.status !== "todo") catsWithProgress.add(m.category);
    }
    const fourCoreCats: Category[] = ["theory", "earth", "structure", "finishing"];
    const allFourCoreCovered = fourCoreCats.every(c =>
      ALL_MODULES.some(m => m.category === c && moduleStatus[m.id]?.status === "done")
    );
    const capstoneIds = ["case-school47", "case-house", "case-pool"];
    const allCapstones = capstoneIds.every(id => moduleStatus[id]?.status === "done");
    const TOOL_IDS = ["cost-engine", "forms-acts", "materials", "labor-norms", "equipment", "transport"];
    const allToolsUsed = TOOL_IDS.every(id => dashboard.toolsUsed.includes(id));

    return [
      { icon: "🥉", name: "Бронзовый сметчик",   desc: "Пройди 5 модулей",                                earned: doneModules >= 5  },
      { icon: "🥈", name: "Серебряный сметчик",   desc: "Пройди 15 модулей",                               earned: doneModules >= 15 },
      { icon: "🥇", name: "Золотой сметчик",      desc: "Пройди 30 модулей",                               earned: doneModules >= 30 },
      { icon: "💎", name: "Алмазный сметчик",     desc: "Пройди все 45 модулей",                           earned: doneModules >= 45 },
      { icon: "🎓", name: "Капстоун-мастер",      desc: "Пройди все 3 кейса (школа, дом, бассейн)",        earned: allCapstones      },
      { icon: "🎯", name: "Снайпер квизов",       desc: "Набери 95%+ в любом квизе",                       earned: quizBest.pct >= 95 },
      { icon: "⚡", name: "Первопроходец",         desc: "Зайди хотя бы в 1 модуль из всех 9 категорий",    earned: catsWithProgress.size >= allCats.size },
      { icon: "📋", name: "Эксперт чек-листов",   desc: "Закрой 10/12 чек-листов с >80% соответствия",     earned: checklists.highScoreCount >= 10 },
      { icon: "🧰", name: "Мастер инструментов",  desc: "Использовал все 6 инструментов сметчика",         earned: allToolsUsed      },
      { icon: "🏗", name: "Сметчик-универсал",    desc: "Закрыто во всех 4 базовых: теория+земля+конструктив+отделка", earned: allFourCoreCovered },
    ];
  }, [moduleStatus, doneModules, quizBest, checklists, dashboard]);

  const earnedBadges = badges.filter(b => b.earned).length;

  /* — РЕКОМЕНДАЦИИ — */
  const recommendations = useMemo(() => {
    const recs: { icon: string; title: string; desc: string; href: string; color: string }[] = [];

    if (doneModules === 0) {
      recs.push({
        icon: "🚀", title: "Начни с нормативной базы",
        desc: "СНиП РК, ЭСН РК, основы — фундамент для всего курса.",
        href: "/smeta-trainer/drawings-practice/normatives", color: "indigo",
      });
      recs.push({
        icon: "📖", title: "Открой глоссарий",
        desc: "80+ терминов сметного дела РК — нужная база перед практикой.",
        href: "/smeta-trainer/drawings-practice/glossary", color: "violet",
      });
    }

    // неактивные категории
    const inactiveCats = catProgress.filter(c => c.done === 0);
    if (inactiveCats.length > 0 && doneModules > 0) {
      const target = inactiveCats[0];
      const firstMod = ALL_MODULES.find(m => m.category === target.id);
      if (firstMod) {
        recs.push({
          icon: target.icon, title: `Освой категорию: ${target.title}`,
          desc: `Ещё не закрыто ни одного модуля. Начни с «${firstMod.name}».`,
          href: firstMod.href, color: "purple",
        });
      }
    }

    // слабый квиз
    if (quizBest.scoreTotal > 0 && quizBest.pct < 70) {
      recs.push({
        icon: "🎯", title: "Подтяни квиз",
        desc: `Лучший результат — ${quizBest.pct}%. Повтори теорию и пройди квиз ещё раз.`,
        href: "/smeta-trainer/drawings-practice/quiz", color: "indigo",
      });
    }

    // капстоуны
    const baseCats: Category[] = ["theory", "earth", "structure", "finishing", "utilities"];
    const baseCovered = baseCats.every(c =>
      ALL_MODULES.some(m => m.category === c && moduleStatus[m.id]?.status === "done")
    );
    const capstones = ["case-school47", "case-house", "case-pool"];
    const allCaps = capstones.every(id => moduleStatus[id]?.status === "done");

    if (baseCovered && !allCaps) {
      const nextCap = capstones.find(id => moduleStatus[id]?.status !== "done");
      const capMod = ALL_MODULES.find(m => m.id === nextCap);
      if (capMod) {
        recs.push({
          icon: "🎓", title: "Пора браться за капстоун",
          desc: `Базовые модули закрыты — переходи к «${capMod.name}».`,
          href: capMod.href, color: "violet",
        });
      }
    }

    if (allCaps) {
      recs.push({
        icon: "🔍", title: "Найди ошибку в ВОР",
        desc: "Все капстоуны пройдены — испытай себя в L5-сценариях с ловушками.",
        href: "/smeta-trainer/drawings-practice/errors", color: "indigo",
      });
      recs.push({
        icon: "🎯", title: "Добей квиз до 95%",
        desc: "Получи бейдж «Снайпер квизов» — финальная проверка знаний.",
        href: "/smeta-trainer/drawings-practice/quiz", color: "purple",
      });
    }

    return recs.slice(0, 4);
  }, [doneModules, catProgress, quizBest, moduleStatus]);

  /* — ДЕЙСТВИЯ — */
  function handleReset() {
    if (typeof window === "undefined") return;
    if (!confirm("Точно сбросить весь прогресс? Это действие необратимо.")) return;
    try {
      localStorage.removeItem(KEY_DRAWINGS);
      localStorage.removeItem(KEY_QUIZ_BEST);
      localStorage.removeItem(KEY_CHECKLISTS);
      localStorage.removeItem(KEY_DASHBOARD);
    } catch {}
    setDrawings(DEFAULT_DRAWINGS);
    setDashboard(DEFAULT_DASHBOARD);
    setQuizBest({ scoreCorrect: 0, scoreTotal: 20, pct: 0 });
    setChecklists({ highScoreCount: 0, startedCount: 0 });
    showToast("Прогресс сброшен");
  }

  function handleExport() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        [KEY_DRAWINGS]:   loadJson(KEY_DRAWINGS, DEFAULT_DRAWINGS),
        [KEY_QUIZ_BEST]:  loadQuizBest(),
        [KEY_CHECKLISTS]: typeof window !== "undefined" ? localStorage.getItem(KEY_CHECKLISTS) : null,
        [KEY_DASHBOARD]:  loadJson(KEY_DASHBOARD, DEFAULT_DASHBOARD),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aevion-smeta-progress-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Прогресс экспортирован");
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const data = json?.data ?? json;
        if (data?.[KEY_DRAWINGS])   localStorage.setItem(KEY_DRAWINGS,  JSON.stringify(data[KEY_DRAWINGS]));
        if (data?.[KEY_QUIZ_BEST])  localStorage.setItem(KEY_QUIZ_BEST, JSON.stringify(data[KEY_QUIZ_BEST]));
        if (data?.[KEY_CHECKLISTS]) {
          const v = data[KEY_CHECKLISTS];
          localStorage.setItem(KEY_CHECKLISTS, typeof v === "string" ? v : JSON.stringify(v));
        }
        if (data?.[KEY_DASHBOARD])  localStorage.setItem(KEY_DASHBOARD, JSON.stringify(data[KEY_DASHBOARD]));
        setDrawings(loadJson<DrawingsProgress>(KEY_DRAWINGS, DEFAULT_DRAWINGS));
        setDashboard(loadJson<DashboardData>(KEY_DASHBOARD, DEFAULT_DASHBOARD));
        setQuizBest(loadQuizBest());
        setChecklists(loadChecklistsRaw());
        showToast("Прогресс импортирован");
      } catch {
        showToast("Ошибка: не удалось прочитать файл");
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = "";
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function toggleCat(id: Category) {
    setOpenCats(p => ({ ...p, [id]: !p[id] }));
  }

  /* ─────────────────────────────  RENDER  ───────────────────────────── */

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📊 Дашборд прогресса — твои достижения по 45 модулям
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Пройдено {doneModules} из {totalModules} модулей · {earnedBadges} из {badges.length} бейджей
            </p>
          </div>
        </div>
      </header>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-16 right-6 z-30 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-xl">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* KPI-КАРТОЧКИ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            title="Пройдено модулей"
            value={`${doneModules} / ${totalModules}`}
            sub={`${donePct}%`}
            barPct={donePct}
          />
          <KpiCard
            title="Заработано XP (опыт)"
            value={`${computedXp.toLocaleString("ru-RU")} XP`}
            sub={computedXp >= 1000 ? "💎 высокий уровень" : computedXp >= 300 ? "🔥 в потоке" : "🌱 старт"}
          />
          <KpiCard
            title="Лучший результат квиза"
            value={quizBest.scoreTotal > 0 ? `${quizBest.scoreCorrect}/${quizBest.scoreTotal}` : "—"}
            sub={quizBest.scoreTotal > 0 ? `${quizBest.pct}%` : "не пройден"}
            barPct={quizBest.pct}
          />
          <KpiCard
            title="Время в тренажёре"
            value={timeStr}
            sub={dashboard.timeSec >= 3600 ? "👏 серьёзная работа" : "⏱ только начало"}
          />
        </section>

        {/* ПРОГРЕСС ПО КАТЕГОРИЯМ */}
        <section className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
          <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-3 uppercase tracking-wide">
            Прогресс по категориям
          </h2>
          <div className="space-y-2">
            {catProgress.map(c => {
              const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="text-xs text-slate-700 dark:text-slate-300 w-52 shrink-0 flex items-center gap-2">
                    <span className="text-base">{c.icon}</span>
                    <span className="font-semibold">{c.title}</span>
                  </div>
                  <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 w-16 text-right">
                    {c.done}/{c.total}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* СПИСОК МОДУЛЕЙ */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 uppercase tracking-wide">
            Все модули — статус
          </h2>
          <div className="space-y-2">
            {CATEGORIES.map(c => {
              const mods = ALL_MODULES.filter(m => m.category === c.id);
              const done = mods.filter(m => moduleStatus[m.id]?.status === "done").length;
              const isOpen = openCats[c.id];
              return (
                <div key={c.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCat(c.id)}
                    className="w-full px-3 py-2 flex items-center gap-3 bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex-1 text-left">
                      {c.title}
                    </span>
                    <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                      {done}/{mods.length}
                    </span>
                    <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {mods.map(m => {
                        const st = moduleStatus[m.id];
                        return (
                          <Link
                            key={m.id}
                            href={m.href}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <StatusBadge status={st?.status ?? "todo"} />
                            <span className="text-xs text-slate-700 dark:text-slate-200 flex-1">{m.name}</span>
                            {st?.status === "partial" && st.current !== undefined && (
                              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                                {st.current}/{st.total ?? m.exercises}
                              </span>
                            )}
                            {st?.status === "todo" && m.exercises > 0 && (
                              <span className="text-[10px] font-mono text-slate-400">
                                0/{m.exercises}
                              </span>
                            )}
                            <span className="text-slate-300">→</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* БЕЙДЖИ */}
        <section className="bg-white dark:bg-slate-900 border-2 border-violet-200 dark:border-violet-800 rounded-xl p-5">
          <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-3 uppercase tracking-wide">
            Достижения · {earnedBadges}/{badges.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {badges.map(b => (
              <div
                key={b.name}
                className={`rounded-lg border p-3 flex items-start gap-3 transition-all ${
                  b.earned
                    ? "bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/30 dark:to-indigo-900/30 border-violet-300 dark:border-violet-600"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60"
                }`}
              >
                <span className={`text-3xl ${b.earned ? "" : "grayscale"}`}>{b.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold ${
                    b.earned
                      ? "text-violet-900 dark:text-violet-200"
                      : "text-slate-500 dark:text-slate-400"
                  }`}>
                    {b.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {b.desc}
                  </div>
                  <div className={`text-[10px] mt-1 font-semibold ${
                    b.earned ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                  }`}>
                    {b.earned ? "✓ Получен" : "○ Не получен"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* РЕКОМЕНДАЦИИ */}
        {recommendations.length > 0 && (
          <section className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-3 uppercase tracking-wide">
              Что пройти дальше — топ-{recommendations.length} рекомендаций
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((r, i) => (
                <Link
                  key={i}
                  href={r.href}
                  className="block bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-lg p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        {r.title}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        {r.desc}
                      </p>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1.5 font-semibold">
                        Перейти →
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* КНОПКИ */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 uppercase tracking-wide">
            Управление прогрессом
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReset}
              className="text-xs px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
            >
              🗑 Начать с нуля
            </button>
            <button
              onClick={handleExport}
              className="text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              ⬇ Экспортировать прогресс
            </button>
            <label className="text-xs px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition-colors cursor-pointer">
              ⬆ Импортировать прогресс
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>
        </section>

        {/* ФАКТОИД */}
        <section className="bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-500 rounded-r-lg p-4">
          <div className="text-xs text-violet-900 dark:text-violet-200 leading-relaxed">
            💡 <span className="font-semibold">Прогресс хранится локально в браузере.</span>{" "}
            Чтобы перенести на другое устройство — экспортируй JSON и импортируй на новом устройстве.
            Очистка cookies очистит и прогресс!
          </div>
        </section>

      </div>
    </div>
  );
}

/* ───────────────────────── ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ───────────────────────── */

function KpiCard({
  title, value, sub, barPct,
}: { title: string; value: string; sub?: string; barPct?: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-indigo-700 dark:text-indigo-300 font-bold">
        {title}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
      )}
      {typeof barPct === "number" && (
        <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "done" | "partial" | "todo" }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-sm font-bold">
        ✓
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm">
        🔄
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 text-sm">
      ○
    </span>
  );
}

function formatTime(sec: number): string {
  if (!sec || sec <= 0) return "0м";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}ч ${m}мин`;
  return `${m}мин`;
}
