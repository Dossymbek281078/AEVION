import type { Metadata } from "next";
import Link from "next/link";
import { HelpClient } from "./HelpClient";
import { getServerT } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "QBuild Help — FAQ for workers and employers",
  description: "Frequently asked questions about AEVION QBuild construction recruiting platform.",
};

const FAQ_WORKERS_KEYS = [
  { q: "build.help.workers.q1", a: "build.help.workers.a1" },
  { q: "build.help.workers.q2", a: "build.help.workers.a2" },
  { q: "build.help.workers.q3", a: "build.help.workers.a3" },
  { q: "build.help.workers.q4", a: "build.help.workers.a4" },
  { q: "build.help.workers.q5", a: "build.help.workers.a5" },
  { q: "build.help.workers.q6", a: "build.help.workers.a6" },
];

const FAQ_EMPLOYERS_KEYS = [
  { q: "build.help.employers.q1", a: "build.help.employers.a1" },
  { q: "build.help.employers.q2", a: "build.help.employers.a2" },
  { q: "build.help.employers.q3", a: "build.help.employers.a3" },
  { q: "build.help.employers.q4", a: "build.help.employers.a4" },
  { q: "build.help.employers.q5", a: "build.help.employers.a5" },
  { q: "build.help.employers.q6", a: "build.help.employers.a6" },
];

export default async function HelpPage() {
  const { t } = await getServerT();
  const FAQ_WORKERS = FAQ_WORKERS_KEYS.map(({ q, a }) => ({ q: t(q), a: t(a) }));
  const FAQ_EMPLOYERS = FAQ_EMPLOYERS_KEYS.map(({ q, a }) => ({ q: t(q), a: t(a) }));
  return (
    <main className="min-h-screen bg-paper px-4 py-10 text-paper-ink">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-paper-ink-faint hover:underline">← QBuild</Link>
        <h1 className="mt-3 text-3xl font-extrabold text-paper-ink">Help & FAQ</h1>
        <p className="mt-2 text-sm text-paper-ink-faint">Answers to the most common questions.</p>
        <p className="mt-3 text-sm text-paper-ink-soft">
          {t("build.help.guidesIntro")}{" "}
          <Link href="/build/guide" className="text-paper-teal-deep underline">
            {t("build.help.guidesEmployer")}
          </Link>{" "}
          ·{" "}
          <Link href="/build/guide-worker" className="text-paper-teal-deep underline">
            {t("build.help.guidesWorker")}
          </Link>
          .
        </p>
        <HelpClient workers={FAQ_WORKERS} employers={FAQ_EMPLOYERS} />
      </div>
    </main>
  );
}
