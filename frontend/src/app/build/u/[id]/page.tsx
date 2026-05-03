import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import { VideoEmbed } from "@/components/build/VideoEmbed";
import { StarsDisplay } from "@/components/build/StarRating";
import { ReviewsByUserSection } from "@/components/build/ReviewsSection";
import { ShareProfileButton } from "@/components/build/ShareProfileButton";

export const dynamic = "force-dynamic";

type Bundle = {
  userId: string;
  name: string;
  city: string | null;
  description: string | null;
  buildRole: string;
  title: string | null;
  summary: string | null;
  skills: string[];
  languages: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  availability: string | null;
  experienceYears: number;
  photoUrl: string | null;
  openToWork: boolean;
  verifiedAt: string | null;
  verifiedReason: string | null;
  certifications: { name: string; issuer?: string; year?: number | null; credentialUrl?: string | null }[];
  portfolio: { label: string; url: string }[];
  achievements: { title: string; description?: string; year?: number | null }[];
  driversLicense: string | null;
  shiftPreference: string | null;
  availabilityType: string | null;
  readyFromDate: string | null;
  preferredLocations: string[];
  toolsOwned: string[];
  medicalCheckValid: boolean;
  medicalCheckUntil: string | null;
  safetyTrainingValid: boolean;
  safetyTrainingUntil: string | null;
  introVideoUrl: string | null;
  email: string | null;
  avgRating?: number;
  reviewCount?: number;
  experiences: {
    id: string;
    title: string;
    company: string;
    city: string | null;
    fromDate: string | null;
    toDate: string | null;
    current: boolean;
    description: string | null;
  }[];
  education: {
    id: string;
    institution: string;
    degree: string | null;
    field: string | null;
    fromYear: number | null;
    toYear: number | null;
  }[];
};

