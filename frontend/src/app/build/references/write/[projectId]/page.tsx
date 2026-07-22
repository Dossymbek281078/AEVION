"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useToast } from "@/components/build/Toast";
import { useI18n } from "@/lib/i18n";

const SKILL_PRESET_KEYS = [
  "punctuality", "quality", "communication",
  "deadlines", "safety", "teamwork",
  "professionalism", "initiative",
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
  const { t } = useI18n();
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

  function skillLabel(key: string): string {
    return t(`build.referenceWrite.skill.${key}`);
  }

  function toggleSkill(s: string) {
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 8));
  }

  async function submit() {
    if (!workerId.trim() || rating === 0 || text.trim().length < 20) {
      toast.error(t("build.referenceWrite.validationError"));
      return;
    }
    setSubmitting(true);
    try {
      await buildApi.createReference(projectId, {
        workerId: workerId.trim(),
        rating,
        text: text.trim() + (skills.length ? `\n\n${t("build.referenceWrite.keySkillsLabel")}: ${skills.map(skillLabel).join(", ")}` : ""),
        recommend,
      });
      toast.success(t("build.referenceWrite.publishSuccess"));
      router.push(`/build/project/${projectId}`);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? t("build.referenceWrite.saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  const ratingLabels = [
    "",
    t("build.referenceWrite.rating.1"),
    t("build.referenceWrite.rating.2"),
    t("build.referenceWrite.rating.3"),
    t("build.referenceWrite.rating.4"),
    t("build.referenceWrite.rating.5"),
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/build/project/${projectId}`} className="text-slate-400 hover:text-white text-sm">
          ← {t("build.referenceWrite.backToProject")}
        </Link>
        <span className="text-slate-700">·</span>
        <h1 className="text-lg font-bold">{t("build.referenceWrite.title")}</h1>
      </div>
      {projectTitle && (
        <p className="text-slate-400 text-sm mb-6">
          {t("build.referenceWrite.projectLabel")}: <strong className="text-white">{projectTitle}</strong>
        </p>
      )}

      <div className="space-y-5">
        {/* Worker */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {t("build.referenceWrite.specialistLabel")}
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
                placeholder={t("build.referenceWrite.specialistIdPlaceholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
              <p className="text-xs text-slate-600 mt-1">
                {t("build.referenceWrite.findIdHint")} /build/u/<em>ID</em>
              </p>
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {t("build.referenceWrite.ratingLabel")}
          </label>
          <StarPicker value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="text-xs text-slate-500 mt-1">{ratingLabels[rating]}</p>
          )}
        </div>

        {/* Text */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {t("build.referenceWrite.textLabel")}{" "}
            <span className="text-slate-600 normal-case">({t("build.referenceWrite.textMinChars")})</span>
          </label>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            placeholder={t("build.referenceWrite.textPlaceholder")}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 resize-none"
          />
          <p className="text-xs text-slate-600 mt-1 text-right">{text.length}/2000</p>
        </div>

        {/* Skills */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {t("build.referenceWrite.skillsLabel")}
          </label>
          <div className="flex gap-2 flex-wrap">
            {SKILL_PRESET_KEYS.map((s) => (
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
                {skillLabel(s)}
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
            {t("build.referenceWrite.recommendLabel")}
          </span>
        </label>

        <button
          onClick={submit}
          disabled={submitting || !workerId.trim() || rating === 0 || text.trim().length < 20}
          className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          {submitting ? t("build.referenceWrite.publishing") : t("build.referenceWrite.publishBtn")}
        </button>
        <p className="text-xs text-slate-600 text-center">{t("build.referenceWrite.revokeHint")}</p>
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
