"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureError } from "@/lib/build/errorReporter";

// Catches uncaught render/effect errors in any /build/* route so a single
// crashing widget can't take the whole platform down. Forwards to Sentry
// when NEXT_PUBLIC_SENTRY_DSN is set, falls back to console otherwise.
export default function BuildError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { boundary: "/build", digest: error?.digest ?? null });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-2xl font-bold text-white">Something went wrong on QBuild.</h1>
      <p className="text-sm text-slate-400">
        The page hit an unexpected error. We&apos;ve logged it. You can try again, or jump back to a
        known-good place.
      </p>
      {error?.digest && (
        <p className="font-mono text-[10px] text-slate-500">ref: {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/build"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          QBuild home
        </Link>
        <Link
          href="/build/help"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Help
        </Link>
      </div>
    </main>
  );
}
