import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { getSiteUrl } from "@/lib/siteUrl";

// Заголовок, описание и разметка Schema.org для страницы одной вакансии.
// Сама страница клиентская (отклик), поэтому метаданные живут в серверном слое —
// иначе их не увидят ни поисковик, ни превью ссылки. По образцу
// `qstore/[id]/layout.tsx`, чтобы не заводить второй способ делать то же.

type Job = {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  type: string;
  salary: string | null;
  skills: string[];
  isActive: boolean;
  createdAt: string;
};

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function loadJob(id: string): Promise<Job | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/qjobs/jobs/${encodeURIComponent(id)}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { job?: Job };
    return json.job ?? null;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const SITE = getSiteUrl();
  const canonical = `${SITE}/qjobs/${encodeURIComponent(id)}`;

  const fallback: Metadata = {
    title: "Job — AEVION QJobs",
    description:
      "Open role in the AEVION ecosystem: company, location, employment type and salary. Apply in one step.",
    alternates: { canonical },
    openGraph: { type: "website", title: "Job — AEVION QJobs", url: canonical, siteName: "AEVION" },
  };

  const job = await loadJob(id);
  if (!job) return fallback;

  const title = clip(`${job.title} — ${job.company}, ${job.location}`, 60);
  const description = clip(
    job.description || `${job.type} role at ${job.company}, ${job.location}.${job.salary ? ` ${job.salary}.` : ""}`,
    158,
  );

  return {
    title,
    description,
    alternates: { canonical },
    keywords: ["AEVION", "QJobs", job.company, job.location, job.type, ...(job.skills || []).slice(0, 8)].filter(Boolean),
    openGraph: { type: "website", title, description, url: canonical, siteName: "AEVION" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function QJobDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const SITE = getSiteUrl();
  const job = await loadJob(id);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
      { "@type": "ListItem", position: 2, name: "QJobs", item: `${SITE}/qjobs` },
      {
        "@type": "ListItem",
        position: 3,
        name: job?.title || "Job",
        item: `${SITE}/qjobs/${encodeURIComponent(id)}`,
      },
    ],
  };

  // `JobPosting` отдаём только для ОТКРЫТОЙ вакансии: закрытая вакансия с
  // разметкой действующей — прямое нарушение правил поисковика, а не мелочь.
  const jobJsonLd =
    job && job.isActive
      ? {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "@id": `${SITE}/qjobs/${encodeURIComponent(job.id)}`,
          title: job.title,
          description: job.description || `${job.type} role at ${job.company}.`,
          datePosted: job.createdAt,
          employmentType: (job.type || "").toUpperCase().replace(/-/g, "_"),
          hiringOrganization: { "@type": "Organization", name: job.company },
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: job.location },
          },
          skills: (job.skills || []).join(", ") || undefined,
          directApply: true,
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {jobJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobJsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
