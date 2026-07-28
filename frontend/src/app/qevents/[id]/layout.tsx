import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { getSiteUrl } from "@/lib/siteUrl";

// Заголовок, описание и разметка Schema.org для страницы одного события.
// Сама страница — клиентская (RSVP, календарь), поэтому метаданные живут здесь,
// в серверном слое: только так их видят поисковик и превью ссылки. Устроено по
// образцу `qstore/[id]/layout.tsx`, чтобы не заводить второй способ делать то же.

type QEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string;
  startAt: string;
  endAt: string | null;
  capacity: number;
  price: number;
  attendeeCount: number;
};

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function loadEvent(id: string): Promise<QEvent | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/qevents/events/${encodeURIComponent(id)}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { event?: QEvent };
    return json.event ?? null;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const SITE = getSiteUrl();
  const canonical = `${SITE}/qevents/${encodeURIComponent(id)}`;

  const fallback: Metadata = {
    title: "Event — AEVION QEvents",
    description:
      "Event in the AEVION ecosystem: date, place, price and seats left. RSVP in one click or add it to your calendar.",
    alternates: { canonical },
    openGraph: { type: "website", title: "Event — AEVION QEvents", url: canonical, siteName: "AEVION" },
  };

  const event = await loadEvent(id);
  if (!event) return fallback;

  const when = dayLabel(event.startAt);
  const title = clip(`${event.title} — ${when}, ${event.location}`, 60);
  const description = clip(
    event.description ||
      `${event.category} event on ${when} at ${event.location}. ${
        event.price === 0 ? "Free entry" : `$${event.price}`
      }, ${Math.max(0, event.capacity - event.attendeeCount)} seats left.`,
    158,
  );

  return {
    title,
    description,
    alternates: { canonical },
    keywords: ["AEVION", "QEvents", event.category, event.location].filter(Boolean),
    openGraph: { type: "website", title, description, url: canonical, siteName: "AEVION" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function QEventDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const SITE = getSiteUrl();
  const event = await loadEvent(id);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
      { "@type": "ListItem", position: 2, name: "QEvents", item: `${SITE}/qevents` },
      {
        "@type": "ListItem",
        position: 3,
        name: event?.title || "Event",
        item: `${SITE}/qevents/${encodeURIComponent(id)}`,
      },
    ],
  };

  // Разметку события отдаём, только когда событие действительно нашлось:
  // выдуманный `Event` без даты и места — это ложное описание, а не «пустая
  // карточка», и поисковик считает его ошибкой.
  const eventJsonLd = event
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        "@id": `${SITE}/qevents/${encodeURIComponent(event.id)}`,
        name: event.title,
        description: event.description || `${event.category} event on AEVION QEvents.`,
        startDate: event.startAt,
        endDate: event.endAt || undefined,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: { "@type": "Place", name: event.location, address: event.location },
        organizer: { "@type": "Organization", name: "AEVION QEvents", url: `${SITE}/qevents` },
        offers: {
          "@type": "Offer",
          price: event.price.toFixed(2),
          priceCurrency: "USD",
          availability:
            event.attendeeCount < event.capacity
              ? "https://schema.org/InStock"
              : "https://schema.org/SoldOut",
          url: `${SITE}/qevents/${encodeURIComponent(event.id)}`,
        },
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {eventJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
