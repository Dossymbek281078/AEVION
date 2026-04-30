"use client";

import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "./auth";

// ── Domain types ─────────────────────────────────────────────────────

export type BuildRole = "CLIENT" | "CONTRACTOR" | "WORKER" | "ADMIN";
export type ProjectStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export type VacancyStatus = "OPEN" | "CLOSED";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type BuildProfile = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  city: string | null;
  description: string | null;
  buildRole: BuildRole;
  createdAt: string;
  updatedAt: string;
  // Resume fields
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
};

export type BuildExperience = {
  id: string;
  userId: string;
  title: string;
  company: string;
  city: string | null;
  fromDate: string | null;
  toDate: string | null;
  current: boolean;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

export type BuildEducation = {
  id: string;
  userId: string;
  institution: string;
  degree: string | null;
  field: string | null;
  fromYear: number | null;
  toYear: number | null;
  createdAt: string;
};

export type TalentRow = {
  userId: string;
  name: string;
  city: string | null;
  buildRole: BuildRole;
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
  updatedAt: string;
};

export type BuildResumeBundle = BuildProfile & {
  email: string | null;
  experiences: BuildExperience[];
  education: BuildEducation[];
};

export type BuildProject = {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: ProjectStatus;
  city: string | null;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  vacancyCount?: number;
};

export type BuildVacancy = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  salary: number;
  status: VacancyStatus;
  createdAt: string;
  applicationsCount?: number;
  projectTitle?: string;
  projectStatus?: ProjectStatus;
  clientId?: string;
  boostUntil?: string | null;
  skills?: string[];
  city?: string | null;
  salaryCurrency?: string | null;
};

export type BuildApplication = {
  id: string;
  vacancyId: string;
  userId: string;
  message: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  vacancyTitle?: string;
  salary?: number;
  projectId?: string;
  projectTitle?: string;
  email?: string;
  applicantName?: string;
  applicantCity?: string;
  applicantHeadline?: string | null;
  applicantExperienceYears?: number;
  applicantSkills?: string[];
  matchScore?: number | null;
  matchedSkills?: string[];
};

export type BuildMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

export type BuildInboxRow = {
  peerId: string;
  peerName: string | null;
  peerEmail: string | null;
  lastAt: string;
  lastContent: string;
  unread: number;
};

export type BuildFile = {
  id: string;
  projectId: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploaderId: string;
  createdAt: string;
};

// ── Pricing types ────────────────────────────────────────────────────

export type PlanKey = "FREE" | "PRO" | "AGENCY" | "PPHIRE";
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PENDING";

export type BuildPlan = {
  key: PlanKey;
  name: string;
  tagline: string | null;
  priceMonthly: number;
  currency: string;
  vacancySlots: number;          // -1 = unlimited
  talentSearchPerMonth: number;  // -1 = unlimited
  boostsPerMonth: number;
  hireFeeBps: number;            // basis points (1200 = 12.00%)
  features: string[];
  sortOrder: number;
};

export type BuildOrderRow = {
  id: string;
  userId: string;
  kind: "SUB_START" | "BOOST" | "TALENT_DAY_PASS" | "HIRE_FEE";
  ref: string | null;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "CANCELED" | "REFUNDED";
  metaJson: string;
  createdAt: string;
};

export type BuildSubscription = {
  id: string;
  userId: string;
  planKey: PlanKey;
  status: SubscriptionStatus;
  startedAt: string;
  endsAt: string | null;
  createdAt: string;
  planName?: string;
  priceMonthly?: number;
  currency?: string;
};

// ── Envelope + transport ─────────────────────────────────────────────

type Envelope<T> = { success: true; data: T } | { success: false; error: string; [k: string]: unknown };

export class BuildApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public payload?: unknown,
  ) {
    super(code);
    this.name = "BuildApiError";
  }
}

async function call<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  init?: { auth?: boolean; signal?: AbortSignal },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.auth !== false) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: init?.signal,
    cache: "no-store",
  });

  let parsed: Envelope<T> | null = null;
  try {
    parsed = (await res.json()) as Envelope<T>;
  } catch {
    throw new BuildApiError(res.status, `bad_response_${res.status}`);
  }

  if (!res.ok || !parsed || parsed.success === false) {
    const err = parsed && parsed.success === false ? parsed : null;
    throw new BuildApiError(res.status, err?.error || `http_${res.status}`, err);
  }

  return parsed.data;
}

