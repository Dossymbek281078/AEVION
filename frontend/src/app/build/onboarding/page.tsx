"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

type Step = {
  key: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  done: boolean;
};

export default function OnboardingPage() {
  return (
    <BuildShell theme="light">
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Probe each step in parallel; tolerate individual failures.
      const [me, projects, funnel, bookmarks, referrals] = await Promise.all([
        buildApi.me().catch(() => null),
        buildApi.listProjects({ mine: true, limit: 5 }).catch(() => null),
        buildApi.myVacanciesFunnel().catch(() => null),
        buildApi.listBookmarks().catch(() => null),
        buildApi.myReferrals().catch(() => null),
      ]);
      if (cancelled) return;

      const profile = me?.profile;
      const profileFilled =
        !!profile &&
        !!profile.title &&
        !!profile.summary &&
        (profile.skills?.length ?? 0) >= 2;

      const hasProject = !!projects && projects.items.length > 0;
      const hasVacancy = !!funnel && funnel.items.length > 0;
      const hasBookmark = !!bookmarks && bookmarks.items.length > 0;
      const hasReferral = !!referrals && referrals.totalReferred > 0;

      setSteps([
        {
          key: "profile",
          title: "Заполните профиль",
          body:
            "Минимум: должность, краткое summary, и 2+ навыка. Это нужно, чтобы ваши проекты отображались в рекомендациях.",
          cta: { label: "К профилю →", href: "/build/profile" },
          done: profileFilled,
        },
        {
          key: "project",
          title: "Создайте первый проект",
          body:
            "Проект — это контейнер для одной или нескольких вакансий. Указывается город, бюджет, сроки.",
          cta: { label: "Создать проект →", href: "/build/create-project" },
          done: hasProject,
        },
        {
          key: "vacancy",
          title: "Опубликуйте вакансию",
          body:
            "Откройте свой проект и нажмите «+ Add vacancy». Чем конкретнее описание, тем выше apply rate (см. AI-фидбэк).",
          cta: { label: "Мои проекты →", href: "/build" },
          done: hasVacancy,
        },
        {
          key: "bookmarks",
          title: "Сохраните 3 кандидата в закладки",
          body:
            "Зайдите на /build/talent, найдите подходящих специалистов и добавьте в закладки. Удобно сравнивать через /build/compare.",
          cta: { label: "Поиск кандидатов →", href: "/build/talent" },
          done: !!bookmarks && bookmarks.items.length >= 3,
        },
        {
          key: "share",
          title: "Поделитесь реферальной ссылкой",
          body:
            "Получайте AEV-кэшбэк за каждого приведённого работодателя/кандидата. Ссылка живёт в /build/referrals.",
          cta: { label: "К рефералам →", href: "/build/referrals" },
          done: hasReferral,
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!steps) {
    return <p className="text-sm text-paper-ink-faint">Loading…</p>;
  }

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-paper-ink">Welcome to QBuild</h1>
        <p className="mt-1 text-sm text-paper-ink-faint">
          5 шагов от регистрации до первого найма. Можно пропускать и возвращаться позже.
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-paper-teal/25 bg-paper-teal/[0.06] p-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <div className="font-semibold text-paper-teal-deep">
            {completed} of {steps.length} steps complete
          </div>
          <div className="text-xs text-paper-teal/80">{pct}%</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-teal/15">
          <div
            className="h-full bg-paper-teal transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {completed === steps.length && (
          <p className="mt-2 text-xs text-paper-teal-deep">
            🎉 Все шаги пройдены — вы готовы нанимать на QBuild!
          </p>
        )}
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`rounded-xl border p-4 transition ${
              s.done
                ? "border-paper-teal/25 bg-paper-teal/[0.04]"
                : "border-paper-rule bg-paper-card"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done
                    ? "bg-paper-teal text-white"
                    : "bg-paper-2 text-paper-ink-soft"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-paper-ink">{s.title}</h2>
                <p className="mt-0.5 text-sm text-paper-ink-soft">{s.body}</p>
                {!s.done && (
                  <Link
                    href={s.cta.href}
                    className="mt-2 inline-flex rounded-md border border-paper-teal/40 bg-paper-teal/10 px-2.5 py-1 text-xs font-semibold text-paper-teal-deep transition hover:bg-paper-teal/20"
                  >
                    {s.cta.label}
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-[11px] text-paper-ink-faint-2">
        Нужен разбор с механикой оплаты?{" "}
        <Link href="/build/guide" className="text-paper-teal-deep underline">
          Гайд для работодателя
        </Link>
        . Частые вопросы —{" "}
        <Link href="/build/help" className="text-paper-teal-deep underline">
          /build/help
        </Link>
        , или напишите на{" "}
        <a href="mailto:hello@aevion.tech" className="text-paper-teal-deep underline">
          hello@aevion.tech
        </a>
        .
      </p>
    </>
  );
}
