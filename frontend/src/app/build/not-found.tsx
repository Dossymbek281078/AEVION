import Link from "next/link";

const SUGGESTIONS: { href: string; title: string; sub: string }[] = [
  { href: "/build", title: "Projects", sub: "Browse open construction projects" },
  { href: "/build/vacancies", title: "Vacancies", sub: "Filter open roles by skill, salary, city" },
  { href: "/build/talent", title: "Talent", sub: "Search candidates by skill" },
  { href: "/build/leaderboard", title: "Leaderboard", sub: "Top employers and workers by review" },
  { href: "/build/help", title: "Help & FAQ", sub: "How QBuild works for both sides" },
  { href: "/build/why-aevion", title: "Why AEVION", sub: "What we ship that HH doesn't" },
];

export default function BuildNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(217,70,239,0.10),transparent_60%)] bg-slate-950 px-6 py-16 text-center">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 bg-clip-text text-7xl font-extrabold text-transparent sm:text-8xl">
        404
      </div>
      <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Page not found on QBuild.</h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Either the page was moved, the vacancy was closed, or the link is mistyped. Try one of these.
      </p>

      <div className="mt-8 grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-emerald-500/40 hover:bg-white/[0.06]"
          >
            <div className="text-sm font-semibold text-white">{s.title}</div>
            <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/build"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          ← QBuild home
        </Link>
        <Link
          href="/build/vacancies"
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Browse vacancies
        </Link>
      </div>
    </main>
  );
}
