/**
 * Связь тренажёра с курсом smeta-rk-kurs (LMS) через ID модуля.
 *
 * Сценарий: LMS открывает тренажёр по ссылке
 *   /smeta-trainer/lms?module=2.3&return=<url-курса>&sid=<студент>&origin=<origin>
 * Тренажёр направляет студента в нужный режим, а по завершении значимой
 * активности (сдача экзамена) возвращает зачёт обратно — через postMessage
 * родительскому окну (если встроен в iframe) и/или редирект на return-URL.
 *
 * Ядро чистое (карта + парсинг + сборка URL/сообщения) — см. lms.test.ts.
 * Работа с sessionStorage вынесена в guarded-функции (no-op вне браузера).
 */

/** Назначение модуля курса в тренажёре. */
export interface ModuleDestination {
  /** Человекочитаемая тема модуля. */
  label: string;
  /** Путь под /smeta-trainer (без префикса). Напр. "/exam/finishing-classroom". */
  path: string;
  /** Что студент делает в этом режиме. */
  description: string;
  /** Если модуль завершается сдачей конкретного экзамена — его id. */
  examTaskId?: string;
}

/** Базовый префикс всех маршрутов тренажёра. */
export const TRAINER_BASE = "/smeta-trainer";

/** Порог зачёта модуля (LMS требует ≥70%). */
export const LMS_PASS_THRESHOLD = 70;

/** Тип postMessage-события о завершении (для слушателя на стороне LMS). */
export const LMS_COMPLETION_TYPE = "aevion-smeta-trainer:completion";

/**
 * Карта: ID модуля курса → режим тренажёра.
 * ID соответствуют 03-lms/01-модули.md (1.1–5.7). Покрыты модули, для которых
 * у тренажёра есть осмысленный исполнительный режим.
 */
export const MODULE_DESTINATIONS: Record<string, ModuleDestination> = {
  "1.2": { label: "Терминология и виды смет", path: "/glossary", description: "Глоссарий сметных терминов РК" },
  "1.3": { label: "Нормативная база РК", path: "/methodology", description: "Методика: нормативы, НР/СП, индексы" },
  "1.4": { label: "Базисно-индексный и ресурсный методы", path: "/calc", description: "Редактор ЛСР — сравнение методов расчёта" },
  "2.1": { label: "Структура локальной сметы", path: "/calc", description: "Редактор ЛСР: разделы, позиции, итоги" },
  "2.2": { label: "Поиск и применение расценок", path: "/rates", description: "Поиск по корпусу расценок РК" },
  "2.3": {
    label: "Объёмы работ и единицы измерения",
    path: "/exam/finishing-classroom",
    description: "Экзамен на вычет проёмов + AI-советник",
    examTaskId: "finishing-classroom",
  },
  "2.4": {
    label: "Накладные расходы и сметная прибыль",
    path: "/exam/demolition-section-overhead",
    description: "Экзамен на категорию раздела и НР/СП",
    examTaskId: "demolition-section-overhead",
  },
  "2.5": { label: "Индексы пересчёта", path: "/indexes", description: "Применение индексов, двойной учёт" },
  "2.6": { label: "Печатные формы", path: "/documents", description: "ЛСР, КС-2, КС-3, ССР → PDF" },
  "3.3": {
    label: "Коэффициенты условий производства работ",
    path: "/exam/painting-coef-double",
    description: "Экзамен на двойной коэффициент условий",
    examTaskId: "painting-coef-double",
  },
  "3.4": { label: "Лимитированные затраты", path: "/documents", description: "Лимитированные затраты в формах ССР/ЛСР" },
  "3.5": {
    label: "Дополнительные работы и корректировки",
    path: "/exam/gym-scaffolding-missing",
    description: "Экзамен на пропущенные леса/подмости",
    examTaskId: "gym-scaffolding-missing",
  },
  "4.2": { label: "Сводный сметный расчёт по 12 главам", path: "/documents", description: "ССР, объектные сметы → PDF" },
  "5.2": { label: "Методология сметной экспертизы", path: "/methodology", description: "Методика проверки и нормативы РК" },
  "5.3": { label: "Типовые завышения", path: "/exam-analytics", description: "Аналитика типовых ошибок банка" },
  capstone: { label: "Сквозной кейс — школа №47", path: "/capstone", description: "Полный кейс капремонта школы" },
};

