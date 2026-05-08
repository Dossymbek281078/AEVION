import type { Metadata } from "next";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";

export const metadata: Metadata = {
  title: "Changelog — AEVION QBuild",
  description:
    "Recent shipped features, polish rounds, and platform updates on the AEVION QBuild recruiting platform.",
  openGraph: {
    title: "AEVION QBuild · Changelog",
    description: "What's new on QBuild — features shipped this month and last.",
  },
};

type Entry = {
  date: string;
  tag: "feature" | "polish" | "fix" | "api";
  title: string;
  body: string;
};

const ENTRIES: Entry[] = [
  {
    date: "2026-05-06",
    tag: "feature",
    title: "Boost ROI tile + 🔥 Hot vacancies + duplicate-vacancy guard",
    body: "Vacancy detail now shows a Boost ROI mini-panel comparing applications during the boost vs. the equivalent window before. The public feed flags trending listings with a 🔥 chip (recent + top-quartile applicant interest). Posting a new vacancy warns if the title fuzzy-matches an existing one in the same project.",
  },
  {
    date: "2026-05-06",
    tag: "feature",
    title: "Recruiter Today digest tile",
    body: "Dashboard opens with a digest tile: applications received in the last 24h, vacancies closing soon, stale pending decisions, and total open applicants — only when there's something actionable.",
  },
  {
    date: "2026-05-05",
    tag: "feature",
    title: "Bulk vacancy import + edit history + republish",
    body: "Project page gained CSV-style bulk creation (max 50 rows), full edit-history audit, and a one-click republish that resets visibility and expiry. Vacancy export CSV now includes label and skills columns.",
  },
  {
    date: "2026-05-05",
    tag: "feature",
    title: "Saved talent searches + cross-session alerts",
    body: "Recruiters can save searches on /build/talent and the dashboard surfaces a banner when matching candidates update their profiles since last view (client-side, no inbox spam).",
  },
  {
    date: "2026-05-04",
    tag: "feature",
    title: "Snooze, flag, and structured reject reasons",
    body: "Applications can be snoozed (hidden from view until a date) or flagged for moderation. Rejection now goes through a 6-bucket dropdown with optional note — feeding /stats/reject-reasons so teams can see why offers fall through.",
  },
  {
    date: "2026-05-04",
    tag: "feature",
    title: "AI Why-Match + interview scheduler in DMs",
    body: "Vacancy review surfaces an AI bullet list explaining why a candidate fits. The chat composer has a 📅 button that builds Google/Outlook/.ics calendar links inline.",
  },
  {
    date: "2026-05-03",
    tag: "feature",
    title: "Partner API + drop-in widget + RSS",
    body: "Public read-only API with mint-your-own keys (/build/admin/partner-keys), a one-script <div data-aevion-build> widget, and an RSS 2.0 feed at /api/build/public/rss/vacancies.xml.",
  },
  {
    date: "2026-05-03",
    tag: "feature",
    title: "Compare vacancies side-by-side",
    body: "Pin up to 3 listings via the toggle on each card; /build/compare shows them in a parallel table — salary, skills, expiry, applicant count.",
  },
  {
    date: "2026-05-02",
    tag: "polish",
    title: "Profile completeness meter + share link",
    body: "Profile page now shows what's missing (priority chips for fields that move shortlist rates the most) and a personal share link with attribution that survives 30 days across navigations.",
  },
  {
    date: "2026-05-02",
    tag: "feature",
    title: "Referral leaderboard + cashback claim",
    body: "Top referrers visible on /build/leaderboard. Successful hires award cashback that recruiters claim directly from /build/loyalty.",
  },
  {
    date: "2026-05-01",
    tag: "api",
    title: "OG images + sitemap + JSON-LD coverage",
    body: "Dynamic OG cards for /build/[id] routes, expanded sitemap (employer + skill landing pages), and JSON-LD JobPosting / Organization / ItemList for crawlers.",
  },
  {
    date: "2026-05-01",
    tag: "feature",
    title: "Public stats + featured employers + admin index",
    body: "Open data surface on /build/stats — open vacancies, average salary, top cities, featured employers — plus a richer admin dashboard for moderation.",
  },
  {
    date: "2026-04-30",
    tag: "feature",
    title: "Payment webhook + admin leads + UTM attribution",
    body: "Stripe-style webhooks for boost purchases, lead inbox in admin, and UTM/source tagging on every application so recruiters know what's converting.",
  },
  {
    date: "2026-04-30",
    tag: "feature",
    title: "AI Improve on experience entries",
    body: "Inline AI rewrite for resume bullets — both during creation and edit — kept under the same /api/build/ai/improve contract.",
  },
  {
    date: "2026-04-29",
    tag: "feature",
    title: "/build/why-aevion + email lead capture",
    body: "Bilingual landing page (RU/EN) explaining the platform's pitch, with a built-in email lead form going straight to the admin inbox.",
  },
];

const TAG_TONE: Record<Entry["tag"], string> = {
  feature: "border-emerald-400/40 bg-emerald-400/15 text-emerald-100",
  polish: "border-sky-400/40 bg-sky-400/15 text-sky-100",
  fix: "border-rose-400/40 bg-rose-400/15 text-rose-100",
  api: "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-100",
};

export default function ChangelogPage() {
  // Group by month for a slightly more scannable layout.
  const grouped = ENTRIES.reduce<Record<string, Entry[]>>((acc, e) => {
    const key = e.date.slice(0, 7);
    (acc[key] ||= []).push(e);
    return acc;
  }, {});
  const months = Object.keys(grouped).sort().reverse();

  return (
    <BuildShell>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Changelog</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Public log of what's shipping on AEVION QBuild — features, polish, fixes. Updated as
          rounds merge to{" "}
          <code className="rounded bg-white/10 px-1 text-slate-300">main</code>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href="/build/developers"
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10"
          >
            ← Developer docs
          </Link>
          <a
            href="/api/build/public/rss/vacancies.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-200 hover:bg-amber-400/20"
          >
            🛜 RSS — open vacancies
          </a>
        </div>
      </header>

      <div className="space-y-10">
        {months.map((m) => (
          <section key={m}>
            <div className="mb-3 flex items-baseline gap-3 border-b border-white/5 pb-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                {monthLabel(m)}
              </h2>
              <span className="text-[11px] text-slate-600">
                {grouped[m].length} update{grouped[m].length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-4">
              {grouped[m].map((e, i) => (
                <li
                  key={`${m}-${i}`}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG_TONE[e.tag]}`}
                    >
                      {e.tag}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(e.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{e.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{e.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-slate-500">
        Suggestions or issues? Open one at{" "}
        <a
          href="mailto:hello@aevion.tech"
          className="text-emerald-300 underline hover:text-emerald-200"
        >
          hello@aevion.tech
        </a>
        .
      </p>
    </BuildShell>
  );
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
