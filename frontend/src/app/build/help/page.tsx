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
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-10 text-[#17181a]">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-[#74767c] hover:underline">← QBuild</Link>
        <h1 className="mt-3 text-3xl font-extrabold text-[#17181a]">Help & FAQ</h1>
        <p className="mt-2 text-sm text-[#74767c]">Answers to the most common questions.</p>
        <p className="mt-3 text-sm text-[#45474c]">
          {t("build.help.guidesIntro")}{" "}
          <Link href="/build/guide" className="text-[#075b53] underline">
            {t("build.help.guidesEmployer")}
          </Link>{" "}
          ·{" "}
          <Link href="/build/guide-worker" className="text-[#075b53] underline">
            {t("build.help.guidesWorker")}
          </Link>
          .
        </p>
        <HelpClient workers={FAQ_WORKERS} employers={FAQ_EMPLOYERS} />
      </div>
    </main>
  );
}
