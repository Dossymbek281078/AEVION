import type { Metadata } from "next";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";

export const metadata: Metadata = {
  title: "Developers — AEVION QBuild",
  description:
    "Public partner API, embeddable widget, RSS feed and sitemap for the AEVION QBuild recruiting platform.",
  openGraph: {
    title: "AEVION QBuild · Developers",
    description: "Embed open vacancies on your site, subscribe via RSS, or pull data via the partner API.",
  },
};

export default function DevelopersPage() {
  return (
    <BuildShell>
      <div className="prose prose-invert max-w-none">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">QBuild for developers</h1>
          <p className="mt-2 text-sm text-slate-400">
            Three integration paths: drop-in widget, JSON partner API, RSS feed. All read-only,
            served from <code className="rounded bg-white/10 px-1">aevion.tech</code>.
          </p>
        </header>

        <Section title="1 · Drop-in widget" anchor="widget">
          <p className="text-sm text-slate-300">
            Render a styled list of your open vacancies on any HTML page. Zero framework deps,
            single <code className="rounded bg-white/10 px-1">&lt;script&gt;</code> tag.
          </p>
          <Pre>{`<div data-aevion-build
     data-key="qb_pk_..."
     data-limit="6"
     data-city="Astana"
     data-skill="welding"></div>
<script src="https://aevion.tech/api/build/public/widget.js" defer></script>`}</Pre>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            <li><code className="text-slate-300">data-key</code> — required, partner API key (mint at <Link href="/build/admin/partner-keys" className="text-emerald-300 underline">admin → partner keys</Link>)</li>
            <li><code className="text-slate-300">data-limit</code> — max vacancies to render, default 6</li>
            <li><code className="text-slate-300">data-city</code> / <code className="text-slate-300">data-skill</code> — server-side filters</li>
            <li><code className="text-slate-300">data-vacancy-id</code> — render exactly one role</li>
          </ul>
        </Section>

        <Section title="2 · Partner JSON API" anchor="api">
          <p className="text-sm text-slate-300">
            Same data the widget uses, exposed as JSON. Authenticated via{" "}
            <code className="rounded bg-white/10 px-1">X-Build-Key</code> header. CORS allows any origin.
            Rate limit 60 req/min/key.
          </p>
          <Endpoint
            method="GET"
            path="/api/build/public/v1/vacancies"
            desc="Paginated feed of OPEN vacancies. Query: limit, offset, city, skill."
          />
          <Endpoint
            method="GET"
            path="/api/build/public/v1/vacancies/:id"
            desc="Single vacancy detail."
          />
          <Endpoint
            method="GET"
            path="/api/build/public/v1/health"
            desc="Sanity check — returns { status: 'ok', apiVersion: 'v1' }."
          />
          <h3 className="mt-4 text-sm font-semibold text-white">Curl</h3>
          <Pre>{`curl https://aevion.tech/api/build/public/v1/vacancies?limit=10 \\
  -H "X-Build-Key: qb_pk_..."`}</Pre>
          <h3 className="mt-3 text-sm font-semibold text-white">Response shape</h3>
          <Pre>{`{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "title": "Senior welder",
        "description": "...",
        "salary": 800000,
        "salaryCurrency": "RUB",
        "skills": ["welding", "blueprints"],
        "city": "Astana",
        "project": "Tower 7",
        "url": "https://aevion.tech/build/vacancy/...",
        "createdAt": "...",
        "expiresAt": "..."
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}`}</Pre>
        </Section>

        <Section title="3 · RSS feed" anchor="rss">
          <p className="text-sm text-slate-300">
            Subscribe to the latest open vacancies in any RSS reader. No auth required.
          </p>
          <Pre>{`https://aevion.tech/api/build/public/rss/vacancies.xml
https://aevion.tech/api/build/public/rss/vacancies.xml?city=Astana
https://aevion.tech/api/build/public/rss/vacancies.xml?skill=welding`}</Pre>
        </Section>

        <Section title="4 · Sitemap" anchor="sitemap">
          <p className="text-sm text-slate-300">
            Standard XML sitemap covering all open vacancies, projects, top employers and product
            pages. 5 000 URLs cap. Refreshed automatically.
          </p>
          <Pre>{`https://aevion.tech/sitemap.xml`}</Pre>
        </Section>

        <Section title="Auth & limits" anchor="auth">
          <ul className="space-y-1 text-sm text-slate-300">
            <li>Mint a key at <Link href="/build/admin/partner-keys" className="text-emerald-300 underline">/build/admin/partner-keys</Link>. Plaintext shown ONCE.</li>
            <li>Backend stores only <code className="rounded bg-white/10 px-1">sha256(key)</code>.</li>
            <li>60 requests/min per key (also per IP if missing).</li>
            <li>Revoke instantly from the same admin page — revoked keys hard-fail with 401.</li>
          </ul>
        </Section>

        <div className="mt-10 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-emerald-100">
          Need something else (webhooks, applicant push, multi-org)?{" "}
          <Link href="/build/help" className="underline">Get in touch →</Link>
        </div>
      </div>
    </BuildShell>
  );
}

function Section({ title, anchor, children }: { title: string; anchor: string; children: React.ReactNode }) {
  return (
    <section id={anchor} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-2 rounded-md border border-white/5 bg-black/30 p-2 text-xs">
      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono font-bold text-emerald-200">{method}</span>
      <code className="font-mono text-slate-200">{path}</code>
      <span className="text-slate-400">— {desc}</span>
    </div>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 text-[11px] text-slate-200">
      <code>{children}</code>
    </pre>
  );
}
