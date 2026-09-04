"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  classify,
  computeMetrics,
  DEFAULT_SLIDERS,
  SLIDER_META,
  type Sliders,
} from "@/lib/constitution";
import { repoPath } from "@/lib/repoUrl";

type Tab = "curl" | "ts" | "py";

const ENDPOINTS = [
  { method: "GET",    path: "/api/constitution/public/regimes",                     titleKey: "constitution.api.ep.regimes",           cached: true },
  { method: "GET",    path: "/api/constitution/public/presets",                     titleKey: "constitution.api.ep.presets",           cached: true },
  { method: "GET",    path: "/api/constitution/public/countries",                   titleKey: "constitution.api.ep.countries",         cached: true },
  { method: "GET",    path: "/api/constitution/public/sliders-spec",                titleKey: "constitution.api.ep.slidersSpec",       cached: true },
  { method: "POST",   path: "/api/constitution/scenarios",                          titleKey: "constitution.api.ep.scenariosSave",     cached: false },
  { method: "GET",    path: "/api/constitution/scenarios?limit=20",                 titleKey: "constitution.api.ep.scenariosList",     cached: false },
  { method: "POST",   path: "/api/constitution/ai-suggest",                         titleKey: "constitution.api.ep.aiSuggest",         cached: false },
  { method: "POST",   path: "/api/constitution/ai-suggest-stream",                  titleKey: "constitution.api.ep.aiSuggestStream",   cached: false },
  { method: "POST",   path: "/api/constitution/pdf",                                titleKey: "constitution.api.ep.pdf",               cached: false },
  { method: "GET",    path: "/api/constitution/me/plan",                            titleKey: "constitution.api.ep.mePlan",            cached: false },
  { method: "POST",   path: "/api/planet/constitution-artifacts",                   titleKey: "constitution.api.ep.artifactsPublish",  cached: false },
  { method: "GET",    path: "/api/planet/constitution-artifacts?regime=open-access",titleKey: "constitution.api.ep.artifactsList",     cached: false },
  { method: "GET",    path: "/api/planet/constitution-artifacts/:id",               titleKey: "constitution.api.ep.artifactById",      cached: false },
  { method: "GET",    path: "/api/planet/constitution-artifacts/:id/similar",       titleKey: "constitution.api.ep.artifactsSimilar",  cached: false },
  { method: "GET",    path: "/api/planet/constitution-artifacts/stats",             titleKey: "constitution.api.ep.artifactsStats",    cached: false },
  { method: "POST",   path: "/api/planet/constitution-artifacts/:id/vote",          titleKey: "constitution.api.ep.artifactVote",      cached: false },
  { method: "DELETE", path: "/api/planet/constitution-artifacts/:id/vote",          titleKey: "constitution.api.ep.artifactVoteRemove",cached: false },
  { method: "POST",   path: "/api/planet/constitution-artifacts/:id/comment",       titleKey: "constitution.api.ep.artifactComment",   cached: false },
  { method: "GET",    path: "/api/planet/constitution-artifacts/:id/social",        titleKey: "constitution.api.ep.artifactSocial",    cached: false },
];

const BASE_URL_PUBLIC = "https://aevion.app/api-backend";

