"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useToast } from "@/components/build/Toast";

const SKILL_PRESETS = [
  "Пунктуальность", "Качество работы", "Коммуникация",
  "Соблюдение сроков", "Безопасность", "Командная работа",
  "Профессионализм", "Инициативность",
];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition-transform hover:scale-110"
        >
          <span className={(hover || value) >= s ? "text-amber-400" : "text-slate-700"}>★</span>
        </button>
      ))}
    </div>
  );
}

function WriteReferenceForm() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const preWorkerId = searchParams.get("workerId") ?? "";
  const preWorkerName = searchParams.get("workerName") ?? "";

  const [projectTitle, setProjectTitle] = useState("");
  const [workerId, setWorkerId] = useState(preWorkerId);
  const [workerName] = useState(preWorkerName);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [recommend, setRecommend] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    buildApi.getProject(projectId).then((p) => setProjectTitle(p.project?.title ?? "")).catch(() => {});
  }, [projectId]);

  function toggleSkill(s: string) {
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 8));
  }

  async function submit() {
    if (!workerId.trim() || rating === 0 || text.trim().length < 20) {
      toast.error("Укажите ID специалиста, оценку и минимум 20 символов");
      return;
    }
    setSubmitting(true);
    try {
      await buildApi.createReference(projectId, {
        workerId: workerId.trim(),
        rating,
        text: text.trim() + (skills.length ? `\n\nКлючевые навыки: ${skills.join(", ")}` : ""),
        recommend,
      });
      toast.success("Рекомендация опубликована! Она появится в профиле специалиста.");
      router.push(`/build/project/${projectId}`);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  }

  const ratingLabels = ["", "Очень плохо", "Плохо", "Нормально", "Хорошо", "Отлично"];

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/build/project/${projectId}`} className="text-slate-400 hover:text-white text-sm">
          ← Проект
        </Link>
        <span className="text-slate-700">·</span>
        <h1 className="text-lg font-bold">Написать рекомендацию</h1>
      </div>
      {projectTitle && (
        <p className="text-slate-400 text-sm mb-6">
          Проект: <strong className="text-white">{projectTitle}</strong>
        </p>
      )}

      <div className="space-y-5">
        {/* Worker */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Специалист
          </label>
          {workerName ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold shrink-0">
                {workerName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{workerName}</p>
                <p className="text-xs text-slate-500 font-mono">{workerId}</p>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                placeholder="User ID специалиста"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
              <p className="text-xs text-slate-600 mt-1">
                Найти ID в URL профиля: /build/u/<em>ID</em>
              </p>
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Оценка
          </label>
          <StarPicker value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="text-xs text-slate-500 mt-1">{ratingLabels[rating]}</p>
          )}
        </div>

        {/* Text */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Текст рекомендации{" "}
            <span className="text-slate-600 normal-case">(мин. 20 символов)</span>
          </label>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            placeholder="Опишите опыт работы: качество, надёжность, что особенно выделилось..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 resize-none"
          />
          <p className="text-xs text-slate-600 mt-1 text-right">{text.length}/2000</p>
        </div>

        {/* Skills */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Отмеченные навыки
          </label>
          <div className="flex gap-2 flex-wrap">
            {SKILL_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSkill(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  skills.includes(s)
                    ? "bg-violet-600 border-violet-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Recommend checkbox */}
        <label className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={recommend}
            onChange={(e) => setRecommend(e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm font-medium text-slate-200">
            Рекомендую этого специалиста другим работодателям
          </span>
        </label>

        <button
          onClick={submit}
          disabled={submitting || !workerId.trim() || rating === 0 || text.trim().length < 20}
          className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          {submitting ? "Публикация…" : "Опубликовать рекомендацию"}
        </button>
        <p className="text-xs text-slate-600 text-center">Можно отозвать в течение 7 дней</p>
      </div>
    </div>
  );
}

export default function WriteReferencePage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Suspense>
          <WriteReferenceForm />
        </Suspense>
      </RequireAuth>
    </BuildShell>
  );
}
