import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type NotaryDetail = {
  id: string;
  fullName: string;
  licenseNumber: string;
  jurisdiction: string;
  city: string | null;
  publicKeyEd25519: string;
  publicKeyFingerprint: string;
  contractSignedAt: string | null;
  createdAt: string;
  active: boolean;
  deactivatedAt: string | null;
};

/**
 * Три исхода, а не два.
 *
 * `if (!r.ok) return null` уравнивал «такого нотариуса нет» с «мы не смогли
 * спросить», и страница на любой выдуманный id отвечала 200 с полной
 * вёрсткой. Таких id бесконечно много — бесконечный индексируемый мусор,
 * причём на реестре, то есть на доверительной поверхности.
 *
 * 404 ставим ТОЛЬКО по авторитетному ответу сервера: отдать его при
 * временной аварии значит сказать поисковику, что живых страниц нет.
 */
type Loaded =
  | { state: "found"; data: NotaryDetail }
  | { state: "absent" }
  | { state: "unknown" };

async function loadNotary(id: string): Promise<Loaded> {
  try {
    const r = await fetch(`${getApiBase()}/api/bureau/notaries/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 404 || r.status === 410) return { state: "absent" };
    if (!r.ok) return { state: "unknown" };
    return { state: "found", data: (await r.json()) as NotaryDetail };
  } catch {
    return { state: "unknown" };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ notaryId: string }> }): Promise<Metadata> {
  const { notaryId } = await params;
  const zm = await loadNotary(notaryId);
  const n = zm.state === "found" ? zm.data : null;
  return {
    title: n ? `${n.fullName} — AEVION Notary Registry` : "Notary — AEVION IP Bureau",
  };
}

export default async function NotaryDetailPage({ params }: { params: Promise<{ notaryId: string }> }) {
  const { notaryId } = await params;
  const zagruzka = await loadNotary(notaryId);
  // Нотариуса НЕТ — честный 404. Текст ответа переехал в not-found.tsx рядом:
  // это РЕЕСТР, и «такого нет в реестре» — ответ, за которым пришли.
  // При "unknown" (не смогли спросить) остаётся 200 и прежний вид.
  if (zagruzka.state === "absent") notFound();
  const n = zagruzka.state === "found" ? zagruzka.data : null;

  if (!n) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="text-5xl">⚖️</div>
        <p>Notary not found.</p>
        <Link href="/bureau/notaries" className="text-teal-400 underline text-sm">← Notary Registry</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pt-20 pb-24 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-violet-900/40 border border-violet-700 flex items-center justify-center text-2xl">⚖️</div>
          <div>
            <h1 className="text-xl font-bold text-white">{n.fullName}</h1>
            <p className="text-slate-500 text-sm">{n.jurisdiction}{n.city ? `, ${n.city}` : ""}</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h2 className="font-semibold text-slate-200">Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500">License</dt>
            <dd className="font-mono text-slate-300 text-xs">{n.licenseNumber}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${n.active ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700" : "bg-red-900/50 text-red-400 border border-red-700"}`}>
                {n.active ? "Active" : "Inactive"}
              </span>
            </dd>
            {n.contractSignedAt && (
              <>
                <dt className="text-slate-500">Partner since</dt>
                <dd className="text-slate-300">{new Date(n.contractSignedAt).toLocaleDateString()}</dd>
              </>
            )}
            <dt className="text-slate-500">Key fingerprint</dt>
            <dd className="font-mono text-slate-400 text-xs break-all">{n.publicKeyFingerprint}</dd>
          </dl>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-3">
          <h2 className="font-semibold text-slate-200">Ed25519 Public Key</h2>
          <p className="text-xs text-slate-500">
            Use this key to verify notary signatures offline without contacting AEVION.
          </p>
          <pre className="bg-slate-950 rounded-lg p-4 text-xs font-mono text-teal-300 overflow-x-auto break-all whitespace-pre-wrap border border-slate-800">
{`-----BEGIN PUBLIC KEY-----
${n.publicKeyEd25519}
-----END PUBLIC KEY-----`}
          </pre>
          <button
            onClick={() => {
              if (typeof navigator !== "undefined") {
                navigator.clipboard.writeText(n.publicKeyEd25519).catch(() => {});
              }
            }}
            className="text-xs text-slate-400 hover:text-teal-300 transition-colors underline"
          >
            Copy key
          </button>
        </div>

        <Link href="/bureau/notaries" className="inline-block text-teal-400 underline text-sm">
          ← Notary Registry
        </Link>
      </div>
    </div>
  );
}
