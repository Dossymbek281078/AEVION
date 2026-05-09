/**
 * Клиент для backend-API прогресса студента (/api/smeta-trainer/*).
 * Работает через AEVION backend (по умолчанию http://localhost:4001),
 * с graceful fallback: если бэкенд недоступен, локальные данные
 * (useProgress.ts → localStorage) остаются единственным источником.
 */

import type { CourseProgress, LevelProgress } from "./useProgress";

const API_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AEVION_API) ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4001`
    : "http://localhost:4001");

const DEVICE_ID_KEY = "aevion-smeta-device-id-v1";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = "smeta-" + Math.random().toString(36).slice(2, 12) + "-" + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export type ServerLevelProgress = {
  level: number;
  status: "open" | "in-progress" | "done";
  score?: number;
  completedAt?: number;
  attemptsCnt?: number;
  lastVisitAt?: number;
};

export type ServerLessonProgress = {
  lessonId: string;
  completed: boolean;
  quizScore?: number;
  ts: number;
};

export type ServerPracticeAttempt = {
  exerciseId: string;
  correct: boolean;
  attempts: number;
  ts: number;
};

export type ServerStudent = {
  deviceId: string;
  userId: string | null;
  displayName: string | null;
  group: string | null;
  startedAt: number;
  updatedAt: number;
  levels: Record<string, ServerLevelProgress>;
  lessons?: Record<string, ServerLessonProgress>;
  practice?: Record<string, ServerPracticeAttempt>;
  capstonePassedAt?: number | null;
  achievements?: string[];
};

export type AttemptRecord = {
  id: string;
  deviceId: string;
  level: number;
  kind: "quiz" | "exercise" | "lsr-submit";
  score: number | null;
  payload: unknown;
  feedback: string | null;
  ts: number;
};

export type LeaderboardEntry = {
  deviceId: string;
  displayName: string | null;
  group: string | null;
  doneCount: number;
  totalScore: number;
  levelScore: number | null;
  /** Кол-во пройденных уроков теории (расширение sprint C). */
  lessonsCount?: number;
  /** Кол-во правильно решённых упражнений practice. */
  practiceCount?: number;
  /** Кол-во полученных бейджей. */
  achievementsCount?: number;
  /** Когда сдан капстоун (или null). */
  capstonePassedAt?: number | null;
  updatedAt: number;
};

export type GroupInfo = { name: string; count: number };

export type SmetaStats = {
  studentsTotal: number;
  attemptsTotal: number;
  perLevel: Record<
    number,
    { open: number; "in-progress": number; done: number; avgScore: number }
  >;
  /** Сумма пройденных уроков по всем студентам. */
  lessonsCompletedTotal?: number;
  /** Кол-во правильно решённых упражнений практики. */
  practiceCorrectTotal?: number;
  /** Кол-во студентов, сдавших капстоун. */
  capstonePassed?: number;
  /** Топ-5 «трудных» уроков (низший средний балл). */
  hardestLessons?: Array<{ lessonId: string; avgScore: number; attempts: number; doneCount: number }>;
  lastUpdate: number;
};

export type AdminStudentRecord = ServerStudent & {
  lessonsDone: number;
  practiceDone: number;
  achievementsCount: number;
  doneLevels: number;
};

class BackendUnavailableError extends Error {
  constructor() { super("backend unavailable"); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    throw new BackendUnavailableError();
  }
}

export async function fetchStudent(): Promise<ServerStudent | null> {
  const id = getDeviceId();
  const r = await api<{ student: ServerStudent | null }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}`,
  );
  return r.student;
}

export async function syncProgress(p: CourseProgress, displayName?: string, group?: string): Promise<ServerStudent> {
  const id = getDeviceId();
  // CourseProgress.levels: Record<number, LevelProgress> — приводим к серверной форме.
  const levels: Record<string, ServerLevelProgress> = {};
  for (const [k, v] of Object.entries(p.levels)) {
    const lvl = Number(k);
    if (!Number.isFinite(lvl)) continue;
    levels[String(lvl)] = {
      level: lvl,
      status: v.status === "locked" ? "open" : v.status,
      score: v.score,
      completedAt: v.completedAt ? new Date(v.completedAt).getTime() : undefined,
      attemptsCnt: v.attempts,
    };
  }
  const r = await api<{ student: ServerStudent }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/sync`,
    { method: "POST", body: JSON.stringify({ levels, displayName, group }) },
  );
  return r.student;
}

export async function recordAttempt(
  level: number,
  kind: "quiz" | "exercise" | "lsr-submit",
  score?: number,
  payload?: unknown,
  feedback?: string,
): Promise<AttemptRecord> {
  const id = getDeviceId();
  const r = await api<{ attempt: AttemptRecord }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/attempt`,
    { method: "POST", body: JSON.stringify({ level, kind, score, payload, feedback }) },
  );
  return r.attempt;
}