/** Контекст запуска из LMS. */
export interface LmsContext {
  /** ID модуля курса (ключ MODULE_DESTINATIONS). */
  module: string;
  /** URL курса для возврата студента. */
  returnUrl?: string;
  /** Идентификатор студента в LMS (опционально). */
  studentId?: string;
  /** Origin родительского окна для безопасного postMessage. */
  origin?: string;
}

/** Результат, возвращаемый в LMS. */
export interface LmsCompletion {
  module: string;
  taskId?: string;
  score: number;
  grade: string;
  passed: boolean;
  /** ISO-время завершения (передаётся снаружи — в скрипте Date недоступен). */
  at: string;
}

/** Назначение модуля или null, если модуль не поддержан. */
export function destinationFor(module: string | null | undefined): ModuleDestination | null {
  if (!module) return null;
  return MODULE_DESTINATIONS[module] ?? null;
}

/** Полный путь назначения модуля (с префиксом тренажёра). */
export function destinationHref(dest: ModuleDestination): string {
  return `${TRAINER_BASE}${dest.path}`;
}

/** Разобрать query-параметры запуска из LMS. */
export function parseLmsParams(
  params: URLSearchParams | Record<string, string | null | undefined>
): LmsContext | null {
  const get = (k: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return v == null || v === "" ? undefined : v;
  };
  const module = get("module") ?? get("lesson");
  if (!module) return null;
  return {
    module,
    returnUrl: get("return") ?? get("returnUrl"),
    studentId: get("sid") ?? get("studentId"),
    origin: get("origin"),
  };
}

/** Найти модуль курса, который завершается данным экзаменом. */
export function moduleForExamTask(taskId: string): string | null {
  for (const [mod, dest] of Object.entries(MODULE_DESTINATIONS)) {
    if (dest.examTaskId === taskId) return mod;
  }
  return null;
}

/** Собрать URL возврата в курс с результатом в query. */
export function buildReturnUrl(ctx: LmsContext, c: LmsCompletion): string | null {
  if (!ctx.returnUrl) return null;
  let url: URL;
  try {
    url = new URL(ctx.returnUrl);
  } catch {
    return null; // невалидный URL — возврат недоступен
  }
  url.searchParams.set("module", c.module);
  url.searchParams.set("score", String(c.score));
  url.searchParams.set("grade", c.grade);
  url.searchParams.set("passed", c.passed ? "1" : "0");
  if (ctx.studentId) url.searchParams.set("sid", ctx.studentId);
  if (c.taskId) url.searchParams.set("task", c.taskId);
  return url.toString();
}

/** Сообщение для postMessage родительскому окну LMS. */
export function buildCompletionMessage(c: LmsCompletion): { type: string; payload: LmsCompletion } {
  return { type: LMS_COMPLETION_TYPE, payload: c };
}

/* ----------------------------- storage (guarded) ----------------------------- */

const CTX_KEY = "aevion-smeta-lms-ctx-v1";

export function saveLmsContext(ctx: LmsContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx));
  } catch {}
}

export function loadLmsContext(): LmsContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CTX_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LmsContext;
    return v && typeof v.module === "string" ? v : null;
  } catch {
    return null;
  }
}

export function clearLmsContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CTX_KEY);
  } catch {}
}

/** Отправить зачёт родительскому окну LMS (no-op вне iframe/браузера). */
export function postLmsCompletion(ctx: LmsContext, c: LmsCompletion): void {
  if (typeof window === "undefined" || window.parent === window) return;
  try {
    window.parent.postMessage(buildCompletionMessage(c), ctx.origin || "*");
  } catch {}
}
