"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFunnel } from "@/lib/useFunnel";
import {
  classify,
  DEFAULT_SLIDERS,
  SLIDER_META,
  type Sliders,
  type SliderMeta,
} from "@/lib/constitution";
import { useI18n } from "@/lib/i18n";

type LessonId =
  | "floor"
  | "ruleOfLaw"
  | "rotation"
  | "transparency"
  | "multiStatus"
  | "skinInGame"
  | "polycentricity"
  | "positiveSum";

type Task = {
  /** Sliders pre-filled (one to be tuned by the student) */
  fixed: Partial<Sliders>;
  /** Slider key the student must move */
  target: LessonId;
  /** Regime ID the student must reach */
  expectedRegimeId: string;
  /** Tolerance: target slider must be ≥ this value (or ≤) */
  expectedAboveOrBelow: "above" | "below";
  expectedThreshold: number;
};

type Lesson = {
  id: LessonId;
  number: number;
  // title/theory/example/hint text lives in i18n-data.ts under
  // "constitution.lesson.<id>.*" — looked up via t() at render time, not
  // stored here, so translations stay in one place.
  pillar: "Pillar 1: Floor below" | "Pillar 2: Law above" | "Pillar 3: Rotation & status" | "Pillar 4: Growing pie";
  task: Task;
};

const LESSONS: Lesson[] = [
  {
    id: "floor",
    number: 1,
    pillar: "Pillar 1: Floor below",
    task: {
      fixed: { ruleOfLaw: 85, rotation: 60, transparency: 80, multiStatus: 55, skinInGame: 55, polycentricity: 30, positiveSum: 65 },
      target: "floor",
      expectedRegimeId: "nordic",
      expectedAboveOrBelow: "above",
      expectedThreshold: 70,
    },
  },
  {
    id: "ruleOfLaw",
    number: 2,
    pillar: "Pillar 2: Law above",
    task: {
      fixed: { floor: 50, rotation: 10, transparency: 40, multiStatus: 30, skinInGame: 30, polycentricity: 20, positiveSum: 60 },
      target: "ruleOfLaw",
      expectedRegimeId: "feudalism",
      expectedAboveOrBelow: "below",
      expectedThreshold: 35,
    },
  },
  {
    id: "rotation",
    number: 3,
    pillar: "Pillar 3: Rotation & status",
    task: {
      fixed: { floor: 35, ruleOfLaw: 55, transparency: 50, multiStatus: 55, skinInGame: 40, polycentricity: 70, positiveSum: 65 },
      target: "rotation",
      expectedRegimeId: "ancient-polis",
      expectedAboveOrBelow: "above",
      expectedThreshold: 65,
    },
  },
  {
    id: "transparency",
    number: 4,
    pillar: "Pillar 2: Law above",
    task: {
      fixed: { floor: 25, ruleOfLaw: 25, rotation: 10, multiStatus: 25, skinInGame: 25, polycentricity: 15, positiveSum: 50 },
      target: "transparency",
      expectedRegimeId: "authoritarian",
      expectedAboveOrBelow: "below",
      expectedThreshold: 25,
    },
  },
  {
    id: "multiStatus",
    number: 5,
    pillar: "Pillar 3: Rotation & status",
    task: {
      fixed: { floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80, skinInGame: 70, polycentricity: 65, positiveSum: 80 },
      target: "multiStatus",
      expectedRegimeId: "open-access",
      expectedAboveOrBelow: "above",
      expectedThreshold: 70,
    },
  },
  {
    id: "skinInGame",
    number: 6,
    pillar: "Pillar 4: Growing pie",
    task: {
      fixed: { floor: 40, ruleOfLaw: 45, rotation: 60, transparency: 70, multiStatus: 65, polycentricity: 85, positiveSum: 35 },
      target: "skinInGame",
      expectedRegimeId: "mixed",
      expectedAboveOrBelow: "above",
      expectedThreshold: 85,
    },
  },
  {
    id: "polycentricity",
    number: 7,
    pillar: "Pillar 3: Rotation & status",
    task: {
      fixed: { floor: 35, ruleOfLaw: 75, rotation: 35, transparency: 65, multiStatus: 75, skinInGame: 65, positiveSum: 80 },
      target: "polycentricity",
      expectedRegimeId: "network-post-nation",
      expectedAboveOrBelow: "above",
      expectedThreshold: 75,
    },
  },
  {
    id: "positiveSum",
    number: 8,
    pillar: "Pillar 4: Growing pie",
    task: {
      fixed: { floor: 30, ruleOfLaw: 30, rotation: 10, transparency: 20, multiStatus: 25, skinInGame: 30, polycentricity: 15 },
      target: "positiveSum",
      expectedRegimeId: "extractive-boom",
      expectedAboveOrBelow: "above",
      expectedThreshold: 65,
    },
  },
];

