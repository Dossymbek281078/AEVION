"use client";

import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { AiCoachChat } from "@/components/build/AiCoachChat";
import { useI18n } from "@/lib/i18n";

export default function CoachPage() {
  const { t } = useI18n();
  return (
    <BuildShell>
      <RequireAuth>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">{t("build.coach.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("build.coach.description")}</p>
        </div>
        <AiCoachChat height={620} />
      </RequireAuth>
    </BuildShell>
  );
}