export default function ConstitutionApiPlaygroundPage() {
  const { t } = useI18n();
  const [sliders, setSliders] = useState<Sliders>(DEFAULT_SLIDERS);
  const [title, setTitle] = useState<string>("My-Scenario");
  const [tab, setTab] = useState<Tab>("curl");
  const [response, setResponse] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const metrics = useMemo(() => computeMetrics(sliders), [sliders]);
  const regime = useMemo(() => classify(sliders), [sliders]);

  const body = useMemo(
    () => ({
      title,
      sliders,
      regime: regime.name,
      metrics,
      tags: ["governance"],
    }),
    [title, sliders, regime, metrics],
  );

  const curlCode = useMemo(
    () =>
      `curl -X POST ${BASE_URL_PUBLIC}/api/constitution/scenarios \\\n` +
      `  -H 'Content-Type: application/json' \\\n` +
      `  -d '${JSON.stringify(body)}'`,
    [body],
  );

  const tsCode = useMemo(
    () =>
      `// TypeScript / fetch\n` +
      `const r = await fetch("${BASE_URL_PUBLIC}/api/constitution/scenarios", {\n` +
      `  method: "POST",\n` +
      `  headers: { "Content-Type": "application/json" },\n` +
      `  body: JSON.stringify(${JSON.stringify(body, null, 2)}),\n` +
      `});\n` +
      `const item = await r.json();\n` +
      `console.log(item.id);`,
    [body],
  );

  const pyCode = useMemo(
    () =>
      `# Python / requests\n` +
      `import requests, json\n` +
      `\n` +
      `r = requests.post(\n` +
      `    "${BASE_URL_PUBLIC}/api/constitution/scenarios",\n` +
      `    json=${JSON.stringify(body, null, 2).split("\n").join("\n    ")},\n` +
      `)\n` +
      `print(r.json()["id"])`,
    [body],
  );

  const code = tab === "curl" ? curlCode : tab === "ts" ? tsCode : pyCode;

  const tryNow = useCallback(async () => {
    setBusy(true);
    setResponse(null);
    try {
      const r = await fetch("/api-backend/api/constitution/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err) {
      setResponse(`ERROR: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }, [body]);

  const tryGet = useCallback(async (path: string) => {
    setBusy(true);
    setResponse(null);
    try {
      const r = await fetch(`/api-backend${path}`);
      const text = await r.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2).slice(0, 8000));
      } catch {
        setResponse(text.slice(0, 8000));
      }
    } catch (err) {
      setResponse(`ERROR: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const copy = () => {
    try {
      void navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            Constitution — Developer Playground
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">
            {t("constitution.api.intro")}
          </p>
          <div className="mt-3 text-xs">
            <a
              href={repoPath("blob/main/docs/constitution-public-api.md")}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 hover:underline"
            >
              {t("constitution.api.docsLink")}
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-[#f5d27a] mb-3">
              {t("constitution.api.requestBodyHeading")}
            </h2>
            <div className="mb-3">
              <label className="text-xs text-[#9aa3c0]">title</label>
              <input
                aria-label="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full bg-[#050a1a] border border-[#d4af37]/30 rounded px-3 py-2 text-sm font-mono mt-1"
              />
            </div>
            <div className="space-y-2">
              {SLIDER_META.map((m) => {
                const val = sliders[m.key];
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="w-44 text-xs">
                      <code className="text-cyan-300">{m.key}</code>
                    </div>
                    <input
                      aria-label={`${m.key}: ${m.label}`}
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) =>
                        setSliders((s) => ({ ...s, [m.key]: Number(e.target.value) }))
                      }
                      className="flex-1 accent-[#d4af37]"
                    />
                    <span className="w-10 text-right text-[#d4af37] font-mono text-sm">
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-[#d4af37]/15 text-xs text-[#9aa3c0]">
              Auto-classified regime:{" "}
              <span className="text-[#f5d27a] font-semibold">{regime.name}</span>{" "}
              · id <code className="text-cyan-300">{regime.id}</code>
            </div>
          </div>

          <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-[#f5d27a]">
                {t("constitution.api.requestCodeHeading")}
              </h2>
              <div className="flex gap-1">
                {(["curl", "ts", "py"] as Tab[]).map((tab_) => (
                  <button
                    key={tab_}
                    type="button"
                    onClick={() => setTab(tab_)}
                    className={`px-3 py-1 rounded text-xs ${
                      tab === tab_
                        ? "bg-[#d4af37] text-[#0b1736] font-bold"
                        : "border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
                    }`}
                  >
                    {tab_ === "curl" ? "cURL" : tab_ === "ts" ? "TypeScript" : "Python"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={copy}
                  className="ml-2 px-3 py-1 rounded text-xs border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10"
                  title={t("constitution.api.copyTitle")}
                  aria-label={t("constitution.api.copyTitle")}
                >
                  📋
                </button>
              </div>
            </div>
            <pre className="bg-[#050a1a] border border-[#d4af37]/15 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre">
              {code}
            </pre>
            <div className="flex justify-between items-center mt-3">
              <div className="text-xs text-[#9aa3c0]">
                Base: <code>{BASE_URL_PUBLIC}</code>
              </div>
              <button
                type="button"
                onClick={tryNow}
                disabled={busy}
                className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold text-sm hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "..." : "Try now →"}
              </button>
            </div>
          </div>
        </div>

        {response && (
          <section className="bg-[#0b1736]/60 border border-cyan-400/30 rounded-xl p-5 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-cyan-300">Response</h3>
              <button
                type="button"
                onClick={() => setResponse(null)}
                className="text-xs text-[#9aa3c0] hover:underline"
              >
                {t("constitution.api.closeBtn")}
              </button>
            </div>
            <pre className="bg-[#050a1a] border border-cyan-400/20 rounded p-3 text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
              {response}
            </pre>
          </section>
        )}

        <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-[#f5d27a] mb-3">
            {t("constitution.api.endpointsCatalogHeading", { count: ENDPOINTS.length })}
          </h2>
          <div className="space-y-1">
            {ENDPOINTS.map((ep, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-1.5 border-b border-[#d4af37]/10 last:border-b-0 flex-wrap"
              >
                <span
                  className={`w-16 text-xs font-mono font-bold text-center px-2 py-0.5 rounded ${
                    ep.method === "GET"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : ep.method === "POST"
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {ep.method}
                </span>
                <code className="flex-1 min-w-0 text-xs truncate">{ep.path}</code>
                <span className="text-xs text-[#9aa3c0] hidden md:block truncate max-w-[260px]">
                  {t(ep.titleKey)}
                </span>
                {ep.cached && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[#d4af37]">
                    1h cache
                  </span>
                )}
                {ep.method === "GET" && !ep.path.includes(":id") && (
                  <button
                    type="button"
                    onClick={() => tryGet(ep.path)}
                    className="text-xs px-2 py-0.5 rounded border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10"
                  >
                    Try
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-8 text-xs text-[#9aa3c0] max-w-3xl">
          <p>
            {t("constitution.api.footerPre")}{" "}
            <a
              href={repoPath("blob/main/docs/constitution-public-api.md")}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 hover:underline"
            >
              docs/constitution-public-api.md
            </a>
            {t("constitution.api.footerPost")}
          </p>
        </footer>
      </div>
    </div>
  );
}