const PROGRESS_KEY = "constitution.academy.progress";

function loadProgress(): Set<LessonId> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as LessonId[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveProgress(set: Set<LessonId>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export default function ConstitutionLearnPage() {
  const { t } = useI18n();
  const [progress, setProgress] = useState<Set<LessonId>>(new Set());
  const [openLesson, setOpenLesson] = useState<LessonId | null>(null);
  const [certBusy, setCertBusy] = useState<boolean>(false);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const { track } = useFunnel();

  const complete = useCallback((id: LessonId) => {
    // Флаг ставится внутри апдейтера, а СОБЫТИЕ шлётся после него: React
    // вызывает апдейтер дважды, и отправка изнутри дала бы два события на
    // один пройденный урок. Повторное прохождение не считается — prev уже
    // содержит урок.
    let firstTime = false;
    setProgress((prev) => {
      if (prev.has(id)) return prev;
      firstTime = true;
      const next = new Set(prev);
      next.add(id);
      saveProgress(next);
      return next;
    });
    if (firstTime) track("academy_lesson_done", { lesson: id });
  }, [track]);

  const reset = () => {
    saveProgress(new Set());
    setProgress(new Set());
  };

  const allDone = progress.size === LESSONS.length;

  const downloadCert = async () => {
    // Событие на ЯВНОМ действии, а не на переходе allDone в истину: прогресс
    // восстанавливается из хранилища при загрузке, и по переходу мы считали бы
    // сертификатом каждый заход человека, прошедшего курс когда-то.
    track("academy_cert", { lessons: LESSONS.length });
    setCertBusy(true);
    try {
      const r = await fetch("/api-backend/api/constitution/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🎓 AEVION Constitution Academy — Completed",
          sliders: {
            floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80,
            multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80,
          },
          regime: { id: "open-access", name: "Open Access Order", era: "Academy graduation" },
        }),
      });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aevion-constitution-academy-cert-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setCertBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            {t("constitution.learn.title")}
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">
            {t("constitution.learn.subtitle")}
          </p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 max-w-md">
              <div className="text-xs text-[#9aa3c0] mb-1">
                {t("constitution.learn.progress")}: {progress.size} / {LESSONS.length}
              </div>
              <div className="h-2 bg-[#050a1a] rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#d4af37] to-emerald-400 transition-all"
                  style={{ width: `${(progress.size / LESSONS.length) * 100}%` }}
                />
              </div>
            </div>
            {allDone && (
              <button
                type="button"
                onClick={downloadCert}
                disabled={certBusy}
                className="px-4 py-2 rounded bg-gradient-to-r from-[#d4af37] to-emerald-400 text-[#0b1736] font-bold hover:opacity-90 disabled:opacity-40"
              >
                🎓 {certBusy ? "..." : t("constitution.learn.cert")}
              </button>
            )}
            {progress.size > 0 && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-[#9aa3c0] hover:text-rose-300"
              >
                {t("constitution.learn.reset")}
              </button>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LESSONS.map((lesson) => {
            const done = progress.has(lesson.id);
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setOpenLesson(lesson.id)}
                className={`text-left bg-[#0b1736]/60 border rounded-xl p-4 transition hover:bg-[#0b1736]/80 ${
                  done
                    ? "border-emerald-400/40"
                    : "border-[#d4af37]/20 hover:border-[#d4af37]/40"
                }`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs text-[#9aa3c0]">
                    {t("constitution.learn.lesson")} {lesson.number} · {lesson.pillar}
                  </div>
                  {done && <span className="text-emerald-400 text-sm">✓ Done</span>}
                </div>
                <div className="text-xl font-bold text-[#d4af37]">
                  {t(`constitution.lesson.${lesson.id}.title`)}
                </div>
                <div className="text-sm text-[#9aa3c0] mt-1 line-clamp-2">
                  {t(`constitution.lesson.${lesson.id}.theory`).slice(0, 120)}…
                </div>
              </button>
            );
          })}
        </section>

        {openLesson && (
          <LessonModal
            lesson={LESSONS.find((l) => l.id === openLesson)!}
            done={progress.has(openLesson)}
            onClose={() => setOpenLesson(null)}
            onComplete={() => complete(openLesson)}
          />
        )}
      </div>
    </div>
  );
}

function LessonModal({
  lesson,
  done,
  onClose,
  onComplete,
}: {
  lesson: Lesson;
  done: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  // Pre-fill task sliders
  const [sliders, setSliders] = useState<Sliders>(() => ({
    ...DEFAULT_SLIDERS,
    ...lesson.task.fixed,
    [lesson.task.target]: 50, // student adjusts this one
  }));
  const [checkResult, setCheckResult] = useState<{ ok: boolean; message: string } | null>(null);

  const meta = SLIDER_META.find((m) => m.key === lesson.task.target) as SliderMeta;
  const regime = useMemo(() => classify(sliders), [sliders]);

  const check = () => {
    const value = sliders[lesson.task.target];
    const meetsThreshold = lesson.task.expectedAboveOrBelow === "above"
      ? value >= lesson.task.expectedThreshold
      : value <= lesson.task.expectedThreshold;
    const regimeMatches = regime.id === lesson.task.expectedRegimeId;
    if (meetsThreshold && regimeMatches) {
      setCheckResult({
        ok: true,
        message: t("constitution.learn.check_success", {
          regime: regime.name,
          target: lesson.task.target,
          value,
        }),
      });
      onComplete();
    } else if (regimeMatches) {
      const direction = lesson.task.expectedAboveOrBelow === "above"
        ? t("constitution.learn.direction_above")
        : t("constitution.learn.direction_below");
      setCheckResult({
        ok: false,
        message: t("constitution.learn.check_close", {
          regime: regime.name,
          target: lesson.task.target,
          value,
          direction,
          threshold: lesson.task.expectedThreshold,
        }),
      });
    } else {
      setCheckResult({
        ok: false,
        message: t("constitution.learn.check_fail", {
          regime: regime.name,
          hint: t(`constitution.lesson.${lesson.id}.hint`),
        }),
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="bg-[#0b1736] border border-[#d4af37]/40 rounded-xl p-5 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <div className="text-xs text-[#9aa3c0]">
              {t("constitution.learn.lesson")} {lesson.number} · {lesson.pillar}
            </div>
            <h3 className="text-2xl font-bold text-[#d4af37]">
              {t(`constitution.lesson.${lesson.id}.title`)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9aa3c0] hover:text-white text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <section className="mb-5">
          <h4 className="text-sm font-semibold text-[#f5d27a] mb-1">
            {t("constitution.learn.theory_heading")}
          </h4>
          <p className="text-sm text-[#e7ecf8] leading-relaxed">
            {t(`constitution.lesson.${lesson.id}.theory`)}
          </p>
        </section>

        <section className="mb-5 border-l-2 border-[#d4af37]/30 pl-3">
          <h4 className="text-xs uppercase tracking-wider text-[#9aa3c0] mb-1">
            {t("constitution.learn.example_heading")}
          </h4>
          <p className="text-sm text-[#e7ecf8] italic">
            {t(`constitution.lesson.${lesson.id}.example`)}
          </p>
        </section>

        <section className="mb-5 bg-[#050a1a]/40 border border-[#d4af37]/20 rounded p-4">
          <h4 className="text-sm font-semibold text-[#f5d27a] mb-2">
            {t("constitution.learn.task_heading")}
          </h4>
          <p className="text-sm text-[#9aa3c0] mb-3">
            {t(`constitution.lesson.${lesson.id}.hint`)}
          </p>
          <div className="mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <label className="font-medium">{meta.label}</label>
              <span className="text-[#d4af37] font-mono">{sliders[lesson.task.target]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliders[lesson.task.target]}
              onChange={(e) =>
                setSliders((s) => ({ ...s, [lesson.task.target]: Number(e.target.value) }))
              }
              className="w-full accent-[#d4af37]"
            />
            <div className="flex justify-between text-xs text-[#9aa3c0] mt-1">
              <span>{meta.low}</span>
              <span>{meta.high}</span>
            </div>
          </div>
          <div className="text-xs text-[#9aa3c0] mb-3">
            {t("constitution.learn.current_regime")} <span className="text-[#f5d27a] font-semibold">{regime.name}</span>
            {" "}(id: <code>{regime.id}</code>)
          </div>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={check}
              className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold text-sm hover:opacity-90"
            >
              {t("constitution.learn.check")}
            </button>
            {done && (
              <span className="text-xs text-emerald-400">{t("constitution.learn.passed")}</span>
            )}
          </div>
          {checkResult && (
            <div
              className={`mt-3 text-sm border rounded px-3 py-2 ${
                checkResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/5 text-amber-300"
              }`}
            >
              {checkResult.message}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
