"use client";

import Link from "next/link";
import { type BuildProfile } from "@/lib/build/api";
import { type BuildAuthUser } from "@/lib/build/auth";

type Step = {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

export function OnboardingChecklist({
  user,
  profile,
}: {
  user: BuildAuthUser;
  profile: BuildProfile | null;
}) {
  const steps: Step[] = [
    {
      id: "profile",
      label: "Заполни профиль",
      hint: "Без профиля нельзя откликаться на вакансии. Добавь имя, город и специальность.",
      href: "/build/profile",
      done: !!profile?.title || !!profile?.summary,
    },
    {
      id: "role",
      label: "Выбери роль",
      hint: "WORKER — ищешь работу. CLIENT — размещаешь вакансии. Можно поменять позже.",
      href: "/build/profile",
      done: !!profile && profile.buildRole !== "CLIENT" || !!profile,
    },
    {
      id: "email",
      label: "Подтверди email",
      hint: "Без подтверждённого email ты не получишь уведомления об откликах и сообщениях.",
      href: "/build/verify-email",
      done: !!user.emailVerifiedAt,
    },
    {
      id: "apply",
      label: "Подай первый отклик",
      hint: "Найди подходящую вакансию и нажми «Quick Apply» или заполни форму отклика.",
      href: "/build/vacancies",
      done: false, // we don't track this client-side cheaply — leave as CTA
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // all done — hide

  return (
    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">Добро пожаловать в QBuild!</div>
          <div className="text-xs text-slate-400">
            Выполни шаги, чтобы начать — {doneCount} из {steps.length} готово
          </div>
        </div>
        <div className="text-xs text-emerald-400 font-bold">
          {Math.round((doneCount / steps.length) * 100)}%
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <div className="mt-3 space-y-2">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.done ? "#" : step.href}
            className={`flex items-start gap-3 rounded-lg p-2 transition ${
              step.done ? "opacity-40 cursor-default" : "hover:bg-white/5"
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              step.done
                ? "border-emerald-500 bg-emerald-500 text-emerald-950"
                : "border-slate-600 text-slate-500"
            }`}>
              {step.done ? "✓" : ""}
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-medium ${step.done ? "line-through text-slate-500" : "text-white"}`}>
                {step.label}
              </div>
              {!step.done && (
                <div className="text-xs text-slate-400">{step.hint}</div>
              )}
            </div>
            {!step.done && (
              <span className="ml-auto shrink-0 text-xs text-emerald-400">→</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
