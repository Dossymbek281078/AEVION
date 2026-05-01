"use client";

import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { AiCoachChat } from "@/components/build/AiCoachChat";

export default function CoachPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">AI карьерный коуч</h1>
          <p className="mt-1 text-sm text-slate-400">
            Анализирует твой профиль и открытые вакансии в QBuild. Помогает переписать резюме, подобрать вакансии, оценить вилку.
            Работает на Claude Haiku — быстро и без задержек.
          </p>
        </div>
        <AiCoachChat height={620} />
      </RequireAuth>
    </BuildShell>
  );
}
