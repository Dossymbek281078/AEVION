"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
          title: t("build.onboarding.step1Title"),
          body: t("build.onboarding.step1Body"),
          cta: { label: t("build.onboarding.step1Cta"), href: "/build/profile" },
          done: profileFilled,
        },
        {
          key: "project",
          title: t("build.onboarding.step2Title"),
          body: t("build.onboarding.step2Body"),
          cta: { label: t("build.onboarding.step2Cta"), href: "/build/create-project" },
          done: hasProject,
        },
        {
          key: "vacancy",
          title: t("build.onboarding.step3Title"),
          body: t("build.onboarding.step3Body"),
          cta: { label: t("build.onboarding.step3Cta"), href: "/build" },
          done: hasVacancy,
        },
        {
          key: "bookmarks",
          title: t("build.onboarding.step4Title"),
          body: t("build.onboarding.step4Body"),
          cta: { label: t("build.onboarding.step4Cta"), href: "/build/talent" },
          done: !!bookmarks && bookmarks.items.length >= 3,
        },
        {
          key: "share",
          title: t("build.onboarding.step5Title"),
          body: t("build.onboarding.step5Body"),
          cta: { label: t("build.onboarding.step5Cta"), href: "/build/referrals" },
          done: hasReferral,
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!steps) {
    return <p className="text-sm text-[#74767c]">Loading…</p>;
  }

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#17181a]">Welcome to QBuild</h1>
        <p className="mt-1 text-sm text-[#74767c]">
          {t("build.onboarding.subtitle")}
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-[#0a7d72]/25 bg-[#0a7d72]/[0.06] p-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <div className="font-semibold text-[#075b53]">
            {completed} of {steps.length} steps complete
          </div>
          <div className="text-xs text-[#0a7d72]/80">{pct}%</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#0a7d72]/15">
          <div
            className="h-full bg-[#0a7d72] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {completed === steps.length && (
          <p className="mt-2 text-xs text-[#075b53]">
            {t("build.onboarding.allDone")}
          </p>
        )}
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`rounded-xl border p-4 transition ${
              s.done
                ? "border-[#0a7d72]/25 bg-[#0a7d72]/[0.04]"
                : "border-[#d4d3cc] bg-[#fffefb]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done
                    ? "bg-[#0a7d72] text-white"
                    : "bg-[#efeee8] text-[#45474c]"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[#17181a]">{s.title}</h2>
                <p className="mt-0.5 text-sm text-[#45474c]">{s.body}</p>
                {!s.done && (
                  <Link
                    href={s.cta.href}
                    className="mt-2 inline-flex rounded-md border border-[#0a7d72]/40 bg-[#0a7d72]/10 px-2.5 py-1 text-xs font-semibold text-[#075b53] transition hover:bg-[#0a7d72]/20"
                  >
                    {s.cta.label}
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-[11px] text-[#9a9c9f]">
        {t("build.onboarding.footerQuestion")}{" "}
        <Link href="/build/guide" className="text-[#075b53] underline">
          {t("build.onboarding.footerGuideLink")}
        </Link>
        . {t("build.onboarding.footerFaqLabel")}{" "}
        <Link href="/build/help" className="text-[#075b53] underline">
          /build/help
        </Link>
        , {t("build.onboarding.footerEmailLabel")}{" "}
        <a href="mailto:hello@aevion.tech" className="text-[#075b53] underline">
          hello@aevion.tech
        </a>
        .
      </p>
    </>
  );
}
