import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

type VacancyMeta = {
  id: string;
  title: string;
  description: string;
  salary: number;
  salaryCurrency?: string | null;
  city?: string | null;
  status?: string;
  createdAt?: string;
  expiresAt?: string | null;
  skills?: string[];
  projectTitle?: string;
};

async function fetchVacancy(id: string): Promise<VacancyMeta | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/vacancies/${encodeURIComponent(id)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return (j?.data as VacancyMeta) ?? null;
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

// Schema.org JobPosting JSON-LD — required shape for Google Jobs ingestion.
// We emit it from the layout (server) so crawlers see it without JS, then
// the page itself can re-render the same data interactively.
function buildJobPostingJsonLd(v: VacancyMeta) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: v.title,
    description: v.description,
    datePosted: v.createdAt || new Date().toISOString(),
    employmentType: "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: v.projectTitle || "AEVION QBuild",
      sameAs: "https://aevion.com/build",
    },
    directApply: true,
  };
  if (v.expiresAt) jsonLd.validThrough = v.expiresAt;
  if (v.salary && v.salary > 0) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: v.salaryCurrency || "USD",
      value: { "@type": "QuantitativeValue", value: v.salary, unitText: "MONTH" },
    };
  }
  if (v.city) {
    jsonLd.jobLocation = {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: v.city },
    };
  } else {
    // Required when no physical location — flag as remote.
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = {
      "@type": "Country",
      name: "Worldwide",
    };
  }
  if (v.skills && v.skills.length > 0) {
    jsonLd.skills = v.skills.join(", ");
  }
  return jsonLd;
}

export default async function VacancyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = await fetchVacancy(id);
  if (!v || v.status === "CLOSED") return <>{children}</>;
  const jsonLd = buildJobPostingJsonLd(v);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
