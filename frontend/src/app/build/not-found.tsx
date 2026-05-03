import Link from "next/link";

export default function BuildNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="text-6xl font-extrabold text-slate-700">404</div>
      <h1 className="mt-4 text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-2 text-sm text-slate-400">
        This page doesn&apos;t exist or was removed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/build"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          ← Back to projects
        </Link>
        <Link
          href="/build/vacancies"
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Browse vacancies
        </Link>
      </div>
    </div>
  );
}
