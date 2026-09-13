/**
 * QSpace — сохранение и перенос проекта.
 *
 * Зачем. Ремонт планируют неделями: человек расставляет мебель, подбирает
 * плитку, уходит и возвращается завтра. Без сохранения обновление страницы
 * стирало всё — инструмент годился бы только на «посмотреть», а не на работу.
 *
 * Два разных механизма, и путать их нельзя:
 *  - АВТОСОХРАНЕНИЕ в localStorage — чтобы не потерять при закрытии вкладки.
 *    Живёт только в этом браузере, у этого человека; чистка данных сайта его
 *    стирает. Это удобство, а не хранилище.
 *  - ФАЙЛ проекта (.qspace.json) — чтобы сохранить надолго, перенести на
 *    другой компьютер или отдать подрядчику. Это единственный надёжный путь,
 *    и на странице так и написано.
 */

import type { Opening, Plan, Wall } from "./planModel";

/** Что стоит в сцене: предмет каталога и его положение. */
export interface PlacedSnapshot {
  catalogId: string;
  x: number;
  z: number;
  rotY: number;
}

export interface Project {
  /** версия формата: старый файл не должен молча толковаться по-новому */
  version: 1;
  savedAt: string;
  plan: Plan;
  placed: PlacedSnapshot[];
  wallMatId: string;
  floorMatId: string;
  partition: string;
  layers: { rough: boolean; finish: boolean; decor: boolean };
}

export const STORAGE_KEY = "aevion_qspace_project_v1";

/** Проверка формы данных: чужой или испорченный файл не должен ломать сцену. */
export function isProject(v: unknown): v is Project {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<Project>;
  if (p.version !== 1) return false;
  if (!p.plan || typeof p.plan !== "object") return false;
  const plan = p.plan as Partial<Plan>;
  if (!Array.isArray(plan.walls) || !Array.isArray(plan.openings)) return false;
  for (const w of plan.walls as Wall[]) {
    if (![w?.x1, w?.y1, w?.x2, w?.y2, w?.thickness, w?.height].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )) return false;
  }
  for (const o of plan.openings as Opening[]) {
    if (typeof o?.wall !== "number" || !Number.isFinite(o.wall)) return false;
    if (o.wall < 0 || o.wall >= (plan.walls as Wall[]).length) return false;
    if (![o.offset, o.width, o.height, o.sill].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )) return false;
    if (o.kind !== "door" && o.kind !== "window") return false;
  }
  if (!Array.isArray(p.placed)) return false;
  for (const it of p.placed as PlacedSnapshot[]) {
    if (typeof it?.catalogId !== "string") return false;
    if (![it.x, it.z, it.rotY].every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  }
  if (typeof p.wallMatId !== "string" || typeof p.floorMatId !== "string") return false;
  // Тип перегородки читается страницей напрямую (setPartition), поэтому его
  // отсутствие ломает состав конструкций уже ПОСЛЕ того, как файл принят.
  if (typeof p.partition !== "string") return false;
  if (!p.layers || typeof p.layers !== "object") return false;
  // ⚠️ Три поля слоёв проверяются поимённо, а не «это объект». Файл с
  // `layers: {}` проходил как исправный, а затем страница делала
  // `checked={layers.rough}` со значением undefined — флажок становится
  // неуправляемым, React ругается в консоль, а человек видит непонятное
  // поведение уже ПОСЛЕ сообщения «проект восстановлен». Отказать честно
  // дешевле, чем принять и сломаться позже.
  const l = p.layers as Partial<Project["layers"]>;
  if (!["rough", "finish", "decor"].every((k) => typeof l[k as keyof typeof l] === "boolean")) {
    return false;
  }
  return true;
}

/**
 * Сохранение в браузер.
 *
 * Возвращает причину отказа, а не бросает: хранилище недоступно в приватном
 * режиме и при запрете данных сайта, и это НЕ повод ронять работу человека.
 * Но и молчать нельзя — иначе он будет думать, что проект сохранён.
 */
export function saveLocal(p: Project): { ok: true } | { ok: false; reason: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return { ok: true };
  } catch (e) {
    const msg = String(e);
    if (/quota|exceed/i.test(msg)) {
      return { ok: false, reason: "В браузере кончилось место для сохранения — выгрузите проект файлом." };
    }
    return { ok: false, reason: "Браузер не даёт сохранять данные сайта (приватное окно?) — выгрузите проект файлом." };
  }
}

/**
 * Чтение из браузера.
 *
 * Три РАЗНЫХ исхода, и смешивать их нельзя: ничего не сохранено; сохранено и
 * прочитано; сохранено, но не читается. Последнее — не «пусто»: молча начать
 * с чистого листа значит потерять работу, не сказав об этом.
 */
export function loadLocal():
  | { kind: "none" }
  | { kind: "ok"; project: Project }
  | { kind: "broken"; reason: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { kind: "broken", reason: "Браузер не даёт читать сохранённые данные сайта." };
  }
  if (raw === null) return { kind: "none" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "broken", reason: "Сохранённый проект повреждён и не читается." };
  }
  if (!isProject(parsed)) {
    return { kind: "broken", reason: "Сохранённый проект в незнакомом формате — возможно, от другой версии." };
  }
  return { kind: "ok", project: parsed };
}

export function clearLocal(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* нечего чистить */ }
}

/** Разбор файла проекта. Причина отказа — словами, файл мог принести кто угодно. */
export function parseProjectFile(text: string): { ok: true; project: Project } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Это не файл проекта QSpace: содержимое не разбирается." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "Это не файл проекта QSpace." };
  }
  const v = (parsed as { version?: unknown }).version;
  if (v !== undefined && v !== 1) {
    return { ok: false, reason: `Файл сделан другой версией QSpace (формат ${String(v)}), открыть его нельзя.` };
  }
  if (!isProject(parsed)) {
    return { ok: false, reason: "Файл проекта повреждён: часть данных отсутствует или неверна." };
  }
  return { ok: true, project: parsed };
}

export function projectFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `qspace-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.qspace.json`;
}
