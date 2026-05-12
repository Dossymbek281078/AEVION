"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
  tags: string[];
  frontend: string;
  ogImage: string;
  health: string | null;
  openapi: string | null;
  waitlist: string | null;
  status_url: string | null;
  relatedModules: { id: string; name: string; overlap: number }[];
};

type Catalog = {
  total: number;
  filters: { status: string | null; tag: string | null; kind: string | null };
  items: CatalogItem[];
  generatedAt: string;
};

const STATUS_FILTERS = ["", "mvp", "working", "in_progress", "planning", "research", "idea"];
const KIND_FILTERS = ["", "product", "service", "experiment", "infrastructure"];

const STATUS_LABEL: Record<string, string> = {
  "": "Все",
  mvp: "🟢 MVP",
  working: "🟢 Working v1",
  in_progress: "🟡 In progress",
  planning: "🔵 Planning",
  research: "🟣 Research",
  idea: "⚪ Idea",
};

const KIND_LABEL: Record<string, string> = {
  "": "Все",
  product: "Продукт",
  service: "Сервис",
  experiment: "Эксперимент",
  infrastructure: "Инфраструктура",
};

const STATUS_PILL_CLASS: Record<string, string> = {
  mvp: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  working: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  in_progress: "bg-amber-900/60 text-amber-300 border-amber-700",
  planning: "bg-sky-900/60 text-sky-300 border-sky-700",
  research: "bg-violet-900/60 text-violet-300 border-violet-700",
  idea: "bg-slate-800 text-slate-400 border-slate-700",
};

function ModuleCard({ item }: { item: CatalogItem }) {
  const statusClass = STATUS_PILL_CLASS[item.status] ?? STATUS_PILL_CLASS.idea;
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-5 space-y-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{item.name}</h3>
          <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            {item.code} · {item.kind}
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase border ${statusClass}`}>
          {item.status}
        </span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{item.description}</p>
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 5).map((t) => (
            <span key={t} className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={item.frontend.replace(/^https?:\/\/[^/]+/, "")} className="text-cyan-400 hover:underline">
          → Open page
        </Link>
        {item.openapi && (
          <a href={item.openapi} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
            OpenAPI
          </a>
        )}
        {item.status_url && (
          <a href={item.status_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
            Live status
          </a>
        )}
      </div>
      {item.relatedModules && item.relatedModules.length > 0 && (
        <div className="pt-2 border-t border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Related (tag overlap)
          </div>
          <div className="flex flex-wrap gap-1">
            {item.relatedModules.map((r) => (
              <Link
                key={r.id}
                href={`/${r.id}`}
                className="text-[11px] bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-300 px-2 py-0.5 rounded"
              >
                {r.name.replace(/^AEVION\s/, "")} <span className="text-slate-600">·{r.overlap}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FintechCatalogPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterKind) params.set("kind", filterKind);
      if (filterTag) params.set("tag", filterTag);
      const q = params.toString();
      const r = await fetch(apiUrl(`/api/aevion/catalog${q ? `?${q}` : ""}`));
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      setCatalog(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterKind, filterTag]);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => {
    if (!catalog) return [] as string[];
    const set = new Set<string>();
    for (const item of catalog.items) {
      for (const t of item.tags ?? []) set.add(String(t).toLowerCase());
    }
    return Array.from(set).sort();
  }, [catalog]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "AEVION Module Catalog",
            applicationCategory: "BusinessApplication",
            description: "Live, filterable catalog of all AEVION ecosystem modules with status, tags, OpenAPI specs, and auto-derived related modules.",
            url: "https://aevion.app/fintech/catalog",
          }),
        }}
      />

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← AEVION</Link>
          <span className="text-slate-600">·</span>
          <Link href="/fintech" className="text-slate-400 hover:text-white text-sm">Fintech</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">Catalog</h1>
          <span className="text-[10px] bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded-full">LIVE</span>
        </div>
        <a
          href="https://api.aevion.app/api/aevion/catalog"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-slate-400 hover:text-white font-mono"
        >
          GET /api/aevion/catalog →
        </a>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10 space-y-4">
        <div className="space-y-2">
          <div className="inline-block px-3 py-1 bg-cyan-900/40 border border-cyan-800 rounded-full text-xs text-cyan-300 font-semibold uppercase tracking-wider">
            Live catalog · /api/aevion/catalog
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Все модули AEVION{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              в одном API.
            </span>
          </h1>
          <p className="text-base text-slate-400 max-w-2xl">
            Эта страница — live-витрина endpoint <code className="text-cyan-300 font-mono">/api/aevion/catalog</code>. Каждый
            модуль — со ссылкой на frontend, OpenAPI spec, health-probe, status URL и связанными модулями (по tag overlap).
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end bg-slate-900 border border-slate-800 rounded-xl p-4">
          <label className="block text-sm flex-1 min-w-[180px]">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm flex-1 min-w-[180px]">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Kind</span>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
            >
              {KIND_FILTERS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm flex-1 min-w-[180px]">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Tag</span>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
            >
              <option value="">Все</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { setFilterStatus(""); setFilterKind(""); setFilterTag(""); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm self-end"
          >
            Сбросить
          </button>
        </div>

        <div className="text-sm text-slate-500">
          {loading && "Загрузка каталога…"}
          {!loading && catalog && (
            <>
              Показано <span className="text-white font-semibold">{catalog.items.length}</span> из{" "}
              <span className="text-white font-semibold">{catalog.total}</span> модулей
              {catalog.generatedAt && (
                <span className="text-slate-600"> · сгенерировано {new Date(catalog.generatedAt).toLocaleTimeString("ru")}</span>
              )}
            </>
          )}
          {err && <span className="text-red-400">Ошибка: {err}</span>}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        {catalog && catalog.items.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            Нет модулей под этот фильтр.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {catalog?.items.map((item) => (
            <ModuleCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12 border-t border-slate-800 space-y-4">
        <h2 className="text-2xl font-bold">Использовать в своём приложении</h2>
        <pre className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm font-mono overflow-x-auto">
{`// Get all MVP modules tagged "ai"
const r = await fetch("https://api.aevion.app/api/aevion/catalog?status=mvp&tag=ai");
const { items } = await r.json();

// Each item has: id, name, frontend URL, ogImage, openapi spec,
// health probe URL, waitlist endpoint, related modules (by tag overlap).
items.forEach(m => console.log(m.name, m.frontend, m.relatedModules));`}
        </pre>
        <p className="text-sm text-slate-500">
          Cache-Control: public, max-age=120. Filters: <code className="text-cyan-300">?status</code>, <code className="text-cyan-300">?kind</code>, <code className="text-cyan-300">?tag</code> (comma-separated).
        </p>
      </section>
    </div>
  );
}