export async function fetchAttempts(limit = 50): Promise<AttemptRecord[]> {
  const id = getDeviceId();
  const r = await api<{ attempts: AttemptRecord[] }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/attempts?limit=${limit}`,
  );
  return r.attempts;
}

export async function fetchLeaderboard(
  level?: number,
  limit = 20,
  group?: string,
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams();
  if (level) params.set("level", String(level));
  if (group) params.set("group", group);
  params.set("limit", String(limit));
  const r = await api<{ leaderboard: LeaderboardEntry[] }>(
    `/api/smeta-trainer/leaderboard?${params.toString()}`,
  );
  return r.leaderboard;
}

export async function fetchGroups(): Promise<GroupInfo[]> {
  const r = await api<{ groups: GroupInfo[] }>(`/api/smeta-trainer/groups`);
  return r.groups;
}

export async function syncLessons(
  lessons: Record<string, { completed: boolean; quizScore?: number; ts: number }>,
): Promise<ServerStudent> {
  const id = getDeviceId();
  const r = await api<{ student: ServerStudent }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/lessons`,
    { method: "POST", body: JSON.stringify({ lessons }) },
  );
  return r.student;
}

export async function syncPractice(
  practice: Record<string, { correct: boolean; attempts: number; ts: number }>,
): Promise<ServerStudent> {
  const id = getDeviceId();
  const r = await api<{ student: ServerStudent }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/practice`,
    { method: "POST", body: JSON.stringify({ practice }) },
  );
  return r.student;
}

export async function syncCapstone(passed: boolean): Promise<ServerStudent> {
  const id = getDeviceId();
  const r = await api<{ student: ServerStudent }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/capstone`,
    { method: "POST", body: JSON.stringify({ passed }) },
  );
  return r.student;
}

export async function syncAchievements(achievements: string[]): Promise<ServerStudent> {
  const id = getDeviceId();
  const r = await api<{ student: ServerStudent }>(
    `/api/smeta-trainer/student/${encodeURIComponent(id)}/achievements`,
    { method: "POST", body: JSON.stringify({ achievements }) },
  );
  return r.student;
}

export async function fetchAdminStudents(
  jwt: string,
  group?: string,
  limit = 200,
): Promise<{ students: AdminStudentRecord[]; totalInGroup: number }> {
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  params.set("limit", String(limit));
  return api<{ students: AdminStudentRecord[]; totalInGroup: number }>(
    `/api/smeta-trainer/admin/students?${params.toString()}`,
    { headers: { authorization: `Bearer ${jwt}` } },
  );
}

export async function fetchStats(): Promise<SmetaStats> {
  return api<SmetaStats>(`/api/smeta-trainer/stats`);
}

/** Проверка живости бэкенда — для conditional UI. */
export async function pingBackend(): Promise<boolean> {
  try {
    await fetchStudent();
    return true;
  } catch {
    return false;
  }
}

// ── Shared material overrides (curator-set) ──────────────────────────
export type SharedOverride = {
  name: string;
  unit: string;
  sscCode: string | null;
  sscName?: string;
  smetnaya?: number;
  otpusknaya?: number | null;
  sscBook?: string;
  setBy: string | null;
  setAt: number;
};

export async function fetchSharedOverrides(): Promise<SharedOverride[]> {
  const r = await api<{ overrides: SharedOverride[] }>(`/api/smeta-trainer/material-overrides`);
  return r.overrides;
}

/** Требует JWT в Authorization: Bearer ... — куратор/админ. */
export async function pushSharedOverride(
  payload: Omit<SharedOverride, "setBy" | "setAt">,
  jwt: string,
): Promise<SharedOverride> {
  const r = await api<{ override: SharedOverride }>(
    `/api/smeta-trainer/material-overrides`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}` },
      body: JSON.stringify(payload),
    },
  );
  return r.override;
}

export async function deleteSharedOverride(
  name: string, unit: string, jwt: string,
): Promise<void> {
  await api<{ ok: true }>(
    `/api/smeta-trainer/material-overrides?name=${encodeURIComponent(name)}&unit=${encodeURIComponent(unit)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${jwt}` } },
  );
}

export { BackendUnavailableError };
