"use client";

/**
 * Сертификат экзамена — eligibility + payload + hash для QR.
 *
 * Правила выдачи:
 *   • 5 / 5 заданий сданы на «отлично» (best ≥ 85) — Honors
 *   • 4 / 5 на «хорошо+» (best ≥ 70) — Standard
 *   • меньше — нет права на сертификат
 */

import { EXAM_TASKS } from "./examTasks";
import { computeStats, type ExamAttempt } from "./examJournal";

export type CertificateTier = "honors" | "standard" | null;

export interface CertificatePayload {
  version: 1;
  tier: Exclude<CertificateTier, null>;
  studentName: string;
  issuedAt: string;
  results: Array<{
    taskId: string;
    title: string;
    score: number;
    grade: string;
    timestamp: string;
  }>;
  avgScore: number;
}

export interface CertificateEligibility {
  tier: CertificateTier;
  excellent: number;
  goodPlus: number;
  total: number;
  bestByTask: Map<string, ExamAttempt>;
  blockingTaskIds: string[]; // если tier=null — какие задания мешают
}

const STUDENT_NAME_KEY = "smeta-trainer:student-name:v1";

export function loadStudentName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STUDENT_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveStudentName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STUDENT_NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

export function checkEligibility(): CertificateEligibility {
  const stats = computeStats();
  const bestByTask = new Map<string, ExamAttempt>();
  for (const t of EXAM_TASKS) {
    const slot = stats.perTask.get(t.id);
    if (slot) bestByTask.set(t.id, slot.best);
  }
  let excellent = 0;
  let goodPlus = 0;
  const blocking: string[] = [];
  for (const t of EXAM_TASKS) {
    const best = bestByTask.get(t.id);
    if (!best) {
      blocking.push(t.id);
      continue;
    }
    if (best.score >= 85) {
      excellent += 1;
      goodPlus += 1;
    } else if (best.score >= 70) {
      goodPlus += 1;
    } else {
      blocking.push(t.id);
    }
  }
  let tier: CertificateTier = null;
  if (excellent === EXAM_TASKS.length) tier = "honors";
  else if (goodPlus >= 4) tier = "standard";
  return {
    tier,
    excellent,
    goodPlus,
    total: EXAM_TASKS.length,
    bestByTask,
    blockingTaskIds: blocking,
  };
}

export function buildPayload(
  eligibility: CertificateEligibility,
  studentName: string,
): CertificatePayload | null {
  if (!eligibility.tier) return null;
  const results = EXAM_TASKS.map((t) => {
    const best = eligibility.bestByTask.get(t.id);
    return {
      taskId: t.id,
      title: t.title,
      score: best?.score ?? 0,
      grade: best?.grade ?? "—",
      timestamp: best?.timestamp ?? "",
    };
  });
  const scores = results.map((r) => r.score).filter((s) => s > 0);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return {
    version: 1,
    tier: eligibility.tier,
    studentName: studentName.trim() || "Студент",
    issuedAt: new Date().toISOString(),
    results,
    avgScore,
  };
}

/** Кодируем payload в base64url для URL-сертификата. */
export function encodePayload(payload: CertificatePayload): string {
  const json = JSON.stringify(payload);
  if (typeof window === "undefined") return "";
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePayload(hash: string): CertificatePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    const parsed = JSON.parse(json) as CertificatePayload;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Короткий человекочитаемый serial для номера сертификата. */
export function certificateSerial(payload: CertificatePayload): string {
  let h = 0;
  for (let i = 0; i < payload.studentName.length; i += 1) {
    h = (h * 31 + payload.studentName.charCodeAt(i)) >>> 0;
  }
  const date = payload.issuedAt.slice(0, 10).replace(/-/g, "");
  const code = (h % 100000).toString().padStart(5, "0");
  const tierTag = payload.tier === "honors" ? "H" : "S";
  return `SMETA-${tierTag}-${date}-${code}`;
}
