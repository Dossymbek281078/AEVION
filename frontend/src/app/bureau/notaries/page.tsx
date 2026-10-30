import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import { getServerLang } from "@/lib/i18n-server";
import { tNot } from "./notariesText";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notary Registry — AEVION IP Bureau",
  description: "Verified notarial partners who co-sign IP certificates with Ed25519 digital signatures.",
  // СВОЙ canonical: без него страница наследует адрес раздела из его макета
  // и просит поисковик показывать раздел вместо себя. Замер живого прода
  // 30.08.2026 — так вели себя 78 страниц сайта.
  alternates: { canonical: "/bureau/notaries" },
};

type Notary = {
  id: string;
  fullName: string;
  licenseNumber: string;
  jurisdiction: string;
  city: string | null;
  publicKeyFingerprint: string;
  contractSignedAt: string | null;
  createdAt: string;
};

async function loadNotaries(jurisdiction?: string): Promise<Notary[]> {
  try {
    const url = new URL(`${getApiBase()}/api/bureau/notaries`);
    if (jurisdiction) url.searchParams.set("jurisdiction", jurisdiction);
    const r = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { notaries?: Notary[] };
    return j.notaries ?? [];
  } catch {
    return [];
  }
}

const JURISDICTION_LABELS: Record<string, string> = {
  KZ: "Kazakhstan",
  EU: "European Union",
  US: "United States",
  RU: "Russia",
  UA: "Ukraine",
  GB: "United Kingdom",
};

function jLabel(j: string, lang = "en"): string {
  return tNot(lang, JURISDICTION_LABELS[j] || j);
}

type SearchParamsRaw = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParamsRaw> };

export default async function NotaryRegistryPage({ searchParams }: Props) {
  const sp: SearchParamsRaw = searchParams ? await searchParams : {};
  const jurisdiction = typeof sp.jurisdiction === "string" ? sp.jurisdiction : undefined;
  const [notaries, lang] = await Promise.all([loadNotaries(jurisdiction), getServerLang()]);
  const t = (en: string) => tNot(lang, en);

  const jurisdictions = Array.from(new Set(notaries.map((n) => n.jurisdiction)));

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs text-teal-700 uppercase tracking-widest mb-3">AEVION IP Bureau</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">{t("Notary Registry")}</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {t("AEVION-vetted notarial partners who co-sign IP certificates with Ed25519 digital signatures.")}{" "}
            {t("A Notarized badge means a licensed notary has independently verified the authorship claim.")}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">

        {/* Jurisdiction filter */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bureau/notaries"
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!jurisdiction ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300"}`}
          >
            {t("All")}
          </Link>
          {jurisdictions.map((j) => (
            <Link
              key={j}
              href={`/bureau/notaries?jurisdiction=${j}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${jurisdiction === j ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300"}`}
            >
              {jLabel(j, lang)}
            </Link>
          ))}
        </div>

        {/* Notary list */}
        {notaries.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-5xl mb-4">🏛️</div>
            <p className="text-lg font-medium text-slate-500">{t("No notaries found")}</p>
            <p className="text-sm mt-2">
              {jurisdiction ? `${t("No active notaries in")} ${jLabel(jurisdiction, lang)}.` : t("The notary registry is empty. Check back soon.")}
            </p>
            <Link href="/bureau" className="mt-6 inline-block text-teal-700 underline text-sm">{t("← Bureau")}</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {notaries.map((n) => (
              <div key={n.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-xl shrink-0">
                  ⚖️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{n.fullName}</h3>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-50/50 text-emerald-700 border border-emerald-200">
                      {t("Active")}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <div>{t("License:")} <span className="font-mono text-slate-500">{n.licenseNumber}</span></div>
                    <div>
                      {jLabel(n.jurisdiction)}{n.city ? `, ${n.city}` : ""}
                      {n.contractSignedAt && (
                        <span className="ml-2 text-slate-600">· {t("Partner since")} {new Date(n.contractSignedAt).getFullYear()}</span>
                      )}
                    </div>
                    <div className="font-mono text-slate-600 truncate">
                      {t("Key fingerprint:")} {n.publicKeyFingerprint}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/bureau/notaries/${n.id}`}
                  className="shrink-0 text-xs text-teal-700 hover:text-teal-700 transition-colors border border-teal-200 hover:border-teal-300 rounded-lg px-3 py-1.5"
                >
                  {t("View public key →")}
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="bg-white/50 rounded-xl border border-slate-200 p-5 text-sm text-slate-500 space-y-2">
          <h2 className="font-semibold text-slate-700">{t("How Notarized tier works")}</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-500">
            <li>{t("Your certificate must first reach")} <span translate="no" className="notranslate text-teal-700 font-medium">Verified</span> {t("tier (KYC + payment).")}</li>
            <li>{t("Submit a notarization request, selecting a partner notary.")}</li>
            <li>{t("The notary independently verifies your authorship claim and co-signs with Ed25519.")}</li>
            <li>{t("Your certificate badge upgrades to")} <span translate="no" className="notranslate text-violet-700 font-medium">Notarized</span> {t("with a permanent registry reference.")}</li>
          </ol>
          <p className="text-xs text-slate-600 pt-2">
            {t("Third parties can verify the notary signature offline using the notary's public Ed25519 key listed above.")}
          </p>
        </div>

        <div className="text-center">
          <Link href="/bureau" className="text-teal-700 underline text-sm">{t("← Back to Bureau")}</Link>
        </div>
      </div>
    </div>
  );
}
