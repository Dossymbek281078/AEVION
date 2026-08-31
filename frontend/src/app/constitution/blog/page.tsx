import Link from "next/link";
import type { Metadata } from "next";
import { listPosts } from "@/lib/constitution-blog";
import { getServerT } from "@/lib/i18n-server";
import { ConstitutionFunnelPing } from "@/components/ConstitutionFunnelPing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Constitution Blog — research posts on political economy · AEVION",
  description:
    "Эссе и исследования по конституционному дизайну: почему Норвегия 90 на rule-of-law, эволюция от Magna Carta до Open Access за 8 веков, почему positiveSum — главный ползунок.",
  alternates: { canonical: `${SITE}/constitution/blog` },
  openGraph: {
    title: "Constitution Blog",
    description: "Research-длинноформат от команды AEVION Constitution.",
    url: `${SITE}/constitution/blog`,
    type: "website",
  },
};

export default async function BlogIndexPage() {
  const { t } = await getServerT();
  const posts = listPosts();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <ConstitutionFunnelPing event="blog_view" props={{ kind: "index" }} />
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            Constitution Blog
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-2xl">
            {t("constitution.blog.subtitle")}
          </p>
        </header>

        <section className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/constitution/blog/${post.slug}`}
              className="block bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5 hover:border-[#d4af37]/50 transition"
            >
              <div className="flex items-baseline justify-between text-xs text-[#9aa3c0] mb-2 flex-wrap gap-2">
                <span>
                  {post.author} ·{" "}
                  {new Date(post.publishedAt).toLocaleDateString("ru-RU")}
                </span>
                <span>{post.readMinutes} min read</span>
              </div>
              <h2 className="text-xl font-bold text-[#f5d27a]">{post.title}</h2>
              <p className="text-sm text-[#e7ecf8] mt-2">{post.excerpt}</p>
              <div className="text-[#d4af37] text-xs mt-3 hover:underline">
                {t("constitution.blog.readMore")}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
