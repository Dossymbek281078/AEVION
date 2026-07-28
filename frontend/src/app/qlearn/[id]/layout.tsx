import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { getSiteUrl } from "@/lib/siteUrl";

// Заголовок, описание и разметка Schema.org для страницы одного курса.
// Сама страница клиентская (запись на курс), поэтому метаданные живут в
// серверном слое — иначе их не увидят ни поисковик, ни превью ссылки.
// По образцу `qstore/[id]/layout.tsx`.

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  price: number;
  enrollmentCount: number;
};

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function loadCourse(id: string): Promise<{ course: Course; lessons: number } | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/qlearn/courses/${encodeURIComponent(id)}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { course?: Course; lessons?: unknown[] };
    if (!json.course) return null;
    return { course: json.course, lessons: Array.isArray(json.lessons) ? json.lessons.length : 0 };
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
  const canonical = `${SITE}/qlearn/${encodeURIComponent(id)}`;

  const fallback: Metadata = {
    title: "Course — AEVION QLearn",
    description:
      "Course in the AEVION ecosystem: syllabus, level, price and number of students. Enroll in one step.",
    alternates: { canonical },
    openGraph: { type: "website", title: "Course — AEVION QLearn", url: canonical, siteName: "AEVION" },
  };

  const loaded = await loadCourse(id);
  if (!loaded) return fallback;
  const { course, lessons } = loaded;

  const title = clip(`${course.title} — ${course.level} course on AEVION QLearn`, 60);
  const description = clip(
    course.description ||
      `${course.level} ${course.category} course${lessons ? `, ${lessons} lessons` : ""}. ${
        course.price === 0 ? "Free" : `$${course.price}`
      }, ${course.enrollmentCount} enrolled.`,
    158,
  );

  return {
    title,
    description,
    alternates: { canonical },
    keywords: ["AEVION", "QLearn", "online course", course.category, course.level].filter(Boolean),
    openGraph: { type: "website", title, description, url: canonical, siteName: "AEVION" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function QLearnCourseLayout({ params, children }: Props) {
  const { id } = await params;
  const SITE = getSiteUrl();
  const loaded = await loadCourse(id);
  const course = loaded?.course ?? null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
      { "@type": "ListItem", position: 2, name: "QLearn", item: `${SITE}/qlearn` },
      {
        "@type": "ListItem",
        position: 3,
        name: course?.title || "Course",
        item: `${SITE}/qlearn/${encodeURIComponent(id)}`,
      },
    ],
  };

  const courseJsonLd = course
    ? {
        "@context": "https://schema.org",
        "@type": "Course",
        "@id": `${SITE}/qlearn/${encodeURIComponent(course.id)}`,
        name: course.title,
        description: course.description || `${course.level} ${course.category} course on AEVION QLearn.`,
        provider: { "@type": "Organization", name: "AEVION QLearn", url: `${SITE}/qlearn` },
        educationalLevel: course.level,
        offers: {
          "@type": "Offer",
          price: course.price.toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `${SITE}/qlearn/${encodeURIComponent(course.id)}`,
        },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          courseWorkload: loaded && loaded.lessons > 0 ? `PT${loaded.lessons}H` : undefined,
        },
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {courseJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
