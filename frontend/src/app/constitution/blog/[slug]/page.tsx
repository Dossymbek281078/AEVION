import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPost, listPosts, type BlogBlock } from "@/lib/constitution-blog";
import { ConstitutionEmbed } from "@/components/ConstitutionEmbed";
import { getServerT } from "@/lib/i18n-server";
import { ConstitutionFunnelPing } from "@/components/ConstitutionFunnelPing";
import {
  classify,
  countryByCode,
  DEFAULT_SLIDERS,
  PRESETS,
  type Sliders,
} from "@/lib/constitution";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) return { title: "Post not found · AEVION Constitution Blog" };
  return {
    title: `${post.title} · Constitution Blog · AEVION`,
    description: post.excerpt,
    alternates: { canonical: `${SITE}/constitution/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${SITE}/constitution/blog/${slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

export async function generateStaticParams() {
  return listPosts().map((p) => ({ slug: p.slug }));
}

function presetByName(name: string): Sliders {
  const norm = name.toLowerCase().replace(/[\s_-]+/g, "");
  const hit = PRESETS.find((p) => p.name.toLowerCase().replace(/[\s_-]+/g, "").includes(norm));
  return hit?.sliders ?? DEFAULT_SLIDERS;
}

function renderBlock(block: BlogBlock, idx: number) {
  if (block.kind === "p") {
    return <p key={idx} className="text-[#e7ecf8] leading-relaxed mb-4">{block.text}</p>;
  }
  if (block.kind === "h2") {
    return <h2 key={idx} className="text-xl font-bold text-[#f5d27a] mt-6 mb-3">{block.text}</h2>;
  }
  if (block.kind === "h3") {
    return <h3 key={idx} className="text-lg font-semibold text-[#d4af37] mt-4 mb-2">{block.text}</h3>;
  }
  if (block.kind === "quote") {
    return (
      <blockquote key={idx} className="border-l-4 border-[#d4af37]/40 pl-4 my-5 italic text-[#9aa3c0]">
        "{block.text}"
        {block.cite && <div className="text-xs text-[#9aa3c0]/70 mt-1 not-italic">— {block.cite}</div>}
      </blockquote>
    );
  }
  if (block.kind === "li") {
    return (
      <ul key={idx} className="list-disc list-inside text-[#e7ecf8] space-y-1 my-4 pl-2">
        {block.items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    );
  }
  if (block.kind === "embed-preset") {
    const sliders = presetByName(block.preset);
    return (
      <div key={idx} className="my-5 flex justify-center">
        <ConstitutionEmbed sliders={sliders} label={block.label ?? block.preset} size="md" />
      </div>
    );
  }
  if (block.kind === "embed-country") {
    const cc = countryByCode(block.code);
    if (!cc) return null;
    return (
      <div key={idx} className="my-5 flex justify-center">
        <ConstitutionEmbed sliders={cc.sliders} label={`${cc.flag} ${cc.name}`} size="md" />
      </div>
    );
  }
  if (block.kind === "embed-sliders") {
    return (
      <div key={idx} className="my-5 flex justify-center">
        <ConstitutionEmbed sliders={block.sliders} label={block.label} size="md" />
      </div>
    );
  }
  if (block.kind === "regime") {
    return (
      <div key={idx} className="my-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-sm">
        <span className="text-[#d4af37] font-semibold">{block.id}</span>
        {block.note && <span className="text-[#9aa3c0] text-xs">— {block.note}</span>}
      </div>
    );
  }
  return null;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();
  const { t } = await getServerT();

  const ogSliders = presetByName(post.ogPreset ?? "Open Access");
  const regime = classify(ogSliders);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${SITE}/constitution/blog/${slug}`,
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "AEVION", url: SITE },
    datePublished: post.publishedAt,
    mainEntityOfPage: `${SITE}/constitution/blog/${slug}`,
    keywords: ["constitution", "political economy", regime.id],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }}
      />
      <ConstitutionFunnelPing event="blog_view" props={{ kind: "post", slug }} />
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <Link href="/constitution/blog" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution Blog
          </Link>
          <div className="text-xs text-[#9aa3c0] mt-3 flex flex-wrap gap-2">
            <span>{post.author}</span>
            <span>·</span>
            <span>{new Date(post.publishedAt).toLocaleDateString("ru-RU")}</span>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            {post.title}
          </h1>
          <p className="text-[#9aa3c0] mt-3 italic">{post.excerpt}</p>
        </header>

        <article className="prose-invert max-w-none">
          {post.blocks.map((b, i) => renderBlock(b, i))}
        </article>

        <footer className="mt-10 pt-6 border-t border-[#d4af37]/15 text-sm text-[#9aa3c0]">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <Link href="/constitution" className="text-[#d4af37] hover:underline">
              {t("constitution.blog.post.openSimulator")}
            </Link>
            <Link href="/constitution/learn" className="text-emerald-300 hover:underline">
              {t("constitution.blog.post.takeAcademy")}
            </Link>
            <Link href="/constitution/leaderboard" className="text-cyan-300 hover:underline">
              {t("constitution.blog.post.othersScenarios")}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
