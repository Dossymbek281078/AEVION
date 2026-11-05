// /agency/demo/<slug> — личное демо для одной компании. Закрыто от поиска; ничего не отправляется.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTracking } from "@/components/PageTracking";
import { DemoView } from "./DemoView";
import { DEMOS } from "./demos";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DEMOS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = DEMOS.find((x) => x.slug === slug);
  return {
    title: d ? "Демо для «" + d.company + "» (не официальный сайт) — AEVION Automation" : "Демо — AEVION Automation",
    robots: { index: false, follow: false },
  };
}

export default async function AgencyDemoPage({ params }: Props) {
  const { slug } = await params;
  const demo = DEMOS.find((x) => x.slug === slug);
  if (!demo) notFound();
  return (
    <>
      <PageTracking page={"agency-demo-" + demo.n} />
      <DemoView demo={demo} />
    </>
  );
}
