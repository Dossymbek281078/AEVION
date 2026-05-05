"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// Personal recruiter share-link. Token is just the userId — kept opaque-looking
// in the URL but no secret. Resolves to a /build/vacancies (or vacancy) page,
// dropping ?ref=<userId> + utm so the resulting application gets a sourceTag
// of "ref:<userId>" (handled by deriveApplySource).
//
// Usage from recruiter:
//   /build/r/<userId>           -> /build/vacancies?ref=<userId>
//   /build/r/<userId>?v=<vid>   -> /build/vacancy/<vid>?ref=<userId>
export default function ShareLinkPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const token = params?.token as string;

  useEffect(() => {
    if (!token) {
      router.replace("/build/vacancies");
      return;
    }
    const vacancyId = sp.get("v");
    const utm = "ref_share";
    const dest = vacancyId
      ? `/build/vacancy/${encodeURIComponent(vacancyId)}?ref=${encodeURIComponent(token)}&utm_source=${utm}`
      : `/build/vacancies?ref=${encodeURIComponent(token)}&utm_source=${utm}`;
    // Persist the ref token in localStorage so a candidate who lands on /r
    // first and applies later (after browsing) still gets attributed.
    try {
      localStorage.setItem("qbuild.refToken", token);
      localStorage.setItem("qbuild.refToken.ts", String(Date.now()));
    } catch { /* ignore */ }
    router.replace(dest);
  }, [token, sp, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
      <p className="text-sm">Redirecting…</p>
    </main>
  );
}