async function load(id: string): Promise<Bundle | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/profiles/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: Bundle };
    if (!json?.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

function fmtSalary(b: Bundle): string {
  const cur = b.salaryCurrency || "RUB";
  if (b.salaryMin && b.salaryMax) {
    return `${b.salaryMin.toLocaleString()}–${b.salaryMax.toLocaleString()} ${cur}`;
  }
  if (b.salaryMin) return `от ${b.salaryMin.toLocaleString()} ${cur}`;
  if (b.salaryMax) return `до ${b.salaryMax.toLocaleString()} ${cur}`;
  return "—";
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: "Profile — AEVION QBuild",
    description: "Public talent profile on AEVION QBuild.",
  };
  if (!id) return fallback;
  const data = await load(id);
  if (!data) return fallback;
  const titleLine = `${data.name}${data.title ? " · " + data.title : ""}`;
  const desc = [
    data.openToWork ? "Open to work" : null,
    data.city,
    `${data.experienceYears}y experience`,
    data.skills.slice(0, 4).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${titleLine} — AEVION QBuild`,
    description: desc || data.summary || fallback.description,
    openGraph: {
      type: "profile",
      title: titleLine,
      description: desc || data.summary || undefined,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const data = await load(id);

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <div className="font-bold">Profile not found</div>
          <p className="mt-1 text-sm text-rose-200/80">
            No public profile with id <code>{id}</code>.
          </p>
          <Link
            href="/build"
            className="mt-4 inline-block text-emerald-300 hover:underline"
          >
            ← AEVION QBuild
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/build/talent" className="text-xs text-slate-400 hover:underline">
            ← Talent search
          </Link>
          <div className="flex items-center gap-2">
            <ShareProfileButton userId={id} />
            <a
              href={`${getApiBase()}/api/build/profiles/${encodeURIComponent(id)}/resume.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
            >
              ⬇ Resume PDF
            </a>
          </div>
        </div>

        <header className="mt-3 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-start sm:gap-6">
          <Avatar src={data.photoUrl} name={data.name} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{data.name}</h1>
              {data.verifiedAt && (
                <span
                  title={data.verifiedReason ?? undefined}
                  className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-200"
                >
                  ✓ Verified
                </span>
              )}
              {data.openToWork && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  Open to work
                </span>
              )}
            </div>
            {data.title && <p className="mt-0.5 text-sm text-emerald-200">{data.title}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              {data.city && <span>📍 {data.city}</span>}
              {data.experienceYears > 0 && <span>⏱ {data.experienceYears}y experience</span>}
              {data.availability && <span>🟢 {data.availability}</span>}
              <span>💼 {data.buildRole}</span>
            </div>
            {typeof data.reviewCount === "number" && data.reviewCount > 0 && (
              <div className="mt-2">
                <StarsDisplay
                  value={data.avgRating ?? 0}
                  size="md"
                  showValue
                  reviewCount={data.reviewCount}
                />
              </div>
            )}
            {(data.salaryMin || data.salaryMax) && (
              <div className="mt-2 text-sm text-slate-200">
                <span className="text-slate-400">Salary expectation: </span>
                <span className="font-medium text-emerald-200">{fmtSalary(data)}</span>
              </div>
            )}
          </div>
        </header>

        {data.introVideoUrl && (
          <Section title="Intro video">
            <VideoEmbed url={data.introVideoUrl} />
          </Section>
        )}

        {data.summary && (
          <Section title="Summary">
            <p className="whitespace-pre-wrap text-sm text-slate-200">{data.summary}</p>
          </Section>
        )}

        {data.skills.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>
        )}

        {data.languages.length > 0 && (
          <Section title="Languages">
            <div className="flex flex-wrap gap-1.5">
              {data.languages.map((l) => (
                <span
                  key={l}
                  className="rounded-full bg-sky-500/15 px-3 py-1 text-xs text-sky-200"
                >
                  {l}
                </span>
              ))}
            </div>
          </Section>
        )}

        {(data.driversLicense ||
          data.shiftPreference ||
          data.availabilityType ||
          data.readyFromDate ||
          data.preferredLocations.length > 0 ||
          data.toolsOwned.length > 0 ||
          data.medicalCheckValid ||
          data.safetyTrainingValid) && (
          <Section title="Construction-vertical signals">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {data.availabilityType && (
                <KV k="Availability">{data.availabilityType.replace("_", " ")}</KV>
              )}
              {data.shiftPreference && <KV k="Shifts">{data.shiftPreference}</KV>}
              {data.readyFromDate && <KV k="Ready from">{data.readyFromDate}</KV>}
              {data.driversLicense && <KV k="Driver's license">{data.driversLicense}</KV>}
              {data.medicalCheckValid && (
                <KV k="Medical check">
                  ✓ valid{data.medicalCheckUntil ? ` until ${data.medicalCheckUntil}` : ""}
                </KV>
              )}
              {data.safetyTrainingValid && (
                <KV k="Safety training">
                  ✓ current{data.safetyTrainingUntil ? ` until ${data.safetyTrainingUntil}` : ""}
                </KV>
              )}
              {data.preferredLocations.length > 0 && (
                <KV k="Preferred locations">{data.preferredLocations.join(", ")}</KV>
              )}
            </div>
            {data.toolsOwned.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tools / equipment owned
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.toolsOwned.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-fuchsia-500/15 px-3 py-0.5 text-xs text-fuchsia-200"
                    >
                      🔧 {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {data.certifications.length > 0 && (
          <Section title="Certifications & licenses">
            <ul className="space-y-2 text-sm">
              {data.certifications.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex flex-wrap gap-2">
                  <span className="font-semibold text-white">{c.name}</span>
                  {c.issuer && <span className="text-slate-400">· {c.issuer}</span>}
                  {c.year && <span className="text-slate-500">· {c.year}</span>}
                  {c.credentialUrl && (
                    <a
                      href={c.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline-offset-2 hover:underline"
                    >
                      verify ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.portfolio.length > 0 && (
          <Section title="Portfolio">
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {data.portfolio.map((p, i) => (
                <li key={i}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 hover:bg-white/5"
                  >
                    <div className="font-medium text-slate-200">{p.label}</div>
                    <div className="truncate text-xs text-slate-500">{p.url}</div>
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.achievements.length > 0 && (
          <Section title="Achievements">
            <ul className="space-y-3 text-sm">
              {data.achievements.map((a, i) => (
                <li key={i}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold text-white">{a.title}</div>
                    {a.year && <div className="text-xs text-slate-500">{a.year}</div>}
                  </div>
                  {a.description && (
                    <p className="mt-1 text-slate-400">{a.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.experiences.length > 0 && (
          <Section title="Experience">
            <ul className="space-y-4">
              {data.experiences.map((e) => (
                <li key={e.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold text-white">{e.title}</div>
                    <div className="text-xs text-slate-400">
                      {[e.fromDate, e.current ? "present" : e.toDate].filter(Boolean).join(" — ")}
                    </div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {e.company}
                    {e.city ? ` · ${e.city}` : ""}
                  </div>
                  {e.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{e.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.education.length > 0 && (
          <Section title="Education">
            <ul className="space-y-3">
              {data.education.map((e) => (
                <li key={e.id}>
                  <div className="font-semibold text-white">{e.institution}</div>
                  <div className="text-sm text-slate-300">
                    {[e.degree, e.field].filter(Boolean).join(", ")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[e.fromYear, e.toYear].filter(Boolean).join(" — ")}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.description && (
          <Section title="About">
            <p className="whitespace-pre-wrap text-sm text-slate-300">{data.description}</p>
          </Section>
        )}

        <ReviewsByUserSection
          userId={id}
          initialAvg={data.avgRating}
          initialCount={data.reviewCount}
        />
      </div>
    </main>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{k}</div>
      <div className="mt-0.5 text-slate-200">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={96}
        height={96}
        className="h-24 w-24 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl font-bold text-emerald-200">
      {initials || "?"}
    </div>
  );
}