// ── Endpoint helpers ─────────────────────────────────────────────────

export const buildApi = {
  health: () => call<{ service: string; status: string; timestamp: string }>(
    "GET",
    "/api/build/health",
    undefined,
    { auth: false },
  ),

  // Profile
  me: () => call<{ user: BuildAuthLike; profile: BuildProfile | null }>(
    "GET",
    "/api/build/users/me",
  ),
  upsertProfile: (input: {
    name: string;
    phone?: string | null;
    city?: string | null;
    description?: string | null;
    buildRole?: BuildRole;
    title?: string | null;
    summary?: string | null;
    skills?: string[];
    languages?: string[];
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    availability?: string | null;
    experienceYears?: number;
    photoUrl?: string | null;
    openToWork?: boolean;
  }) => call<BuildProfile>("POST", "/api/build/profiles", input),
  getProfile: (userId: string) =>
    call<BuildResumeBundle>("GET", `/api/build/profiles/${encodeURIComponent(userId)}`, undefined, { auth: false }),
  searchProfiles: (q?: {
    q?: string;
    skill?: string;
    city?: string;
    role?: BuildRole;
    minExp?: number;
    openToWork?: boolean;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (q?.q) params.set("q", q.q);
    if (q?.skill) params.set("skill", q.skill);
    if (q?.city) params.set("city", q.city);
    if (q?.role) params.set("role", q.role);
    if (q?.minExp != null) params.set("minExp", String(q.minExp));
    if (q?.openToWork) params.set("openToWork", "1");
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: TalentRow[]; total: number }>(
      "GET",
      `/api/build/profiles/search${qs ? "?" + qs : ""}`,
    );
  },
  addExperience: (input: {
    title: string;
    company: string;
    city?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    current?: boolean;
    description?: string | null;
  }) => call<BuildExperience>("POST", "/api/build/experiences", input),
  deleteExperience: (id: string) =>
    call<{ id: string; deleted: boolean }>("DELETE", `/api/build/experiences/${encodeURIComponent(id)}`),
  addEducation: (input: {
    institution: string;
    degree?: string | null;
    field?: string | null;
    fromYear?: number | null;
    toYear?: number | null;
  }) => call<BuildEducation>("POST", "/api/build/education", input),
  deleteEducation: (id: string) =>
    call<{ id: string; deleted: boolean }>("DELETE", `/api/build/education/${encodeURIComponent(id)}`),

  // Projects
  listProjects: (q?: { status?: ProjectStatus; q?: string; mine?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.q) params.set("q", q.q);
    if (q?.mine) params.set("mine", "1");
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: BuildProject[]; total: number }>(
      "GET",
      `/api/build/projects${qs ? "?" + qs : ""}`,
      undefined,
      { auth: !!q?.mine },
    );
  },
  createProject: (input: { title: string; description: string; budget?: number; city?: string | null }) =>
    call<BuildProject>("POST", "/api/build/projects", input),
  getProject: (id: string) =>
    call<{
      project: BuildProject;
      vacancies: BuildVacancy[];
      files: BuildFile[];
      client: { id: string; email: string; name: string; city: string | null; buildRole: BuildRole | null } | null;
    }>("GET", `/api/build/projects/${encodeURIComponent(id)}`, undefined, { auth: false }),
  updateProject: (id: string, patch: Partial<{ title: string; description: string; budget: number; status: ProjectStatus; city: string | null }>) =>
    call<BuildProject>("PATCH", `/api/build/projects/${encodeURIComponent(id)}`, patch),

  // Vacancies
  listVacancies: (q?: {
    status?: VacancyStatus;
    projectStatus?: ProjectStatus;
    q?: string;
    city?: string;
    minSalary?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.projectStatus) params.set("projectStatus", q.projectStatus);
    if (q?.q) params.set("q", q.q);
    if (q?.city) params.set("city", q.city);
    if (q?.minSalary != null) params.set("minSalary", String(q.minSalary));
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: (BuildVacancy & { projectCity?: string | null })[]; total: number }>(
      "GET",
      `/api/build/vacancies${qs ? "?" + qs : ""}`,
      undefined,
      { auth: false },
    );
  },
  createVacancy: (input: {
    projectId: string;
    title: string;
    description: string;
    salary?: number;
    skills?: string[];
    city?: string | null;
    salaryCurrency?: string;
  }) => call<BuildVacancy>("POST", "/api/build/vacancies", input),
  vacanciesByProject: (projectId: string) =>
    call<{ items: BuildVacancy[]; total: number }>(
      "GET",
      `/api/build/vacancies/by-project/${encodeURIComponent(projectId)}`,
      undefined,
      { auth: false },
    ),
  getVacancy: (id: string) =>
    call<BuildVacancy>("GET", `/api/build/vacancies/${encodeURIComponent(id)}`, undefined, { auth: false }),
  updateVacancy: (id: string, status: VacancyStatus) =>
    call<BuildVacancy>("PATCH", `/api/build/vacancies/${encodeURIComponent(id)}`, { status }),
  boostVacancy: (id: string, days = 7) =>
    call<{
      boost: { id: string; vacancyId: string; endsAt: string; source: "PLAN" | "PAID" };
      orderId: string | null;
      source: "PLAN" | "PAID";
    }>("POST", `/api/build/vacancies/${encodeURIComponent(id)}/boost`, { days }),

  // Applications
  apply: (input: { vacancyId: string; message?: string }) =>
    call<BuildApplication>("POST", "/api/build/applications", input),
  myApplications: () => call<{ items: BuildApplication[]; total: number }>("GET", "/api/build/applications/my"),
  applicationsByVacancy: (vacancyId: string) =>
    call<{ items: BuildApplication[]; total: number }>(
      "GET",
      `/api/build/applications/by-vacancy/${encodeURIComponent(vacancyId)}`,
    ),
  updateApplication: (id: string, status: ApplicationStatus) =>
    call<BuildApplication>("PATCH", `/api/build/applications/${encodeURIComponent(id)}`, { status }),

  // Messages
  inbox: () => call<{ items: BuildInboxRow[]; total: number }>("GET", "/api/build/messages"),
  thread: (peerUserId: string) =>
    call<{ items: BuildMessage[]; total: number }>(
      "GET",
      `/api/build/messages/${encodeURIComponent(peerUserId)}`,
    ),
  send: (input: { receiverId: string; content: string }) =>
    call<BuildMessage>("POST", "/api/build/messages", input),

  // Plan usage
  myUsage: () =>
    call<{
      plan: BuildPlan;
      usage: { userId: string; monthKey: string; talentSearches: number; boostsUsed: number };
      monthKey: string;
      activeVacancies: number;
      limits: {
        vacanciesRemaining: number;
        talentSearchesRemaining: number;
        boostsRemaining: number;
      };
    }>("GET", "/api/build/usage/me"),

  // Pricing
  listPlans: () =>
    call<{ items: BuildPlan[]; total: number }>("GET", "/api/build/plans", undefined, { auth: false }),
  mySubscription: () =>
    call<{ subscription: BuildSubscription | null }>("GET", "/api/build/subscriptions/me"),
  startSubscription: (planKey: PlanKey) =>
    call<{ subscription: BuildSubscription; order: { id: string; status: string; amount: number; currency: string } }>(
      "POST",
      "/api/build/subscriptions/start",
      { planKey },
    ),
  myOrders: () =>
    call<{ items: BuildOrderRow[]; total: number }>("GET", "/api/build/orders/me"),
  payOrder: (id: string) =>
    call<{ order: BuildOrderRow; alreadyPaid?: boolean }>(
      "POST",
      `/api/build/orders/${encodeURIComponent(id)}/pay`,
    ),

  // Notifications
  notifySummary: () =>
    call<{
      unreadMessages: number;
      pendingApplications: number;
      applicationUpdates: number;
      total: number;
    }>("GET", "/api/build/notifications/summary"),

  // Files
  uploadFile: (input: {
    projectId: string;
    url: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
  }) => call<BuildFile>("POST", "/api/build/files/upload", input),
};

// ── Auth helpers (use existing /api/auth/* — not part of /api/build) ─

export type BuildAuthLike = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
};

export async function buildLogin(email: string, password: string): Promise<{ token: string; user: BuildAuthLike }> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new BuildApiError(res.status, json?.error || "login_failed", json);
  return json;
}

export async function buildRegister(email: string, password: string, name: string): Promise<{ token: string; user: BuildAuthLike }> {
  const res = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new BuildApiError(res.status, json?.error || "register_failed", json);
  return json;
}
