import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { getServerT, tServer, type Lang as ServerLang } from "@/lib/i18n-server";

type ModuleRuntime = {
  tier: string;
  primaryPath: string | null;
  apiHints: string[];
  hint: string;
};

type GlobusProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
  tags: string[];
  runtime?: ModuleRuntime;
};

const DEDICATED_ROUTES: Record<string, string> = {
  qright: "/qright",
  qsign: "/qsign",
  "aevion-ip-bureau": "/bureau",
  qtradeoffline: "/qtrade",
  qcoreai: "/qcoreai",
  "multichat-engine": "/multichat-engine",
  auth: "/auth",
};

// Forces per-request render so cookies()/headers() in getServerT() resolve
// correctly. Without this, SSG runs the catch-all without request scope and
// the i18n client-module boundary leaves translations undefined.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}): Promise<Metadata> {
  const p = (await Promise.resolve(params)) as { id: string };
  const id = p.id;
  try {
    const res = await fetch(apiUrl(`/api/globus/projects/${id}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { title: id, alternates: { canonical: `/${id}` } };
    const project = (await res.json()) as GlobusProject;
    const desc = (project.description || `AEVION ${project.kind} module: ${project.name}`).slice(0, 200);
    const title = `${project.code} · ${project.name}`;
    const canonical = DEDICATED_ROUTES[project.id] || `/${id}`;
    return {
      title,
      description: desc,
      openGraph: { title, description: desc, type: "article", siteName: "AEVION" },
      twitter: { card: "summary_large_image", title, description: desc },
      alternates: { canonical },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: id, alternates: { canonical: `/${id}` } };
  }
}

function ProjectFetchFailed({ id, status, lang }: { id: string; status?: number; lang: ServerLang }) {
  const t = (k: string, v?: Record<string, string | number>) => tServer(lang, k, v);
  const statusFragment = status != null ? ` (HTTP ${status})` : "";
  return (
    <main>
      <ProductPageShell maxWidth={980}>
        <Wave1Nav />
        <h1 style={{ fontSize: 24, marginTop: 8 }}>{t("modulePage.fail.h1")}</h1>
        <p style={{ color: "#555", lineHeight: 1.6, maxWidth: 560 }}>
          {t("modulePage.fail.body", { status: statusFragment })}
        </p>
        <p style={{ fontSize: 13, color: "#777" }}>
          {t("modulePage.fail.idLabel")} <code>{id}</code>
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 16,
            border: "1px solid #111",
            borderRadius: 10,
            padding: "10px 14px",
            textDecoration: "none",
            color: "#111",
            fontWeight: 650,
          }}
        >
          {t("modulePage.back")}
        </Link>
      </ProductPageShell>
    </main>
  );
}

export default async function ProjectByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await params;
  const id = p.id;

  const sp = await Promise.resolve(searchParams);

  const normalize = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return "";
  };

  const country = normalize(sp?.country);
  const city = normalize(sp?.city);

  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/globus/projects/${id}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return <ProjectFetchFailed id={id} lang={lang} />;
  }

  if (res.status === 404) notFound();
  if (!res.ok) return <ProjectFetchFailed id={id} status={res.status} lang={lang} />;

  let project: GlobusProject;
  try {
    project = (await res.json()) as GlobusProject;
  } catch {
    return <ProjectFetchFailed id={id} lang={lang} />;
  }

  const specialLinks: Record<string, string> = {
    qright: "/qright",
    qsign: "/qsign",
    "aevion-ip-bureau": "/bureau",
    qtradeoffline: "/qtrade",
    qcoreai: "/qcoreai",
    "multichat-engine": "/multichat-engine",
    auth: "/auth",
  };

  const actionHref = specialLinks[project.id];

  const qrightPrefill = (() => {
    const qs = new URLSearchParams();
    if (country) qs.set("country", country);
    if (city) qs.set("city", city);
    qs.set("title", `${project.code} • ${project.name}`);
    qs.set("description", project.description);
    // keep kind default ("idea") in QRight UI
    return `/qright?${qs.toString()}`;
  })();

  const qsignPrefillPayload = JSON.stringify(
    {
      schema: "aevion.module.stub.v1",
      moduleId: project.id,
      code: project.code,
      name: project.name,
      country: country || null,
      city: city || null,
      ts: new Date().toISOString(),
    },
    null,
    0
  );
  const qsignPrefill = `/qsign?payload=${encodeURIComponent(qsignPrefillPayload)}`;

  const bureauPrefill = (() => {
    const qs = new URLSearchParams();
    if (country) qs.set("country", country);
    if (city) qs.set("city", city);
    const q = qs.toString();
    return q ? `/bureau?${q}` : "/bureau";
  })();

  return (
    <main lang={lang}>
      <ProductPageShell maxWidth={980}>
      <Wave1Nav />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {project.code} • {project.kind} • {project.status}
            {project.runtime?.tier ? ` • ${t("modulePage.runtimeLabel")} ${project.runtime.tier}` : ""}
          </div>
          {project.runtime?.hint ? (
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{project.runtime.hint}</div>
          ) : null}
          <h1 style={{ fontSize: 26, marginTop: 6, marginBottom: 8 }}>
            {project.name}
          </h1>
        </div>
        <Link
          href="/"
          style={{
            border: "1px solid #111",
            borderRadius: 10,
            padding: "10px 12px",
            textDecoration: "none",
            color: "#111",
            fontWeight: 650,
            alignSelf: "flex-start",
          }}
        >
          {t("modulePage.back")}
        </Link>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#555", lineHeight: 1.6, fontSize: 14 }}>
          {project.description}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ border: "1px solid rgba(0,0,0,0.08)", padding: 12, borderRadius: 12, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{t("modulePage.location.title")}</div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>
              {city || country ? `${city || "—"}${country ? `, ${country}` : ""}` : "—"}
            </div>
          </div>
          <div style={{ border: "1px solid rgba(0,0,0,0.08)", padding: 12, borderRadius: 12, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{t("modulePage.future.title")}</div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>{t("modulePage.future.value")}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {actionHref ? (
            <Link
              href={actionHref}
              style={{
                border: "1px solid #111",
                borderRadius: 10,
                padding: "10px 12px",
                textDecoration: "none",
                color: "#111",
                fontWeight: 650,
                background: "rgba(0,0,0,0.03)",
              }}
            >
              {t("modulePage.btn.openModule")}
            </Link>
          ) : (
            <div style={{ color: "#666", fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
              {t("modulePage.noDedicated")}
            </div>
          )}

          <Link
            href={qrightPrefill}
            style={{
              border: "1px solid #111",
              borderRadius: 10,
              padding: "10px 12px",
              textDecoration: "none",
              color: "#111",
              fontWeight: 650,
              background: "rgba(0,0,0,0.03)",
            }}
          >
            {t("modulePage.btn.qrightPrefill")}
          </Link>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(0,80,160,0.2)",
            background: "rgba(0,80,160,0.04)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: "#024" }}>
            {t("modulePage.pipeline.title")}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#333", fontSize: 13, lineHeight: 1.65 }}>
            <li style={{ marginBottom: 8 }}>
              <Link href="/auth" style={{ fontWeight: 650, color: "#024" }}>
                {t("modulePage.pipeline.auth.label")}
              </Link>
              {" — "}
              {t("modulePage.pipeline.auth.body")}
            </li>
            <li style={{ marginBottom: 8 }}>
              <Link href={qrightPrefill} style={{ fontWeight: 650, color: "#024" }}>
                {t("modulePage.pipeline.qright.label")}
              </Link>
              {" — "}
              {t("modulePage.pipeline.qright.body")}
            </li>
            <li style={{ marginBottom: 8 }}>
              <Link href={qsignPrefill} style={{ fontWeight: 650, color: "#024" }}>
                {t("modulePage.pipeline.qsign.label")}
              </Link>
              {" — "}
              {t("modulePage.pipeline.qsign.body")}
            </li>
            <li>
              <Link href={bureauPrefill} style={{ fontWeight: 650, color: "#024" }}>
                {t("modulePage.pipeline.bureau.label")}
              </Link>
              {" — "}
              {t("modulePage.pipeline.bureau.body")}
            </li>
          </ol>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(15,118,110,0.25)",
            background: "linear-gradient(135deg, rgba(15,118,110,0.05), rgba(99,102,241,0.04))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🌍</span>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#0f766e" }}>
              {t("modulePage.planet.title")}
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
            {t("modulePage.planet.body")}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/planet?title=${encodeURIComponent(`${project.code} — ${project.name}`)}&productKey=${encodeURIComponent(`planet_module_${project.id}`)}`}
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 10,
                background: "#0f766e",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {t("modulePage.planet.btn.submit")}
            </Link>
            <Link
              href="/planet"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,118,110,0.3)",
                color: "#0f766e",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {t("modulePage.planet.btn.lab")}
            </Link>
            <Link
              href="/awards"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                color: "#334155",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {t("modulePage.planet.btn.awards")}
            </Link>
          </div>
        </div>

        <hr style={{ margin: "16px 0", borderColor: "rgba(0,0,0,0.08)" }} />

        <div style={{ fontSize: 12, color: "#666" }}>
          id: {project.id} • {t("modulePage.footer.priority")} {project.priority}
        </div>
      </div>
      </ProductPageShell>
    </main>
  );
}

