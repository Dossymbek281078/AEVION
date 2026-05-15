// Schema.org BreadcrumbList JSON-LD — emitted into the document so search
// engines can render the path hierarchy in result snippets. Pure function
// component (no hooks, no client APIs) so it works inside server-rendered
// layout.tsx files. Two-deep chain: AEVION Bank → leaf.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app").replace(/\/$/, "");

export function BreadcrumbsJsonLd({ path, name }: { path: string; name: string }) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AEVION Bank", item: `${SITE}/bank` },
      { "@type": "ListItem", position: 2, name, item: `${SITE}${path}` },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
