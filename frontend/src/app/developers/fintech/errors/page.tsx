import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech Error Codes",
  description: "Complete list of error codes returned by AEVION fintech APIs with resolution steps.",
  alternates: { canonical: "https://aevion.app/developers/fintech/errors" },
};

const ERRORS = [
  { code: "auth_required",          status: 401, module: "all",       desc: "Bearer token missing or expired. Re-authenticate.",           resolution: "Refresh token and retry." },
  { code: "key_invalid",            status: 401, module: "all",       desc: "API key is revoked or malformed.",                           resolution: "Generate a new key at /keys." },
  { code: "rate_limited",           status: 429, module: "all",       desc: "Exceeded requests-per-minute for your tier.",                resolution: "Implement exponential backoff; upgrade tier." },
  { code: "key_limit_reached",      status: 429, module: "apiKeys",   desc: "You already have 3 active API keys (Developer tier cap).",   resolution: "Revoke an existing key first." },
  { code: "wallet_not_found",       status: 404, module: "qpaynet",   desc: "Wallet ID does not exist or belongs to another user.",       resolution: "Verify wallet ID from GET /api/qpaynet/wallets." },
  { code: "wallet_inactive",        status: 400, module: "qpaynet",   desc: "Wallet is frozen or deleted.",                               resolution: "Check wallet status; contact support if frozen." },
  { code: "insufficient_balance",   status: 400, module: "qpaynet",   desc: "Not enough funds including 0.1% transfer fee.",             resolution: "Deposit or reduce transfer amount." },
  { code: "request_paid",           status: 400, module: "qpaynet",   desc: "Payment request already fulfilled.",                        resolution: "Create a new payment request." },
  { code: "request_expired",        status: 400, module: "qpaynet",   desc: "Payment request past expiresAt or max views reached.",      resolution: "Create a new request." },
  { code: "cannot_pay_own_request", status: 400, module: "qpaynet",   desc: "Payer wallet == receiver wallet.",                         resolution: "Use a different wallet." },
  { code: "reference_already_written", status: 409, module: "build",  desc: "Employer already wrote a reference for this worker on this project.", resolution: "One reference per (employer, worker, project)." },
  { code: "plan_vacancy_limit_reached", status: 403, module: "build", desc: "QBuild plan vacancy slots exhausted.",                      resolution: "Close existing vacancies or upgrade plan." },
  { code: "interview_not_found_or_slot_invalid", status: 404, module: "build", desc: "Slot not in proposedSlots array.",                resolution: "Use one of the slots from GET /interviews/my." },
  { code: "test_not_found",         status: 404, module: "build",     desc: "Skill test ID does not exist.",                             resolution: "Use IDs from GET /api/build/skill-tests." },
  { code: "profile-not-found",      status: 404, module: "healthai",  desc: "HealthAI profile not found.",                               resolution: "Create a profile first via POST /api/healthai/profile." },
  { code: "audit_required",         status: 401, module: "qcoreai",   desc: "QCoreAI endpoint requires authentication.",                 resolution: "Pass Bearer token in Authorization header." },
  { code: "spend_limit_exceeded",   status: 402, module: "qcoreai",   desc: "Monthly AI spend cap reached.",                            resolution: "Update limit at /qcoreai/budget or wait for month reset." },
  { code: "template_not_found",     status: 404, module: "qcoreai",   desc: "Prompt template ID does not exist.",                       resolution: "List templates via GET /api/qcoreai/templates." },
  { code: "document_not_found",     status: 404, module: "qcontract", desc: "QContract document not found or token expired.",            resolution: "Check the access token URL." },
  { code: "document_expired",       status: 410, module: "qcontract", desc: "Document past expiresAt or maxViews limit.",               resolution: "Create a new document." },
  { code: "create_track_failed",    status: 500, module: "qmedia",    desc: "Internal error persisting track.",                          resolution: "Retry. If persistent, contact support." },
  { code: "build_init_failed",      status: 500, module: "build",     desc: "QBuild DB bootstrap failed on cold start.",                resolution: "Retry after 5s; report if consistent." },
];

const MODULE_COLORS: Record<string, string> = {
  all:       "#64748b",
  qpaynet:   "#6366f1",
  apiKeys:   "#8b5cf6",
  build:     "#10b981",
  healthai:  "#0ea5e9",
  qcoreai:   "#a855f7",
  qcontract: "#ef4444",
  qmedia:    "#f59e0b",
};

const STATUS_COLOR: Record<number, string> = { 400: "#f59e0b", 401: "#ef4444", 402: "#f97316", 403: "#ef4444", 404: "#64748b", 409: "#f59e0b", 410: "#64748b", 429: "#f97316", 500: "#ef4444" };

export default function FintechErrorsPage() {
  return (
    <main className="min-h-screen bg-[#050810] text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/developers/fintech" className="text-slate-500 hover:text-slate-300 text-xs mb-4 inline-block">← Fintech Docs</Link>
        <h1 className="text-2xl font-black text-white mb-2">Error Codes</h1>
        <p className="text-slate-400 text-sm mb-8">All AEVION fintech API errors follow this shape:<br />
          <code className="bg-slate-900 px-2 py-1 rounded text-xs mt-1 inline-block">{"{ error: \"code\", message?: \"human text\", ...extra }"}</code>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-500 uppercase tracking-wider font-semibold">Code</th>
                <th className="text-left py-2 px-3 text-slate-500 uppercase tracking-wider font-semibold w-14">HTTP</th>
                <th className="text-left py-2 px-3 text-slate-500 uppercase tracking-wider font-semibold w-24">Module</th>
                <th className="text-left py-2 px-3 text-slate-500 uppercase tracking-wider font-semibold">Description</th>
                <th className="text-left py-2 px-3 text-slate-500 uppercase tracking-wider font-semibold">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e, i) => (
                <tr key={e.code} className={`border-b border-slate-900 ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{e.code}</td>
                  <td className="py-2.5 px-3 font-bold" style={{ color: STATUS_COLOR[e.status] ?? "#64748b" }}>{e.status}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${MODULE_COLORS[e.module] ?? "#64748b"}25`, color: MODULE_COLORS[e.module] ?? "#64748b" }}>
                      {e.module}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{e.desc}</td>
                  <td className="py-2.5 px-3 text-slate-500">{e.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex gap-4 text-xs text-slate-500">
          <Link href="/developers/fintech/sdk" className="hover:text-slate-300">SDK reference →</Link>
          <Link href="/developers/fintech" className="hover:text-slate-300">API reference →</Link>
          <Link href="/status" className="hover:text-slate-300">Live status →</Link>
        </div>
      </div>
    </main>
  );
}
