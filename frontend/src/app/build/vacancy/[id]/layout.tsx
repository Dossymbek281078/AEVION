import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

async function fetchVacancy(id: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/vacancies/${encodeURIComponent(id)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.data as { title: string; description: string; salary: number } | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const v = await fetchVacancy(id);
  const title = v?.title ?? "Vacancy";
  const salary = v?.salary ? ` · $${v.salary.toLocaleString()}` : "";
  const desc = v?.description
    ? `${v.description.slice(0, 140)}…`
    : "Apply for this vacancy on AEVION QBuild — construction recruiting platform.";

  return {
    title: `${title}${salary} — AEVION QBuild`,
    description: desc,
    openGraph: {
      title: `${title}${salary}`,
      description: desc,
      type: "website",
      siteName: "AEVION QBuild",
    },
    twitter: { card: "summary", title: `${title}${salary}`, description: desc },
  };
}

export default function VacancyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
